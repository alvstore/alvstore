import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Hik-Partner Pro Cloud API
const HPP_BASE_URL = "https://api.hik-partner.com";

interface TokenResponse {
  data?: { accessToken: string; expireTime: number; areaDomain: string };
  errorCode: string;
}

// Cache token in memory (valid for 7 days, we refresh every call for simplicity in edge functions)
async function getHppToken(): Promise<{ accessToken: string; areaDomain: string }> {
  const appKey = Deno.env.get("HIK_PARTNER_APP_KEY");
  const secretKey = Deno.env.get("HIK_PARTNER_SECRET_KEY");

  if (!appKey || !secretKey) {
    throw new Error("HIK_PARTNER_APP_KEY and HIK_PARTNER_SECRET_KEY must be configured");
  }

  const resp = await fetch(`${HPP_BASE_URL}/api/hpcgw/v1/token/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, secretKey }),
  });

  if (!resp.ok) {
    throw new Error(`Token request failed: HTTP ${resp.status}`);
  }

  const result: TokenResponse = await resp.json();
  if (result.errorCode !== "0" || !result.data?.accessToken) {
    throw new Error(`Token error: ${result.errorCode}`);
  }

  return { accessToken: result.data.accessToken, areaDomain: result.data.areaDomain };
}

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
    const { action, device_id, device_serial } = body;

    // ── ACTION: test ──
    if (action === "test") {
      try {
        const { accessToken, areaDomain } = await getHppToken();

        // Use device info via transparent ISAPI proxy
        const resp = await fetch(
          `${areaDomain}/api/hpcgw/v1/device/transparent/ISAPI/System/deviceInfo`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              "X-Device-Serial": device_serial,
            },
            signal: AbortSignal.timeout(15000),
          }
        );

        if (resp.ok) {
          const text = await resp.text();
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
            error_message: `HTTP ${resp.status}: ${errorText.substring(0, 500)}`,
          });
          return new Response(
            JSON.stringify({ success: false, status: "failed", error: `HTTP ${resp.status}: ${errorText.substring(0, 200)}` }),
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
          JSON.stringify({ success: false, status: "error", error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── ACTION: list-devices ──
    if (action === "list-devices") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const resp = await fetch(`${areaDomain}/api/hpcgw/v1/device/list`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ page: 1, pageSize: 100 }),
          signal: AbortSignal.timeout(15000),
        });

        const result = await resp.json();
        if (result.errorCode !== "0") {
          return new Response(
            JSON.stringify({ success: false, error: `API error: ${result.errorCode}` }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, devices: result.data?.rows || [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed to list devices";
        return new Response(
          JSON.stringify({ success: false, error: errMsg }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── ACTION: sync ──
    if (action === "sync") {
      await supabase.from("hikvision_sync_log").insert({
        device_id,
        action: "sync_started",
        status: "success",
      });

      try {
        const { accessToken, areaDomain } = await getHppToken();

        // Get last sync time for this device
        const { data: device } = await supabase
          .from("hikvision_devices")
          .select("last_sync_at, name")
          .eq("id", device_id)
          .single();

        // Use transparent ISAPI proxy to search access control events
        const searchBody: Record<string, unknown> = {
          AcsEventCond: {
            searchID: crypto.randomUUID(),
            searchResultPosition: 0,
            maxResults: 100,
            major: 0,
            minor: 0,
          },
        };

        if (device?.last_sync_at) {
          (searchBody.AcsEventCond as Record<string, unknown>).startTime = device.last_sync_at;
        }
        (searchBody.AcsEventCond as Record<string, unknown>).endTime = new Date().toISOString();

        const resp = await fetch(
          `${areaDomain}/api/hpcgw/v1/device/transparent/ISAPI/AccessControl/AcsEvent?format=json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              "X-Device-Serial": device_serial,
            },
            body: JSON.stringify(searchBody),
            signal: AbortSignal.timeout(30000),
          }
        );

        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`Device returned HTTP ${resp.status}: ${errorText.substring(0, 500)}`);
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
                device_ip: device_serial,
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
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── ACTION: subscribe-events ──
    if (action === "subscribe-events") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        
        // Subscribe to alarm/event messages
        const resp = await fetch(`${areaDomain}/api/hpcgw/v1/mq/subscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ operationType: "subscribe" }),
          signal: AbortSignal.timeout(15000),
        });

        const result = await resp.json();
        return new Response(
          JSON.stringify({ success: result.errorCode === "0", data: result }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'test', 'sync', 'list-devices', or 'subscribe-events'." }),
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
