import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildDedupeKey(deviceSerial: string, serialNo?: string, employeeNo?: string, eventTime?: string, status?: string, verifyMode?: string): string {
  if (serialNo) return `${deviceSerial}:${serialNo}`;
  return `${deviceSerial}:${employeeNo || ""}:${eventTime || ""}:${status || ""}:${verifyMode || ""}`;
}

async function verifyHmacSignature(body: string, timestamp: string, batchId: string, signature: string): Promise<boolean> {
  const signSecret = Deno.env.get("HIK_WEBHOOK_SIGN_SECRET");
  if (!signSecret) {
    console.warn("[webhook] No HIK_WEBHOOK_SIGN_SECRET configured, skipping signature check");
    return true;
  }

  const message = `${timestamp}.${batchId}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(signSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return expected === signature.toLowerCase();
}

serve(async (req: Request) => {
  // GET: Hik-Partner webhook verification (if used)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("challenge") || url.searchParams.get("echostr") || "";
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const bodyText = await req.text();
    const timestamp = req.headers.get("X-Hook-Timestamp") || "";
    const batchId = req.headers.get("X-Hook-Batch-Id") || "";
    const signature = req.headers.get("X-Hook-Signature") || "";

    // Log the raw request for debugging
    console.log(`[webhook] Received POST | timestamp: ${timestamp} | batchId: ${batchId} | sig: ${signature ? "present" : "none"}`);
    console.log(`[webhook] Headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`);
    console.log(`[webhook] Body (first 2000 chars): ${bodyText.substring(0, 2000)}`);

    // Validate signature
    if (signature) {
      const valid = await verifyHmacSignature(bodyText, timestamp, batchId, signature);
      if (!valid) {
        console.error("[webhook] Invalid signature — rejecting");
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 403 });
      }
      console.log("[webhook] Signature valid");
    }

    let payload: any;
    try { payload = JSON.parse(bodyText); } catch {
      console.error(`[webhook] Invalid JSON body: ${bodyText.substring(0, 500)}`);
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    // Payload can be a single event or a list
    const events = Array.isArray(payload) ? payload : (payload.params?.events || payload.events || [payload]);
    console.log(`[webhook] Processing ${events.length} events`);

    let processed = 0;
    let skipped = 0;

    for (const event of events) {
      try {
        // Parse the alarm data
        let alarmData: any = event;
        if (typeof event.alarmData === "string") {
          try { alarmData = JSON.parse(event.alarmData); } catch { alarmData = event; }
        } else if (event.alarmData) {
          alarmData = event.alarmData;
        }

        const deviceSerial = event.deviceSerial || alarmData.deviceSerial || "";
        const acsEvent = alarmData.AccessControllerEvent || alarmData.ACSEvent || {};
        const eventType = alarmData.eventType || event.formatType || "";

        // Only process access control events
        const isAccessEvent = eventType.toLowerCase().includes("accesscontroller") ||
          eventType.toLowerCase().includes("acs") || acsEvent.employeeNoString || acsEvent.name;
        if (!isAccessEvent) { skipped++; continue; }

        const employeeCode = acsEvent.employeeNoString || acsEvent.employeeNo?.toString() || "";
        const employeeName = acsEvent.name || "";
        const eventTime = alarmData.dateTime || acsEvent.time || acsEvent.dateTime || event.alarmTime;
        if (!eventTime || !employeeCode) { skipped++; continue; }

        const attStatus = acsEvent.attendanceStatus || "";
        const verifyMode = acsEvent.currentVerifyMode || "";
        const serialNo = acsEvent.serialNo?.toString() || "";
        const dedupeKey = buildDedupeKey(deviceSerial, serialNo, employeeCode, eventTime, attStatus, verifyMode);

        console.log(`[webhook] Event: emp=${employeeCode} time=${eventTime} status=${attStatus} device=${deviceSerial}`);

        // Resolve device
        const { data: deviceRec } = await supabase
          .from("hikvision_devices").select("id, name").eq("device_serial", deviceSerial).maybeSingle();

        // Resolve employee mapping
        const { data: mapping } = await supabase
          .from("hikvision_employee_mapping").select("erp_employee_id")
          .eq("device_employee_code", employeeCode)
          .eq("device_id", deviceRec?.id || "00000000-0000-0000-0000-000000000000")
          .maybeSingle();

        const { error } = await supabase.from("hikvision_attendance_logs").upsert({
          device_id: deviceRec?.id || null,
          employee_code: employeeCode,
          employee_name: employeeName,
          employee_id: mapping?.erp_employee_id || null,
          device_ip: deviceSerial,
          device_name: deviceRec?.name || "",
          event_time: eventTime,
          event_type: "attendance",
          raw_data: alarmData,
          dedupe_key: dedupeKey,
          source_mode: "webhook",
          attendance_status: attStatus || null,
          verify_mode: verifyMode || null,
          event_serial_no: serialNo || null,
        }, { onConflict: "dedupe_key" });

        if (!error) processed++;
        else console.warn(`[webhook] Insert error: ${error.message}`);

        // Auto-create attendance record if mapped
        if (mapping?.erp_employee_id && !error) {
          const eventDate = eventTime.substring(0, 10);
          const { data: existingRecord } = await supabase
            .from("attendance_records").select("id, check_in, check_out")
            .eq("employee_id", mapping.erp_employee_id).eq("date", eventDate).maybeSingle();

          if (!existingRecord) {
            await supabase.from("attendance_records").insert({
              employee_id: mapping.erp_employee_id, date: eventDate,
              check_in: eventTime, source: "biometric",
              device_id: deviceSerial, notes: `Auto via webhook`,
            });
          } else if (!existingRecord.check_out && eventTime > (existingRecord.check_in || "")) {
            await supabase.from("attendance_records")
              .update({ check_out: eventTime }).eq("id", existingRecord.id);
          }
        }
      } catch (evtErr) {
        console.warn(`[webhook] Event error: ${evtErr instanceof Error ? evtErr.message : "unknown"}`);
        skipped++;
      }
    }

    // Log sync
    await supabase.from("hikvision_sync_log").insert({
      action: "webhook_received", status: "success",
      sync_type: "attendance", records_synced: processed,
    });

    console.log(`[webhook] Done: ${processed} processed, ${skipped} skipped, batch ${batchId}`);
    return new Response(JSON.stringify({ success: true, processed, skipped }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[webhook] FATAL: ${e instanceof Error ? e.stack || e.message : "Internal error"}`);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
