import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TokenResponse {
  data?: { accessToken: string; expireTime: number; areaDomain: string };
  errorCode: string;
}

// ═══════════════════════════════════════════════════════════════
// Core helpers
// ═══════════════════════════════════════════════════════════════

async function getHppToken(): Promise<{ accessToken: string; areaDomain: string; expireTime: number }> {
  const appKey = Deno.env.get("HIK_PARTNER_APP_KEY");
  const secretKey = Deno.env.get("HIK_PARTNER_SECRET_KEY");
  if (!appKey || !secretKey) throw new Error("HIK_PARTNER_APP_KEY and HIK_PARTNER_SECRET_KEY must be configured as backend secrets");

  const resp = await fetch("https://api.hik-partner.com/api/hpcgw/v1/token/get", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, secretKey }),
  });
  if (!resp.ok) throw new Error(`Token request failed: HTTP ${resp.status}`);
  const result: TokenResponse = await resp.json();
  if (result.errorCode !== "0" || !result.data?.accessToken) throw new Error(`Token error: ${result.errorCode}`);
  return { accessToken: result.data.accessToken, areaDomain: result.data.areaDomain, expireTime: result.data.expireTime };
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function cloudApi(areaDomain: string, accessToken: string, path: string, body: unknown): Promise<any> {
  const resp = await fetch(`${areaDomain}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const result = await resp.json();
  if (result.errorCode && result.errorCode !== "0") {
    throw new Error(`Cloud API error ${result.errorCode}: ${result.errorMessage || result.message || ""}`);
  }
  return result;
}

// V2.15.0 correct transparent API format:
// POST {areaDomain}/api/hpcgw/v1/device/transparent/{isapi_uri}
// Header: X-Devserial: {deviceSerial}
// Body: direct ISAPI JSON body
async function transparentApi(
  areaDomain: string, accessToken: string, deviceSerial: string,
  isapiPath: string, isapiBody: unknown
): Promise<any> {
  // V2.15.0: DO NOT encodeURIComponent the path — gateway expects raw path segments
  // Strip leading slash for URL concatenation
  const cleanPath = isapiPath.startsWith("/") ? isapiPath.substring(1) : isapiPath;
  const url = `${areaDomain}/api/hpcgw/v1/device/transparent/${cleanPath}`;
  console.log(`[transparentApi] POST ${isapiPath} -> device ${deviceSerial} | URL: ${url}`);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Devserial": deviceSerial,
    },
    body: JSON.stringify(isapiBody),
    signal: AbortSignal.timeout(30000),
  });

  const respText = await resp.text();
  console.log(`[transparentApi] Response status: ${resp.status}, body length: ${respText.length}`);

  let result: any;
  try { result = JSON.parse(respText); } catch {
    throw new Error(`Transparent API returned non-JSON: ${respText.substring(0, 200)}`);
  }

  if (result.errorCode && result.errorCode !== "0") {
    throw new Error(`Transparent API failed: ${result.errorCode} - ${result.errorMessage || result.message || ""}`);
  }
  // Response body may be nested
  let isapiResp = result.data?.body || result.data?.response || result.data || result;
  if (typeof isapiResp === "string") {
    try { isapiResp = JSON.parse(isapiResp); } catch { /* keep string */ }
  }
  return isapiResp;
}

async function getAllSites(areaDomain: string, accessToken: string) {
  const allSites: Array<{ id: string; siteName: string }> = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/site/search", { page, pageSize: 100 });
    const rows = result.data?.rows || [];
    for (const site of rows) {
      allSites.push({ id: site.id, siteName: site.siteName });
    }
    hasMore = page < (result.data?.totalPage || 1);
    page++;
  }
  return allSites;
}

async function getDeviceSerial(supabase: any, body: any): Promise<string> {
  let serial = body.device_serial;
  if (!serial && body.device_id) {
    const { data: dev } = await supabase
      .from("hikvision_devices").select("ip_address, device_serial").eq("id", body.device_id).single();
    serial = dev?.device_serial || dev?.ip_address;
  }
  return serial || "";
}

async function logSync(supabase: any, deviceId: string | null, action: string, status: string, syncType?: string, records?: number, error?: string) {
  await supabase.from("hikvision_sync_log").insert({
    device_id: deviceId, action, status, sync_type: syncType || null,
    records_synced: records || 0, error_message: error || null,
  });
}

function buildDedupeKey(deviceSerial: string, serialNo?: string, employeeNo?: string, eventTime?: string, status?: string, verifyMode?: string): string {
  if (serialNo) return `${deviceSerial}:${serialNo}`;
  return `${deviceSerial}:${employeeNo || ""}:${eventTime || ""}:${status || ""}:${verifyMode || ""}`;
}

// ═══════════════════════════════════════════════════════════════
// ISAPI: Sync employees from device (UserInfo/Search)
// ═══════════════════════════════════════════════════════════════
async function isapiSyncEmployees(
  areaDomain: string, accessToken: string, deviceSerial: string,
  deviceId: string, supabase: any
): Promise<{ success: boolean; records_synced: number; method: string }> {
  let totalSynced = 0;
  let searchPos = 0;
  const pageSize = 30;
  let hasMore = true;

  while (hasMore) {
    const result = await transparentApi(
      areaDomain, accessToken, deviceSerial,
      "/ISAPI/AccessControl/UserInfo/Search?format=json",
      { UserInfoSearchCond: { searchID: `sync-${Date.now()}`, searchResultPosition: searchPos, maxResults: pageSize } }
    );

    const searchResult = result?.UserInfoSearch || result;
    const totalMatches = parseInt(searchResult?.totalMatches || searchResult?.numOfMatches || "0", 10);
    const users: any[] = searchResult?.UserInfo || [];

    if (users.length === 0) {
      if (searchPos === 0) throw new Error("Device returned 0 users via ISAPI UserInfo/Search");
      break;
    }

    for (const user of users) {
      const employeeCode = user.employeeNo || user.employeeID || "";
      const employeeName = user.name || user.userName || "";
      if (!employeeCode) continue;

      await supabase.from("hikvision_employee_mapping").upsert({
        device_employee_code: employeeCode, device_employee_name: employeeName,
        device_id: deviceId, card_number: user.numOfCard ? String(user.numOfCard) : null,
        synced_at: new Date().toISOString(),
      }, { onConflict: "device_employee_code,device_id" });

      const { data: existingEmp } = await supabase
        .from("employees").select("id").eq("device_employee_code", employeeCode).maybeSingle();

      if (!existingEmp && employeeName) {
        const { data: newEmp } = await supabase.from("employees").insert({
          name: employeeName, device_employee_code: employeeCode, role: "staff", status: "active",
        }).select("id").single();
        if (newEmp) {
          await supabase.from("hikvision_employee_mapping")
            .update({ erp_employee_id: newEmp.id }).eq("device_employee_code", employeeCode).eq("device_id", deviceId);
        }
      } else if (existingEmp) {
        await supabase.from("hikvision_employee_mapping")
          .update({ erp_employee_id: existingEmp.id }).eq("device_employee_code", employeeCode).eq("device_id", deviceId);
      }
      totalSynced++;
    }

    searchPos += users.length;
    hasMore = searchPos < totalMatches;
  }

  return { success: true, records_synced: totalSynced, method: "isapi_passthrough" };
}

// ═══════════════════════════════════════════════════════════════
// MQ Polling: Attendance via cloud message queue
// ═══════════════════════════════════════════════════════════════
async function pollMqAttendance(
  areaDomain: string, accessToken: string, deviceSerial: string,
  deviceId: string, supabase: any
): Promise<{ success: boolean; records_synced: number; method: string }> {
  // Subscribe
  try {
    await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/subscribe", { subType: 1, subMode: "all" });
  } catch (e) {
    console.warn(`[pollMq] Subscribe warning: ${e instanceof Error ? e.message : ""}`);
  }

  const { data: mappings } = await supabase.from("hikvision_employee_mapping").select("*").eq("device_id", deviceId);
  const mappingMap = new Map((mappings || []).map((m: any) => [m.device_employee_code, m]));
  const { data: device } = await supabase.from("hikvision_devices").select("name").eq("id", deviceId).single();

  let totalSynced = 0;
  let pollAttempts = 0;

  while (pollAttempts < 3) {
    pollAttempts++;
    try {
      const msgResult = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/messages", {});
      const messages = msgResult.data?.list || msgResult.data?.rows || [];
      if (messages.length === 0) break;

      for (const msg of messages) {
        try {
          let alarmData: any = typeof msg.alarmData === "string" ? JSON.parse(msg.alarmData) : (msg.alarmData || {});
          const msgDevSerial = msg.deviceSerial || alarmData.deviceSerial || "";
          if (deviceSerial && msgDevSerial && msgDevSerial !== deviceSerial) continue;

          const acsEvent = alarmData.AccessControllerEvent || alarmData.ACSEvent || {};
          const eventType = alarmData.eventType || msg.formatType || "";
          const isAccessEvent = eventType.toLowerCase().includes("accesscontroller") ||
            eventType.toLowerCase().includes("acs") || acsEvent.employeeNoString || acsEvent.name;
          if (!isAccessEvent) continue;

          const employeeCode = acsEvent.employeeNoString || acsEvent.employeeNo?.toString() || "";
          const employeeName = acsEvent.name || "";
          const eventTime = alarmData.dateTime || acsEvent.time || acsEvent.dateTime || msg.alarmTime;
          if (!eventTime || !employeeCode) continue;

          const attStatus = acsEvent.attendanceStatus || "";
          const verifyMode = acsEvent.currentVerifyMode || "";
          const serialNo = acsEvent.serialNo?.toString() || "";
          const dedupeKey = buildDedupeKey(msgDevSerial || deviceSerial, serialNo, employeeCode, eventTime, attStatus, verifyMode);

          let mapping = mappingMap.get(employeeCode);
          if (!mapping && employeeCode) {
            const { data: newMapping } = await supabase.from("hikvision_employee_mapping").upsert({
              device_employee_code: employeeCode, device_employee_name: employeeName,
              device_id: deviceId, synced_at: new Date().toISOString(),
            }, { onConflict: "device_employee_code,device_id" }).select().single();
            mapping = newMapping;
            if (mapping) mappingMap.set(employeeCode, mapping);
          }

          const { error: insertError } = await supabase.from("hikvision_attendance_logs").upsert({
            device_id: deviceId, employee_code: employeeCode, employee_name: employeeName,
            employee_id: mapping?.erp_employee_id || null, device_ip: msgDevSerial || deviceSerial,
            device_name: device?.name || "", event_time: eventTime, event_type: "access",
            raw_data: alarmData, dedupe_key: dedupeKey, source_mode: "polling",
            attendance_status: attStatus || null, verify_mode: verifyMode || null,
            event_serial_no: serialNo || null,
          }, { onConflict: "dedupe_key" });

          if (!insertError) totalSynced++;
        } catch { /* skip event */ }
      }

      // Ack batch
      const batchId = msgResult.data?.batchId;
      if (batchId) {
        try { await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/offset", { batchId }); } catch { /* ignore */ }
      }
    } catch { break; }
  }

  await supabase.from("hikvision_devices").update({ last_sync_at: new Date().toISOString() }).eq("id", deviceId);
  return { success: true, records_synced: totalSynced, method: "cloud_mq" };
}

// ═══════════════════════════════════════════════════════════════
// ISAPI Backfill: Historical attendance from device AcsEvent search
// ═══════════════════════════════════════════════════════════════
async function backfillAttendance(
  areaDomain: string, accessToken: string, deviceSerial: string,
  deviceId: string, supabase: any, startTime: string, endTime: string
): Promise<{ success: boolean; records_synced: number; method: string }> {
  const { data: mappings } = await supabase.from("hikvision_employee_mapping").select("*").eq("device_id", deviceId);
  const mappingMap = new Map((mappings || []).map((m: any) => [m.device_employee_code, m]));
  const { data: device } = await supabase.from("hikvision_devices").select("name").eq("id", deviceId).single();

  let totalSynced = 0;
  let searchPos = 0;
  const pageSize = 30;
  let hasMore = true;

  while (hasMore) {
    const result = await transparentApi(
      areaDomain, accessToken, deviceSerial,
      "/ISAPI/AccessControl/AcsEvent?format=json",
      {
        AcsEventCond: {
          searchID: `backfill-${Date.now()}`,
          searchResultPosition: searchPos,
          maxResults: pageSize,
          startTime, endTime,
          eventAttribute: "attendance",
          picEnable: false,
        },
      }
    );

    const searchResult = result?.AcsEvent || result;
    const totalMatches = parseInt(searchResult?.totalMatches || "0", 10);
    const events: any[] = searchResult?.InfoList || [];
    const responseStatus = searchResult?.responseStatusStrg || "";

    if (events.length === 0) break;

    for (const evt of events) {
      const employeeCode = evt.employeeNoString || evt.employeeNo?.toString() || "";
      const employeeName = evt.name || "";
      const eventTime = evt.time || evt.dateTime || "";
      const attStatus = evt.attendanceStatus || "";
      const verifyMode = evt.currentVerifyMode || "";
      const serialNo = evt.serialNo?.toString() || "";
      if (!eventTime || !employeeCode) continue;

      const dedupeKey = buildDedupeKey(deviceSerial, serialNo, employeeCode, eventTime, attStatus, verifyMode);

      let mapping = mappingMap.get(employeeCode);
      if (!mapping && employeeCode) {
        const { data: newMapping } = await supabase.from("hikvision_employee_mapping").upsert({
          device_employee_code: employeeCode, device_employee_name: employeeName,
          device_id: deviceId, synced_at: new Date().toISOString(),
        }, { onConflict: "device_employee_code,device_id" }).select().single();
        mapping = newMapping;
        if (mapping) mappingMap.set(employeeCode, mapping);
      }

      const { error } = await supabase.from("hikvision_attendance_logs").upsert({
        device_id: deviceId, employee_code: employeeCode, employee_name: employeeName,
        employee_id: mapping?.erp_employee_id || null, device_ip: deviceSerial,
        device_name: device?.name || "", event_time: eventTime, event_type: "attendance",
        raw_data: evt, dedupe_key: dedupeKey, source_mode: "backfill",
        attendance_status: attStatus || null, verify_mode: verifyMode || null,
        event_serial_no: serialNo || null,
      }, { onConflict: "dedupe_key" });

      if (!error) totalSynced++;
    }

    searchPos += events.length;
    hasMore = searchPos < totalMatches && responseStatus !== "OK";
  }

  await supabase.from("hikvision_devices").update({ last_sync_at: new Date().toISOString() }).eq("id", deviceId);
  return { success: true, records_synced: totalSynced, method: "isapi_backfill" };
}

// ═══════════════════════════════════════════════════════════════
// Fallback: Extract employees from attendance logs
// ═══════════════════════════════════════════════════════════════
async function syncEmployeesFromLogs(deviceId: string, supabase: any): Promise<{ success: boolean; records_synced: number; method: string }> {
  const { data: logs } = await supabase
    .from("hikvision_attendance_logs").select("employee_code, employee_name")
    .eq("device_id", deviceId).not("employee_code", "is", null).not("employee_code", "eq", "");

  const uniqueEmployees = new Map<string, string>();
  for (const log of (logs || [])) {
    if (log.employee_code && !uniqueEmployees.has(log.employee_code)) {
      uniqueEmployees.set(log.employee_code, log.employee_name || `Employee ${log.employee_code}`);
    }
  }

  let synced = 0;
  for (const [empCode, empName] of uniqueEmployees) {
    await supabase.from("hikvision_employee_mapping").upsert({
      device_employee_code: empCode, device_employee_name: empName,
      device_id: deviceId, synced_at: new Date().toISOString(),
    }, { onConflict: "device_employee_code,device_id" });

    const { data: existingEmp } = await supabase
      .from("employees").select("id").eq("device_employee_code", empCode).maybeSingle();
    if (!existingEmp && empName) {
      const { data: newEmp } = await supabase.from("employees").insert({
        name: empName, device_employee_code: empCode, role: "staff", status: "active",
      }).select("id").single();
      if (newEmp) {
        await supabase.from("hikvision_employee_mapping")
          .update({ erp_employee_id: newEmp.id }).eq("device_employee_code", empCode).eq("device_id", deviceId);
      }
    } else if (existingEmp) {
      await supabase.from("hikvision_employee_mapping")
        .update({ erp_employee_id: existingEmp.id }).eq("device_employee_code", empCode).eq("device_id", deviceId);
    }
    synced++;
  }

  return { success: true, records_synced: synced, method: "attendance_logs_fallback" };
}

// ═══════════════════════════════════════════════════════════════
// Main HTTP Handler
// ═══════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate JWT — no anon key bypass
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResp({ error: "Unauthorized" }, 401);

    const { data: roleData } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) return jsonResp({ error: "Admin access required" }, 403);

    const body = await req.json();
    const { action, device_id } = body;
    console.log(`\n========== ACTION: ${action} | device_id: ${device_id} ==========`);
    const device_serial = await getDeviceSerial(supabase, body);

    // ═══════════════════════════════════════════════
    // ACTION: test-credentials — Validate backend secrets
    // ═══════════════════════════════════════════════
    if (action === "test-credentials") {
      try {
        const tokenInfo = await getHppToken();
        return jsonResp({
          success: true, areaDomain: tokenInfo.areaDomain,
          expireTime: tokenInfo.expireTime,
          message: "Backend credentials are valid. Token acquired.",
        });
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Invalid credentials" });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: test — Cloud device check
    // ═══════════════════════════════════════════════
    if (action === "test") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);

        let found: any = null;
        for (const site of sites) {
          try {
            const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/device/list", { siteId: site.id, page: 1, pageSize: 100 });
            found = (result.data?.rows || []).find((d: any) => d.deviceSerial === device_serial);
            if (found) { found._siteId = site.id; break; }
          } catch { /* continue */ }
        }

        if (found) {
          const isOnline = String(found.deviceOnlineStatus) === "1";
          await logSync(supabase, device_id, "test_connection", "success", "device_info");
          return jsonResp({ success: true, status: isOnline ? "online" : "offline", device: { deviceName: found.deviceName, deviceModel: found.deviceModel, isOnline }, method: "cloud_api" });
        }
        return jsonResp({ success: false, error: `Device ${device_serial} not found in any site` });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Connection failed";
        await logSync(supabase, device_id, "test_connection", "error", "device_info", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: site-search
    // ═══════════════════════════════════════════════
    if (action === "site-search") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);
        return jsonResp({ success: true, sites });
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Failed" });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: list-devices / list-cloud-devices
    // ═══════════════════════════════════════════════
    if (action === "list-devices" || action === "list-cloud-devices") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);
        const allDevices: any[] = [];
        const siteResults: Array<{ siteId: string; siteName: string; deviceCount: number }> = [];

        for (const site of sites) {
          try {
            const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/device/list", { siteId: site.id, page: 1, pageSize: 100 });
            const devices = result.data?.rows || [];
            for (const d of devices) { d._siteName = site.siteName; d._siteId = site.id; allDevices.push(d); }
            siteResults.push({ siteId: site.id, siteName: site.siteName, deviceCount: devices.length });
          } catch { /* continue */ }
        }

        if (action === "list-cloud-devices" && body.import_devices) {
          let imported = 0;
          for (const d of allDevices) {
            const { error } = await supabase.from("hikvision_devices").upsert({
              name: d.deviceName || d.deviceSerial, device_serial: d.deviceSerial,
              device_model: d.deviceModel || null, ip_address: d.deviceSerial,
              status: String(d.deviceOnlineStatus) === "1" ? "active" : "inactive",
              site_id: d._siteId || null, site_name: d._siteName || null,
            }, { onConflict: "device_serial" });
            if (!error) imported++;
          }
          return jsonResp({ success: true, devices: allDevices, imported, sites: siteResults });
        }

        return jsonResp({ success: true, devices: allDevices, sites: siteResults });
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Failed" });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: sync-employees (ISAPI + logs fallback)
    // ═══════════════════════════════════════════════
    if (action === "sync-employees") {
      try {
        const { accessToken, areaDomain } = await getHppToken();

        // Try ISAPI passthrough first
        try {
          const result = await isapiSyncEmployees(areaDomain, accessToken, device_serial, device_id, supabase);
          await logSync(supabase, device_id, "sync_employees_isapi", "success", "employee", result.records_synced);
          return jsonResp(result);
        } catch (isapiErr) {
          console.log(`[sync-employees] ISAPI failed: ${(isapiErr as Error).message}, falling back to logs...`);
          await logSync(supabase, device_id, "sync_employees_isapi_failed", "info", "employee", 0, (isapiErr as Error).message);
        }

        // Fallback to attendance logs extraction
        const result = await syncEmployeesFromLogs(device_id, supabase);
        await logSync(supabase, device_id, "sync_employees_from_logs", "success", "employee", result.records_synced);
        return jsonResp(result);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
        await logSync(supabase, device_id, "sync_employees_failed", "error", "employee", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: sync / sync-attendance — MQ Polling
    // ═══════════════════════════════════════════════
    if (action === "sync" || action === "sync-attendance") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const result = await pollMqAttendance(areaDomain, accessToken, device_serial, device_id, supabase);
        await logSync(supabase, device_id, "sync_attendance_mq", "success", "attendance", result.records_synced);
        return jsonResp(result);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Sync failed";
        await logSync(supabase, device_id, "sync_attendance_failed", "error", "attendance", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: backfill-attendance — ISAPI AcsEvent search
    // ═══════════════════════════════════════════════
    if (action === "backfill-attendance") {
      try {
        const { start_time, end_time } = body;
        if (!start_time || !end_time) return jsonResp({ success: false, error: "start_time and end_time are required" }, 400);

        const { accessToken, areaDomain } = await getHppToken();
        const result = await backfillAttendance(areaDomain, accessToken, device_serial, device_id, supabase, start_time, end_time);
        await logSync(supabase, device_id, "backfill_attendance", "success", "attendance", result.records_synced);
        return jsonResp(result);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Backfill failed";
        await logSync(supabase, device_id, "backfill_attendance_failed", "error", "attendance", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: full-sync
    // ═══════════════════════════════════════════════
    if (action === "full-sync") {
      const results: Record<string, any> = {};
      const baseUrl = `${supabaseUrl}/functions/v1/hikvision-sync`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: authHeader,
      };

      for (const subAction of ["sync-employees", "sync-attendance"]) {
        try {
          const resp = await fetch(baseUrl, {
            method: "POST", headers,
            body: JSON.stringify({ action: subAction, device_id, device_serial }),
            signal: AbortSignal.timeout(120000),
          });
          results[subAction] = await resp.json();
        } catch (e) {
          results[subAction] = { success: false, error: e instanceof Error ? e.message : "Failed" };
        }
      }

      const allSuccess = Object.values(results).every((r: any) => r.success);
      await logSync(supabase, device_id, "full_sync", allSuccess ? "success" : "partial", "full_sync");
      return jsonResp({ success: allSuccess, results });
    }

    // ═══════════════════════════════════════════════
    // ACTION: auto-map
    // ═══════════════════════════════════════════════
    if (action === "auto-map") {
      try {
        const { data: unmapped } = await supabase
          .from("hikvision_employee_mapping").select("*").is("erp_employee_id", null);
        let mapped = 0;
        for (const m of (unmapped || [])) {
          const { data: emp } = await supabase
            .from("employees").select("id").eq("device_employee_code", m.device_employee_code).maybeSingle();
          if (emp) {
            await supabase.from("hikvision_employee_mapping").update({ erp_employee_id: emp.id }).eq("id", m.id);
            mapped++;
          }
        }
        return jsonResp({ success: true, mapped });
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Failed" });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: manual-add-employee
    // ═══════════════════════════════════════════════
    if (action === "manual-add-employee") {
      try {
        const { employee_code, employee_name, erp_employee_id } = body;
        if (!employee_code) return jsonResp({ success: false, error: "employee_code is required" }, 400);
        const name = employee_name || `Employee ${employee_code}`;

        await supabase.from("hikvision_employee_mapping").upsert({
          device_employee_code: employee_code, device_employee_name: name,
          device_id: device_id || null, erp_employee_id: erp_employee_id || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "device_employee_code,device_id" });

        if (erp_employee_id) {
          await supabase.from("employees").update({ device_employee_code: employee_code }).eq("id", erp_employee_id);
        } else {
          const { data: emp } = await supabase.from("employees").select("id").ilike("name", `%${name}%`).maybeSingle();
          if (emp) {
            await supabase.from("hikvision_employee_mapping").update({ erp_employee_id: emp.id })
              .eq("device_employee_code", employee_code).eq("device_id", device_id || null);
            await supabase.from("employees").update({ device_employee_code: employee_code }).eq("id", emp.id);
          }
        }

        await logSync(supabase, device_id, "manual_add_employee", "success", "employee", 1);
        return jsonResp({ success: true, message: `Employee ${name} (${employee_code}) mapped` });
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Failed" });
      }
    }

    return jsonResp({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error(`[FATAL] ${e instanceof Error ? e.message : "Internal error"}`);
    return jsonResp({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
