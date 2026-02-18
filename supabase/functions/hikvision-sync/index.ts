import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HPP_BASE_URL = "https://api.hik-partner.com";

interface TokenResponse {
  data?: { accessToken: string; expireTime: number; areaDomain: string };
  errorCode: string;
}

// ═══════════════════════════════════════════════════════════════
// Core helpers
// ═══════════════════════════════════════════════════════════════

async function getHppToken(appKeyOverride?: string, secretKeyOverride?: string): Promise<{ accessToken: string; areaDomain: string; expireTime: number }> {
  const appKey = appKeyOverride || Deno.env.get("HIK_PARTNER_APP_KEY");
  const secretKey = secretKeyOverride || Deno.env.get("HIK_PARTNER_SECRET_KEY");
  if (!appKey || !secretKey) throw new Error("HIK_PARTNER_APP_KEY and HIK_PARTNER_SECRET_KEY must be configured");

  console.log("[getHppToken] Requesting token...");
  const resp = await fetch(`${HPP_BASE_URL}/api/hpcgw/v1/token/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, secretKey }),
  });
  if (!resp.ok) throw new Error(`Token request failed: HTTP ${resp.status}`);
  const result: TokenResponse = await resp.json();
  if (result.errorCode !== "0" || !result.data?.accessToken) throw new Error(`Token error: ${result.errorCode}`);
  console.log(`[getHppToken] Token acquired. areaDomain: ${result.data.areaDomain}`);
  return { accessToken: result.data.accessToken, areaDomain: result.data.areaDomain, expireTime: result.data.expireTime };
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function cloudApi(areaDomain: string, accessToken: string, path: string, body: unknown): Promise<any> {
  console.log(`[cloudApi] POST ${path}`);
  const resp = await fetch(`${areaDomain}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const result = await resp.json();
  console.log(`[cloudApi] ${path} response: errorCode=${result.errorCode}, preview: ${JSON.stringify(result).substring(0, 500)}`);
  if (result.errorCode && result.errorCode !== "0") {
    throw new Error(`Cloud API error ${result.errorCode}: ${result.errorMessage || result.message || JSON.stringify(result).substring(0, 200)}`);
  }
  return result;
}

// Discover ALL sites (installer + customer)
async function getAllSites(areaDomain: string, accessToken: string): Promise<Array<{ id: string; siteName: string; shareType?: number; isCustomerSite?: boolean }>> {
  console.log("[getAllSites] Fetching installer sites via site/search...");
  const allSites: Array<{ id: string; siteName: string; shareType?: number; isCustomerSite?: boolean }> = [];

  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/site/search", { page, pageSize: 100 });
    console.log(`[getAllSites] site/search page ${page}: total=${result.data?.total || 0}`);
    const rows = result.data?.rows || [];
    for (const site of rows) {
      const shareType = site.sharedInfo?.shareType;
      console.log(`  - Site: ${site.siteName} | ID: ${site.id} | shareType: ${shareType}`);
      allSites.push({ id: site.id, siteName: site.siteName, shareType, isCustomerSite: false });
    }
    const totalPage = result.data?.totalPage || 1;
    hasMore = page < totalPage;
    page++;
  }

  // Fetch customer sites
  console.log("[getAllSites] Fetching customer sites...");
  const installerSiteIds = allSites.map(s => s.id);
  for (const siteId of installerSiteIds) {
    try {
      const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v2/site/customer/list", { siteId, page: 1, pageSize: 100 });
      if (result.data?.rows) {
        for (const customer of result.data.rows) {
          const custSiteId = customer.siteId || customer.id;
          const custSiteName = customer.siteName || customer.hcAccount || `Customer ${custSiteId}`;
          if (custSiteId && !allSites.find(s => s.id === custSiteId)) {
            allSites.push({ id: custSiteId, siteName: custSiteName, isCustomerSite: true });
          }
        }
      }
    } catch (custErr) {
      console.warn(`[getAllSites] customer/list for site ${siteId} failed: ${custErr instanceof Error ? custErr.message : "unknown"}`);
    }
  }

  console.log(`[getAllSites] Total sites: ${allSites.length}`);
  return allSites;
}

