import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { action, device_id, ip_address, port, username, password } = body;

    const deviceUrl = `http://${ip_address}:${port || 80}`;
    const authString = btoa(`${username || "admin"}:${password || ""}`);

    if (action === "test") {
      // Test connection via /ISAPI/System/deviceInfo
      try {
        const resp = await fetch(`${deviceUrl}/ISAPI/System/deviceInfo`, {
          method: "GET",
          headers: { Authorization: `Basic ${authString}` },
          signal: AbortSignal.timeout(10000),
        });

        if (resp.ok) {
          const text = await resp.text();
          // Log success
          await supabase.from("hikvision_sync_log").insert({
            device_id,
            action: "test_connection",
            status: "success",
          });
          return new Response(
            JSON.stringify({ success: true, status: "connected", data: text }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const errorText = await resp.text();
          await supabase.from("hikvision_sync_log").insert({
            device_id,
            action: "test_connection",
            status: "error",
            error_message: `HTTP ${resp.status}: ${errorText.substring(0, 200)}`,
          });
          return new Response(
            JSON.stringify({ success: false, status: "failed", error: `HTTP ${resp.status}` }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Connection failed";
        await supabase.from("hikvision_sync_log").insert({
          device_id,
          action: "test_connection",
          status: "error",
          error_message: errMsg,
        });
        return new Response(
          JSON.stringify({ success: false, status: "failed", error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "sync") {
      // Log sync start
      await supabase.from("hikvision_sync_log").insert({
        device_id,
        action: "sync_started",
        status: "success",
      });

      try {
        // Get last sync time for this device
        const { data: device } = await supabase
          .from("hikvision_devices")
          .select("last_sync_at, name")
          .eq("id", device_id)
          .single();

        const searchBody: Record<string, unknown> = {
          AcsEventCond: {
            searchID: crypto.randomUUID(),
            searchResultPosition: 0,
            maxResults: 100,
            major: 0,
            minor: 0,
          },
        };

        // If we have a last sync time, only fetch events after that
        if (device?.last_sync_at) {
          searchBody.AcsEventCond.startTime = device.last_sync_at;
        }
        searchBody.AcsEventCond.endTime = new Date().toISOString();

        const resp = await fetch(
          `${deviceUrl}/ISAPI/AccessControl/AcsEvent?format=json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${authString}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(searchBody),
            signal: AbortSignal.timeout(30000),
          }
        );

        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`Device returned HTTP ${resp.status}: ${errorText.substring(0, 200)}`);
        }

        const data = await resp.json();
        const events = data?.AcsEvent?.InfoList || [];
        let syncedCount = 0;

        // Get existing employee mappings
        const { data: mappings } = await supabase
          .from("hikvision_employee_mapping")
          .select("*")
          .eq("device_id", device_id);
        const mappingMap = new Map(
          (mappings || []).map((m: any) => [m.device_employee_code, m])
        );

        for (const event of events) {
          const employeeCode = event.employeeNoString || event.employeeNo?.toString() || "";
          const employeeName = event.name || "";
          const eventTime = event.time || event.dateTime;
          if (!eventTime) continue;

          // Determine event type
          let eventType = "access";
          const cardType = event.cardType || event.currentEvent?.cardType;
          if (cardType === 1) eventType = "checkin";
          else if (cardType === 2) eventType = "checkout";

          // Auto-create mapping if not exists
          let mapping = mappingMap.get(employeeCode);
          if (!mapping && employeeCode) {
            const { data: newMapping } = await supabase
              .from("hikvision_employee_mapping")
              .upsert(
                {
                  device_employee_code: employeeCode,
                  device_employee_name: employeeName,
                  device_id,
                },
                { onConflict: "device_employee_code,device_id" }
              )
              .select()
              .single();
            mapping = newMapping;
            if (mapping) mappingMap.set(employeeCode, mapping);
          }

          // Insert attendance log (ignore duplicates)
          const { error: insertError } = await supabase
            .from("hikvision_attendance_logs")
            .upsert(
              {
                device_id,
                employee_code: employeeCode,
                employee_name: employeeName,
                employee_id: mapping?.erp_employee_id || null,
                device_ip: ip_address,
                device_name: device?.name || "",
                event_time: eventTime,
                event_type: eventType,
                raw_data: event,
              },
              { onConflict: "device_id,employee_code,event_time" }
            );

          if (!insertError) syncedCount++;
        }

        // Update device last sync time
        await supabase
          .from("hikvision_devices")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", device_id);

        // Log sync completed
        await supabase.from("hikvision_sync_log").insert({
          device_id,
          action: "sync_completed",
          status: "success",
          records_synced: syncedCount,
        });

        return new Response(
          JSON.stringify({ success: true, records_synced: syncedCount, total_events: events.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Sync failed";
        await supabase.from("hikvision_sync_log").insert({
          device_id,
          action: "sync_failed",
          status: "error",
          error_message: errMsg,
        });
        return new Response(
          JSON.stringify({ success: false, error: errMsg }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'test' or 'sync'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Internal error";
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