async function getDeviceSerial(supabase: any, body: any): Promise<string> {
  let serial = body.device_serial;
  if (!serial && body.device_id) {
    const { data: dev } = await supabase
      .from("hikvision_devices")
      .select("ip_address, device_serial")
      .eq("id", body.device_id)
      .single();
    serial = dev?.device_serial || dev?.ip_address;
  }
  if (!serial) console.warn("[getDeviceSerial] No device serial found!");
  return serial || "";
}

async function logSync(supabase: any, deviceId: string | null, action: string, status: string, syncType?: string, records?: number, error?: string) {
  console.log(`[logSync] ${action} | status: ${status} | records: ${records || 0} | error: ${error || "none"}`);
  await supabase.from("hikvision_sync_log").insert({
    device_id: deviceId,
    action,
    status,
    sync_type: syncType || null,
    records_synced: records || 0,
    error_message: error || null,
  });
}

// Find device in cloud device/list across all sites
async function findDeviceInCloud(areaDomain: string, accessToken: string, deviceSerial: string, sites: Array<{ id: string; siteName: string }>) {
  for (const site of sites) {
    try {
      const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/device/list", { siteId: site.id, page: 1, pageSize: 100 });
      const devices = result.data?.rows || [];
      const found = devices.find((d: any) => d.deviceSerial === deviceSerial);
      if (found) {
        found._siteId = site.id;
        found._siteName = site.siteName;
        return found;
      }
    } catch { /* continue */ }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Cloud API: Sync employees via person/synchronize
// ═══════════════════════════════════════════════════════════════
async function cloudSyncEmployees(
  areaDomain: string, accessToken: string, deviceSerial: string,
  deviceId: string, supabase: any
): Promise<{ success: boolean; records_synced: number; method: string }> {
  console.log(`[cloudSyncEmployees] Starting person/synchronize for ${deviceSerial}`);

  // Step 1: Trigger person synchronize
  const syncResult = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/person/synchronize", { deviceSerial });
  const syncTaskID = syncResult.data?.syncTaskID || syncResult.data?.taskId || "";
  console.log(`[cloudSyncEmployees] syncTaskID: ${syncTaskID}`);

  if (!syncTaskID) {
    console.warn("[cloudSyncEmployees] No syncTaskID returned");
  }

  // Step 2: Poll progress
  console.log("[cloudSyncEmployees] Polling progress...");
  let progress = 0;
  let attempts = 0;
  while (progress < 100 && attempts < 30) {
    await new Promise(r => setTimeout(r, 2000));
    attempts++;
    try {
      const progressResult = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/person/synchronize/progress", { deviceSerial });
      progress = progressResult.data?.progress ?? progressResult.data?.percent ?? 0;
      console.log(`[cloudSyncEmployees] Progress: ${progress}% (attempt ${attempts})`);
    } catch (e) {
      console.warn(`[cloudSyncEmployees] Progress check failed: ${e instanceof Error ? e.message : "unknown"}`);
      if (attempts > 5) break;
    }
  }

  // Step 3: Fetch details
  console.log("[cloudSyncEmployees] Fetching details...");
  let totalSynced = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const detailsBody: any = { queryType: 0, page, pageSize: 100 };
      if (syncTaskID) detailsBody.syncTaskID = syncTaskID;
      else detailsBody.deviceSerial = deviceSerial;

      const detailsResult = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/person/synchronize/details", detailsBody);
      const persons = detailsResult.data?.rows || detailsResult.data?.list || [];
      const total = detailsResult.data?.total || 0;
      console.log(`[cloudSyncEmployees] Page ${page}: ${persons.length} persons, total: ${total}`);

      for (const person of persons) {
        const employeeCode = person.employeeNo || person.personId || person.id || "";
        const employeeName = person.personName || person.name || "";
        if (!employeeCode) continue;

        await supabase.from("hikvision_employee_mapping").upsert({
          device_employee_code: employeeCode,
          device_employee_name: employeeName,
          device_id: deviceId,
          card_number: person.cardNo || null,
          department_name: person.orgName || person.departmentName || null,
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

      const totalPage = detailsResult.data?.totalPage || Math.ceil(total / 100) || 1;
      hasMore = page < totalPage && persons.length > 0;
      page++;
    } catch (e) {
      console.warn(`[cloudSyncEmployees] Details page ${page} failed: ${e instanceof Error ? e.message : "unknown"}`);
      hasMore = false;
    }
  }

  console.log(`[cloudSyncEmployees] Completed. Total: ${totalSynced}`);
  return { success: true, records_synced: totalSynced, method: "cloud_api" };
}

// ═══════════════════════════════════════════════════════════════
// Cloud API: Attendance via MQ
// ═══════════════════════════════════════════════════════════════
async function cloudSyncAttendance(
  areaDomain: string, accessToken: string, deviceSerial: string,
  deviceId: string, supabase: any
): Promise<{ success: boolean; records_synced: number; method: string }> {
  console.log(`[cloudSyncAttendance] Starting MQ sync for ${deviceSerial}`);

  // Step 1: Subscribe
  try {
    await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/subscribe", { subType: 1, subMode: "all" });
    console.log("[cloudSyncAttendance] MQ subscription active");
  } catch (e) {
    console.warn(`[cloudSyncAttendance] Subscribe warning: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // Step 2: Poll messages
  let totalSynced = 0;
  let pollAttempts = 0;
  const maxPolls = 3;

  const { data: mappings } = await supabase.from("hikvision_employee_mapping").select("*").eq("device_id", deviceId);
  const mappingMap = new Map((mappings || []).map((m: any) => [m.device_employee_code, m]));

  const { data: device } = await supabase.from("hikvision_devices").select("last_sync_at, name").eq("id", deviceId).single();

  while (pollAttempts < maxPolls) {
    pollAttempts++;
    try {
      console.log(`[cloudSyncAttendance] Poll ${pollAttempts}/${maxPolls}...`);
      const msgResult = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/messages", {});

      const messages = msgResult.data?.list || msgResult.data?.rows || [];
      console.log(`[cloudSyncAttendance] Received ${messages.length} messages`);

      if (messages.length === 0) {
        console.log("[cloudSyncAttendance] No more messages");
        break;
      }

      for (const msg of messages) {
        try {
          let alarmData: any = {};
          if (typeof msg.alarmData === "string") {
            try { alarmData = JSON.parse(msg.alarmData); } catch { alarmData = {}; }
          } else {
            alarmData = msg.alarmData || {};
          }

          const msgDeviceSerial = msg.deviceSerial || alarmData.deviceSerial || "";
          if (deviceSerial && msgDeviceSerial && msgDeviceSerial !== deviceSerial) continue;

          // Parse AccessControllerEvent format
          const acsEvent = alarmData.AccessControllerEvent || alarmData.ACSEvent || alarmData.accessControlEvent || {};
          const eventType = alarmData.eventType || msg.formatType || "";

          const isAccessEvent = eventType === "AccessControllerEvent" ||
            eventType.toLowerCase().includes("acs") ||
            eventType.toLowerCase().includes("accesscontroller") ||
            acsEvent.employeeNoString || acsEvent.name;
          if (!isAccessEvent) continue;

          const employeeCode = acsEvent.employeeNoString || acsEvent.employeeNo?.toString() || "";
          const employeeName = acsEvent.name || acsEvent.deviceName || "";
          const eventTime = alarmData.dateTime || alarmData.triggerTime || acsEvent.time || acsEvent.dateTime || msg.alarmTime;

          if (!eventTime || !employeeCode) continue;

          let accessType = "access";
          const major = acsEvent.majorEventType ?? acsEvent.major;
          const minor = acsEvent.subEventType ?? acsEvent.minor;
          if (major === 5 && minor === 75) accessType = "checkin";
          else if (major === 5 && minor === 76) accessType = "checkout";
          else if (major === 3) accessType = "access";
          else {
            const cardType = acsEvent.cardType || acsEvent.currentEvent?.cardType;
            if (cardType === 1) accessType = "checkin";
            else if (cardType === 2) accessType = "checkout";
          }

          // Auto-create mapping if needed
          let mapping = mappingMap.get(employeeCode);
          if (!mapping && employeeCode) {
            const { data: newMapping } = await supabase
              .from("hikvision_employee_mapping")
              .upsert({
                device_employee_code: employeeCode,
                device_employee_name: employeeName,
                device_id: deviceId,
                synced_at: new Date().toISOString(),
              }, { onConflict: "device_employee_code,device_id" })
              .select().single();
            mapping = newMapping;
            if (mapping) mappingMap.set(employeeCode, mapping);
          }

          const { error: insertError } = await supabase
            .from("hikvision_attendance_logs")
            .upsert({
              device_id: deviceId,
              employee_code: employeeCode,
              employee_name: employeeName,
              employee_id: mapping?.erp_employee_id || null,
              device_ip: deviceSerial,
              device_name: device?.name || "",
              event_time: eventTime,
              event_type: accessType,
              raw_data: alarmData,
            }, { onConflict: "device_id,employee_code,event_time" });

          if (!insertError) totalSynced++;
        } catch (evtErr) {
          console.warn(`[cloudSyncAttendance] Event error: ${evtErr instanceof Error ? evtErr.message : "unknown"}`);
        }
      }

      // Step 3: Confirm with batchId
      const batchId = msgResult.data?.batchId;
      if (batchId) {
        try {
          await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/offset", { batchId });
          console.log(`[cloudSyncAttendance] Offset confirmed (batchId: ${batchId})`);
        } catch (offsetErr) {
          console.warn(`[cloudSyncAttendance] Offset failed: ${offsetErr instanceof Error ? offsetErr.message : "unknown"}`);
        }
      }
    } catch (pollErr) {
      console.warn(`[cloudSyncAttendance] Poll failed: ${pollErr instanceof Error ? pollErr.message : "unknown"}`);
      break;
    }
  }

  await supabase.from("hikvision_devices").update({ last_sync_at: new Date().toISOString() }).eq("id", deviceId);
  console.log(`[cloudSyncAttendance] Completed. Total: ${totalSynced}`);
  return { success: true, records_synced: totalSynced, method: "cloud_mq" };
}

// ═══════════════════════════════════════════════════════════════
// Fallback: Extract employees from attendance logs
// ═══════════════════════════════════════════════════════════════
async function syncEmployeesFromLogs(deviceId: string, supabase: any): Promise<{ success: boolean; records_synced: number; method: string }> {
  console.log("[syncEmployeesFromLogs] Extracting from attendance logs...");

  const { data: logs } = await supabase
    .from("hikvision_attendance_logs")
    .select("employee_code, employee_name")
    .eq("device_id", deviceId)
    .not("employee_code", "is", null)
    .not("employee_code", "eq", "");

  const uniqueEmployees = new Map<string, string>();
  for (const log of (logs || [])) {
    if (log.employee_code && !uniqueEmployees.has(log.employee_code)) {
      uniqueEmployees.set(log.employee_code, log.employee_name || `Employee ${log.employee_code}`);
    }
  }

  console.log(`[syncEmployeesFromLogs] Found ${uniqueEmployees.size} unique employees`);
  let synced = 0;

  for (const [empCode, empName] of uniqueEmployees) {
    await supabase.from("hikvision_employee_mapping").upsert({
      device_employee_code: empCode,
      device_employee_name: empName,
      device_id: deviceId,
      synced_at: new Date().toISOString(),
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (authHeader && !authHeader.includes(Deno.env.get("SUPABASE_ANON_KEY") || "___none___")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return jsonResp({ error: "Unauthorized" }, 401);
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleData) return jsonResp({ error: "Admin access required" }, 403);
    }

    const body = await req.json();
    const { action, device_id } = body;
    console.log(`\n========== ACTION: ${action} | device_id: ${device_id} ==========`);
    const device_serial = await getDeviceSerial(supabase, body);
    console.log(`[main] Resolved device_serial: ${device_serial}`);

    // ═══════════════════════════════════════════════
    // ACTION: save-credentials
    // ═══════════════════════════════════════════════
    if (action === "save-credentials") {
      try {
        const { appKey, secretKey } = body;
        if (!appKey || !secretKey) return jsonResp({ success: false, error: "appKey and secretKey are required" }, 400);

        const tokenInfo = await getHppToken(appKey, secretKey);
        return jsonResp({
          success: true,
          areaDomain: tokenInfo.areaDomain,
          expireTime: tokenInfo.expireTime,
          message: "Credentials validated successfully. Token obtained.",
        });
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Invalid credentials" });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: test — Cloud device/list check
    // ═══════════════════════════════════════════════
    if (action === "test") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);
        const found = await findDeviceInCloud(areaDomain, accessToken, device_serial, sites);

        if (found) {
          const isOnline = String(found.deviceOnlineStatus) === "1";
          await logSync(supabase, device_id, "test_connection", "success", "device_info");
          return jsonResp({
            success: true,
            status: isOnline ? "online" : "offline",
            device: { deviceName: found.deviceName, deviceModel: found.deviceModel, isOnline },
            method: "cloud_api",
            message: `Device ${isOnline ? "online" : "offline"} via Cloud API`,
          });
        } else {
          await logSync(supabase, device_id, "test_connection", "error", "device_info", 0, "Device not found in cloud");
          return jsonResp({ success: false, error: `Device ${device_serial} not found in any site` });
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Connection failed";
        console.error(`[test] FAILED: ${errMsg}`);
        await logSync(supabase, device_id, "test_connection", "error", "device_info", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: site-search
    // ═══════════════════════════════════════════════
    if (action === "site-search" || action === "test-site-search") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);
        return jsonResp({ success: true, sites });
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Failed" });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: list-devices
    // ═══════════════════════════════════════════════
    if (action === "list-devices" || action === "list-cloud-devices") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);

        const allDevices: any[] = [];
        const siteResults: Array<{ siteId: string; siteName: string; deviceCount: number }> = [];

        for (const site of sites) {
          try {
            console.log(`[list-devices] Fetching devices for site: ${site.siteName}`);
            const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/device/list", { siteId: site.id, page: 1, pageSize: 100 });
            const devices = result.data?.rows || [];
            for (const d of devices) {
              d._siteName = site.siteName;
              d._siteId = site.id;
              allDevices.push(d);
            }
            siteResults.push({ siteId: site.id, siteName: site.siteName, deviceCount: devices.length });
          } catch (siteErr) {
            console.warn(`[list-devices] Site ${site.siteName} error: ${siteErr instanceof Error ? siteErr.message : "unknown"}`);
          }
        }

        // Fallback: try without siteId
        if (allDevices.length === 0) {
          console.log("[list-devices] No devices from sites, trying without siteId...");
          try {
            const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/device/list", { page: 1, pageSize: 100 });
            const devices = result.data?.rows || [];
            devices.forEach((d: any) => { d._siteName = d.siteName || "Unknown"; allDevices.push(d); });
          } catch { /* ignore */ }
        }

        console.log(`[list-devices] Total: ${allDevices.length} devices`);

        if (action === "list-cloud-devices" && body.import_devices) {
          let imported = 0;
          for (const d of allDevices) {
            const { error } = await supabase.from("hikvision_devices").upsert({
              name: d.deviceName || d.deviceSerial,
              device_serial: d.deviceSerial,
              device_model: d.deviceModel || null,
              ip_address: d.deviceSerial,
              status: String(d.deviceOnlineStatus) === "1" ? "active" : "inactive",
              site_id: d._siteId || null,
              site_name: d._siteName || null,
            }, { onConflict: "device_serial" });
            if (!error) imported++;
          }
          return jsonResp({ success: true, devices: allDevices, imported, sites: siteResults });
        }

        return jsonResp({ success: true, devices: allDevices, sites: siteResults });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
        console.error(`[list-devices] FAILED: ${errMsg}`);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: device-info — Cloud device/list
    // ═══════════════════════════════════════════════
    if (action === "device-info") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);
        const found = await findDeviceInCloud(areaDomain, accessToken, device_serial, sites);

        if (!found) throw new Error("Device not found in cloud device list");

        if (device_id) {
          await supabase.from("hikvision_devices").update({
            name: found.deviceName || undefined,
            device_model: found.deviceModel || null,
            device_version: found.deviceVersion || null,
            device_serial: found.deviceSerial,
            status: String(found.deviceOnlineStatus) === "1" ? "active" : "inactive",
            last_sync_at: new Date().toISOString(),
          }).eq("id", device_id);
        }

        await logSync(supabase, device_id, "device_info_fetched", "success", "device_info");
        return jsonResp({
          success: true,
          device: {
            deviceName: found.deviceName,
            deviceModel: found.deviceModel,
            serialNumber: found.deviceSerial,
            firmwareVersion: found.deviceVersion,
          },
          method: "cloud_api",
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
        console.error(`[device-info] FAILED: ${errMsg}`);
        await logSync(supabase, device_id, "device_info_failed", "error", "device_info", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: sync-employees (Cloud API + logs fallback)
    // ═══════════════════════════════════════════════
    if (action === "sync-employees") {
      try {
        const { accessToken, areaDomain } = await getHppToken();

        try {
          const result = await cloudSyncEmployees(areaDomain, accessToken, device_serial, device_id, supabase);
          await logSync(supabase, device_id, "sync_employees_completed", "success", "employee", result.records_synced);
          return jsonResp(result);
        } catch (cloudErr) {
          console.log(`[sync-employees] Cloud API failed: ${(cloudErr as Error).message}, falling back to attendance logs...`);
          await logSync(supabase, device_id, "sync_employees_cloud_failed", "info", "employee", 0, (cloudErr as Error).message);

          const result = await syncEmployeesFromLogs(device_id, supabase);
          await logSync(supabase, device_id, "sync_employees_from_logs", "success", "employee", result.records_synced);
          return jsonResp(result);
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
        console.error(`[sync-employees] FAILED: ${errMsg}`);
        await logSync(supabase, device_id, "sync_employees_failed", "error", "employee", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: sync-departments (Cloud API + logs fallback)
    // ═══════════════════════════════════════════════
    if (action === "sync-departments") {
      try {
        const { accessToken, areaDomain } = await getHppToken();

        try {
          // Trigger person/synchronize for department data
          const syncResult = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/person/synchronize", { deviceSerial: device_serial });
          const syncTaskID = syncResult.data?.syncTaskID || syncResult.data?.taskId || "";

          // Wait for completion
          let progress = 0;
          let attempts = 0;
          while (progress < 100 && attempts < 15) {
            await new Promise(r => setTimeout(r, 2000));
            attempts++;
            try {
              const progressResult = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/person/synchronize/progress", { deviceSerial: device_serial });
              progress = progressResult.data?.progress ?? 0;
            } catch { break; }
          }

          // Get details with departments
          const detailsBody: any = { queryType: 0, page: 1, pageSize: 100 };
          if (syncTaskID) detailsBody.syncTaskID = syncTaskID;
          else detailsBody.deviceSerial = device_serial;

          const detailsResult = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/person/synchronize/details", detailsBody);
          const persons = detailsResult.data?.rows || detailsResult.data?.list || [];
          const deptNames = new Set<string>();
          for (const p of persons) {
            const deptName = p.orgName || p.departmentName || "";
            if (deptName) deptNames.add(deptName);
          }

          let synced = 0;
          let deptIdx = 1;
          for (const deptName of deptNames) {
            await supabase.from("departments").upsert({
              name: deptName,
              device_department_id: `cloud_${deptIdx}`,
              device_id: device_id,
            }, { onConflict: "device_department_id,device_id" });
            synced++;
            deptIdx++;
          }

          await logSync(supabase, device_id, "sync_departments_completed", "success", "department", synced);
          return jsonResp({ success: true, records_synced: synced, method: "cloud_api" });
        } catch (cloudErr) {
          // Fallback: extract from attendance logs
          console.log(`[sync-departments] Cloud failed: ${(cloudErr as Error).message}, extracting from logs...`);

          const { data: logs } = await supabase
            .from("hikvision_attendance_logs")
            .select("raw_data")
            .eq("device_id", device_id)
            .not("raw_data", "is", null)
            .limit(500);

          const deptNames = new Set<string>();
          for (const log of (logs || [])) {
            const raw = log.raw_data;
            const acsEvent = raw?.AccessControllerEvent || raw?.ACSEvent || {};
            const dept = acsEvent.currentEvent?.departmentName || acsEvent.departmentName || "";
            if (dept) deptNames.add(dept);
          }

          let synced = 0;
          let deptIdx = 1;
          for (const deptName of deptNames) {
            await supabase.from("departments").upsert({
              name: deptName,
              device_department_id: `log_${deptIdx}`,
              device_id: device_id,
            }, { onConflict: "device_department_id,device_id" });
            synced++;
            deptIdx++;
          }

          await logSync(supabase, device_id, "sync_departments_from_logs", "success", "department", synced);
          return jsonResp({ success: true, records_synced: synced, method: "attendance_logs_fallback" });
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
        console.error(`[sync-departments] FAILED: ${errMsg}`);
        await logSync(supabase, device_id, "sync_departments_failed", "error", "department", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: sync-photos — Not available in Cloud-only mode
    // ═══════════════════════════════════════════════
    if (action === "sync-photos") {
      await logSync(supabase, device_id, "sync_photos_skipped", "info", "photo", 0, "Not available in Cloud-only mode");
      return jsonResp({
        success: false,
        error: "Photo sync is not available in Cloud-only mode. Face photos require direct device access (ISAPI) which is not enabled for this integration.",
        method: "unsupported",
      });
    }

    // ═══════════════════════════════════════════════
    // ACTION: sync / sync-attendance — Cloud MQ
    // ═══════════════════════════════════════════════
    if (action === "sync" || action === "sync-attendance") {
      await logSync(supabase, device_id, "sync_started", "success", "attendance");
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const result = await cloudSyncAttendance(areaDomain, accessToken, device_serial, device_id, supabase);
        await logSync(supabase, device_id, "sync_completed", "success", "attendance", result.records_synced);
        return jsonResp(result);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Sync failed";
        console.error(`[sync-attendance] FAILED: ${errMsg}`);
        await logSync(supabase, device_id, "sync_failed", "error", "attendance", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: full-sync
    // ═══════════════════════════════════════════════
    if (action === "full-sync") {
      const results: Record<string, any> = {};
      const baseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/hikvision-sync`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: authHeader || `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      };

      for (const subAction of ["device-info", "sync-departments", "sync-employees", "sync-attendance"]) {
        try {
          console.log(`[full-sync] Running: ${subAction}`);
          const resp = await fetch(baseUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ action: subAction, device_id, device_serial }),
            signal: AbortSignal.timeout(120000),
          });
          results[subAction] = await resp.json();
        } catch (e) {
          results[subAction] = { success: false, error: e instanceof Error ? e.message : "Failed" };
        }
      }

      const allSuccess = Object.values(results).every((r: any) => r.success);
      await logSync(supabase, device_id, "full_sync_completed", allSuccess ? "success" : "partial", "full_sync");
      return jsonResp({ success: allSuccess, results });
    }

    // ═══════════════════════════════════════════════
    // ACTION: subscribe-events
    // ═══════════════════════════════════════════════
    if (action === "subscribe-events") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const result = await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/subscribe", { subType: 1, subMode: "all" });
        return jsonResp({ success: true, data: result });
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Failed" });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: poll-messages
    // ═══════════════════════════════════════════════
    if (action === "poll-messages") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const result = await cloudSyncAttendance(areaDomain, accessToken, device_serial, device_id, supabase);
        await logSync(supabase, device_id, "poll_messages_completed", "success", "attendance", result.records_synced);
        return jsonResp(result);
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Failed" });
      }
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
        console.log(`[auto-map] Mapped ${mapped} of ${unmapped?.length || 0}`);
        return jsonResp({ success: true, mapped });
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
