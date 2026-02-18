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

async function getHppToken(): Promise<{ accessToken: string; areaDomain: string }> {
  const appKey = Deno.env.get("HIK_PARTNER_APP_KEY");
  const secretKey = Deno.env.get("HIK_PARTNER_SECRET_KEY");
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
  return { accessToken: result.data.accessToken, areaDomain: result.data.areaDomain };
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Discover ALL sites (installer sites + customer sites)
async function getAllSites(areaDomain: string, accessToken: string): Promise<Array<{ id: string; siteName: string; shareType?: number; isCustomerSite?: boolean }>> {
  console.log("[getAllSites] Fetching installer sites via site/search...");
  const allSites: Array<{ id: string; siteName: string; shareType?: number; isCustomerSite?: boolean }> = [];
  
  // 1. Get installer's own sites via site/search
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const resp = await fetch(`${areaDomain}/api/hpcgw/v1/site/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ page, pageSize: 100 }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await resp.json();
    console.log(`[getAllSites] site/search page ${page}: errorCode=${result.errorCode}, total=${result.data?.total || 0}`);
    if (result.errorCode !== "0") break;
    const rows = result.data?.rows || [];
    for (const site of rows) {
      const shareType = site.sharedInfo?.shareType;
      console.log(`  - Installer Site: ${site.siteName} | ID: ${site.id} | shareType: ${shareType}`);
      allSites.push({ id: site.id, siteName: site.siteName, shareType, isCustomerSite: false });
    }
    const totalPage = result.data?.totalPage || 1;
    hasMore = page < totalPage;
    page++;
  }

  // 2. For each installer site, get customer sites via site/customer/list (v2)
  // The customer/list API requires a siteId and returns customers who the site was shared/handed over to
  // Those customer sites may have additional devices
  console.log("[getAllSites] Fetching customer sites for each installer site...");
  const installerSiteIds = allSites.map(s => s.id);
  
  for (const siteId of installerSiteIds) {
    try {
      const resp = await fetch(`${areaDomain}/api/hpcgw/v2/site/customer/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ siteId, page: 1, pageSize: 100 }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await resp.json();
      console.log(`[getAllSites] customer/list for site ${siteId}: errorCode=${result.errorCode}, raw: ${JSON.stringify(result).substring(0, 500)}`);
      
      if (result.errorCode === "0" && result.data?.rows) {
        for (const customer of result.data.rows) {
          const custSiteId = customer.siteId || customer.id;
          const custSiteName = customer.siteName || customer.hcAccount || `Customer ${custSiteId}`;
          console.log(`  - Customer: ${custSiteName} | siteId: ${custSiteId} | account: ${customer.hcAccount || "N/A"}`);
          // Only add if it's a different site ID than what we already have
          if (custSiteId && !allSites.find(s => s.id === custSiteId)) {
            allSites.push({ id: custSiteId, siteName: custSiteName, isCustomerSite: true });
          }
        }
      }
    } catch (custErr) {
      console.warn(`[getAllSites] customer/list for site ${siteId} failed: ${custErr instanceof Error ? custErr.message : "unknown"}`);
    }
  }

  console.log(`[getAllSites] Total sites discovered: ${allSites.length} (installer + customer)`);
  return allSites;
}

// Checks for Hik-Partner API-level errors in JSON response body
function checkApiError(text: string): void {
  try {
    const parsed = JSON.parse(text);
    // Hik-Partner wraps errors with errorCode at top level
    if (parsed.errorCode && parsed.errorCode !== "0") {
      throw new Error(`Hik API error ${parsed.errorCode}: ${parsed.errorMessage || parsed.message || "Unknown error"}`);
    }
    // ISAPI transparent proxy errors - sometimes nested
    if (parsed.statusCode && parseInt(parsed.statusCode) >= 400) {
      throw new Error(`ISAPI error ${parsed.statusCode}: ${parsed.statusString || parsed.subStatusCode || "Device error"}`);
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Not JSON (could be XML) - that's fine, no error detected
      return;
    }
    throw e; // Re-throw API errors
  }
}

async function isapi(areaDomain: string, accessToken: string, deviceSerial: string, path: string, method = "GET", body?: unknown) {
  console.log(`[isapi] ${method} ${path} | device: ${deviceSerial}`);
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "x-devserial": deviceSerial,
    },
    signal: AbortSignal.timeout(30000),
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${areaDomain}/api/hpcgw/v1/device/transparent/ISAPI/${path}`, opts);
  
  // Clone response so we can read the body for error checking AND return it
  const cloned = resp.clone();
  const text = await cloned.text();
  console.log(`[isapi] Response status: ${resp.status} | body preview: ${text.substring(0, 300)}`);
  
  // Check for API-level errors even when HTTP status is 200
  checkApiError(text);
  
  if (!resp.ok) {
    throw new Error(`ISAPI HTTP ${resp.status}: ${text.substring(0, 500)}`);
  }
  
  return resp;
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
  if (!serial) {
    console.warn("[getDeviceSerial] No device serial found!");
  }
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin (skip for cron calls without auth header)
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
    // ACTION: test
    // ═══════════════════════════════════════════════
    if (action === "test") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        // isapi() now throws on API errors automatically
        const resp = await isapi(areaDomain, accessToken, device_serial, "System/deviceInfo");
        const text = await resp.text();
        await logSync(supabase, device_id, "test_connection", "success", "device_info");
        return jsonResp({ success: true, status: "connected", data: text });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Connection failed";
        console.error(`[test] FAILED: ${errMsg}`);
        await logSync(supabase, device_id, "test_connection", "error", "device_info", 0, errMsg);
        return jsonResp({ success: false, status: "error", error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: site-search (discover all sites)
    // ═══════════════════════════════════════════════
    if (action === "site-search" || action === "test-site-search") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const sites = await getAllSites(areaDomain, accessToken);
        
        // Also try fetching devices with specific siteId if provided
        const debugResults: any = {};
        if (body.test_site_id) {
          console.log(`[site-search] Testing device/list with siteId: ${body.test_site_id}`);
          const resp = await fetch(`${areaDomain}/api/hpcgw/v1/device/list`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ siteId: body.test_site_id, page: 1, pageSize: 100 }),
            signal: AbortSignal.timeout(15000),
          });
          debugResults.deviceListForSite = await resp.json();
          console.log(`[site-search] device/list for siteId ${body.test_site_id}: ${JSON.stringify(debugResults.deviceListForSite).substring(0, 500)}`);
        }
        
        // Also try customer/detail for a site if provided
        if (body.test_site_id) {
          try {
            const resp2 = await fetch(`${areaDomain}/api/hpcgw/v1/site/customer/detail`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
              body: JSON.stringify({ siteId: body.test_site_id }),
              signal: AbortSignal.timeout(15000),
            });
            debugResults.customerDetail = await resp2.json();
            console.log(`[site-search] customer/detail for siteId ${body.test_site_id}: ${JSON.stringify(debugResults.customerDetail).substring(0, 500)}`);
          } catch (_e) { /* ignore */ }
        }
        
        return jsonResp({ success: true, sites, debug: debugResults });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed to search sites";
        console.error(`[site-search] FAILED: ${errMsg}`);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: list-devices (cloud devices from ALL sites)
    // ═══════════════════════════════════════════════
    if (action === "list-devices" || action === "list-cloud-devices") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        
        // Step 1: Discover all sites (including customer sites)
        const sites = await getAllSites(areaDomain, accessToken);
        
        // Step 2: Fetch devices from each site
        const allDevices: any[] = [];
        const siteResults: Array<{ siteId: string; siteName: string; deviceCount: number }> = [];
        
        for (const site of sites) {
          try {
            console.log(`[list-devices] Fetching devices for site: ${site.siteName} (${site.id})`);
            const resp = await fetch(`${areaDomain}/api/hpcgw/v1/device/list`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
              body: JSON.stringify({ siteId: site.id, page: 1, pageSize: 100 }),
              signal: AbortSignal.timeout(15000),
            });
            const result = await resp.json();
            
            if (result.errorCode !== "0") {
              console.warn(`[list-devices] Site ${site.siteName} error: ${result.errorCode}`);
              continue;
            }
            
            const devices = result.data?.rows || [];
            console.log(`[list-devices] Site ${site.siteName}: ${devices.length} devices`);
            
            for (const d of devices) {
              d._siteName = site.siteName;
              d._siteId = site.id;
              console.log(`  - ${d.deviceSerial} | ${d.deviceName} | ${site.siteName} | online: ${d.isOnline}`);
              allDevices.push(d);
            }
            
            siteResults.push({ siteId: site.id, siteName: site.siteName, deviceCount: devices.length });
          } catch (siteErr) {
            console.warn(`[list-devices] Error fetching site ${site.siteName}: ${siteErr instanceof Error ? siteErr.message : "unknown"}`);
          }
        }
        
        // Fallback: if no sites found or no devices, try without siteId
        if (allDevices.length === 0) {
          console.log("[list-devices] No devices from sites, trying without siteId filter...");
          const resp = await fetch(`${areaDomain}/api/hpcgw/v1/device/list`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ page: 1, pageSize: 100 }),
            signal: AbortSignal.timeout(15000),
          });
          const result = await resp.json();
          if (result.errorCode === "0") {
            const devices = result.data?.rows || [];
            console.log(`[list-devices] Fallback: ${devices.length} devices`);
            devices.forEach((d: any) => {
              d._siteName = d.siteName || "Unknown";
              allDevices.push(d);
            });
          }
        }
        
        console.log(`[list-devices] Total devices across all sites: ${allDevices.length}`);
        
        // If action is list-cloud-devices and import flag is set, create/update DB records
        if (action === "list-cloud-devices" && body.import_devices) {
          let imported = 0;
          for (const d of allDevices) {
            const { error } = await supabase.from("hikvision_devices").upsert({
              name: d.deviceName || d.deviceSerial,
              device_serial: d.deviceSerial,
              device_model: d.deviceModel || null,
              ip_address: d.deviceSerial, // Use serial as placeholder IP
              status: d.isOnline === "1" ? "active" : "inactive",
            }, { onConflict: "device_serial" });
            if (!error) imported++;
          }
          return jsonResp({ success: true, devices: allDevices, imported, sites: siteResults });
        }
        
        return jsonResp({ success: true, devices: allDevices, sites: siteResults });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed to list devices";
        console.error(`[list-devices] FAILED: ${errMsg}`);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: device-info
    // ═══════════════════════════════════════════════
    if (action === "device-info") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const resp = await isapi(areaDomain, accessToken, device_serial, "System/deviceInfo");
        const text = await resp.text();

        // Parse XML response
        const getName = (t: string, tag: string) => { const m = t.match(new RegExp(`<${tag}>(.*?)</${tag}>`)); return m ? m[1] : null; };
        const deviceName = getName(text, "deviceName");
        const deviceModel = getName(text, "model");
        const serialNumber = getName(text, "serialNumber");
        const firmwareVersion = getName(text, "firmwareVersion");

        console.log(`[device-info] name: ${deviceName}, model: ${deviceModel}, serial: ${serialNumber}`);

        // Update device record
        if (device_id) {
          await supabase.from("hikvision_devices").update({
            name: deviceName || undefined,
            device_model: deviceModel || null,
            device_version: firmwareVersion || null,
            device_serial: serialNumber || device_serial,
            last_sync_at: new Date().toISOString(),
          }).eq("id", device_id);
        }

        await logSync(supabase, device_id, "device_info_fetched", "success", "device_info");
        return jsonResp({
          success: true,
          device: { deviceName, deviceModel, serialNumber, firmwareVersion },
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
        console.error(`[device-info] FAILED: ${errMsg}`);
        await logSync(supabase, device_id, "device_info_failed", "error", "device_info", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: sync-employees
    // ═══════════════════════════════════════════════
    if (action === "sync-employees") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        let position = 0;
        let totalSynced = 0;
        let hasMore = true;

        while (hasMore) {
          const searchBody = {
            UserInfoSearchCond: {
              searchID: crypto.randomUUID(),
              searchResultPosition: position,
              maxResults: 50,
            },
          };

          console.log(`[sync-employees] Fetching from position ${position}...`);
          // isapi() will throw if API returns an error
          const resp = await isapi(areaDomain, accessToken, device_serial, "AccessControl/UserInfo/Search?format=json", "POST", searchBody);

          const data = await resp.json();
          console.log(`[sync-employees] Raw response keys: ${Object.keys(data).join(", ")}`);
          
          const userList = data?.UserInfoSearch?.UserInfo || [];
          const totalMatches = data?.UserInfoSearch?.totalMatches || 0;
          console.log(`[sync-employees] totalMatches: ${totalMatches}, userList.length: ${userList.length}`);

          if (totalMatches === 0 && position === 0) {
            console.log("[sync-employees] No employees found on device. This could mean the device has no users or credentials issue.");
          }

          for (const user of userList) {
            const employeeCode = user.employeeNo || "";
            const employeeName = user.name || "";
            const cardNo = user.numOfCard > 0 ? (user.CardList?.Card?.[0]?.cardNo || "") : "";

            console.log(`[sync-employees] Processing: ${employeeCode} - ${employeeName}`);

            // Upsert into mapping table
            await supabase.from("hikvision_employee_mapping").upsert({
              device_employee_code: employeeCode,
              device_employee_name: employeeName,
              device_id,
              card_number: cardNo || null,
              department_name: user.Valid?.belongGroup || null,
              synced_at: new Date().toISOString(),
            }, { onConflict: "device_employee_code,device_id" });

            // Auto-create or link ERP employee
            const { data: existingEmp } = await supabase
              .from("employees")
              .select("id")
              .eq("device_employee_code", employeeCode)
              .maybeSingle();

            if (!existingEmp && employeeName) {
              const { data: newEmp } = await supabase.from("employees").insert({
                name: employeeName,
                device_employee_code: employeeCode,
                role: "staff",
                status: "active",
              }).select("id").single();

              if (newEmp) {
                await supabase.from("hikvision_employee_mapping")
                  .update({ erp_employee_id: newEmp.id })
                  .eq("device_employee_code", employeeCode)
                  .eq("device_id", device_id);
              }
            } else if (existingEmp) {
              await supabase.from("hikvision_employee_mapping")
                .update({ erp_employee_id: existingEmp.id })
                .eq("device_employee_code", employeeCode)
                .eq("device_id", device_id);
            }

            totalSynced++;
          }

          position += userList.length;
          hasMore = position < totalMatches && userList.length > 0;
        }

        console.log(`[sync-employees] Completed. Total synced: ${totalSynced}`);
        await logSync(supabase, device_id, "sync_employees_completed", "success", "employee", totalSynced);
        return jsonResp({ success: true, records_synced: totalSynced });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
        console.error(`[sync-employees] FAILED: ${errMsg}`);
        await logSync(supabase, device_id, "sync_employees_failed", "error", "employee", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: sync-departments
    // ═══════════════════════════════════════════════
    if (action === "sync-departments") {
      try {
        const { accessToken, areaDomain } = await getHppToken();

        console.log("[sync-departments] Fetching departments...");
        const resp = await isapi(areaDomain, accessToken, device_serial, "AccessControl/Department?format=json");

        const data = await resp.json();
        console.log(`[sync-departments] Raw response keys: ${Object.keys(data).join(", ")}`);
        
        const deptList = data?.DepartmentList?.Department || data?.Department || [];
        console.log(`[sync-departments] Found ${Array.isArray(deptList) ? deptList.length : 1} departments`);
        
        let synced = 0;

        for (const dept of (Array.isArray(deptList) ? deptList : [deptList])) {
          const deptId = dept.departmentNo?.toString() || dept.id?.toString() || "";
          const deptName = dept.departmentName || dept.name || `Department ${deptId}`;

          if (!deptId) continue;
          console.log(`[sync-departments] Upserting: ${deptId} - ${deptName}`);

          await supabase.from("departments").upsert({
            name: deptName,
            device_department_id: deptId,
            device_id,
          }, { onConflict: "device_department_id,device_id" });
          synced++;
        }

        console.log(`[sync-departments] Completed. Total synced: ${synced}`);
        await logSync(supabase, device_id, "sync_departments_completed", "success", "department", synced);
        return jsonResp({ success: true, records_synced: synced });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
        console.error(`[sync-departments] FAILED: ${errMsg}`);
        await logSync(supabase, device_id, "sync_departments_failed", "error", "department", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: sync-photos
    // ═══════════════════════════════════════════════
    if (action === "sync-photos") {
      try {
        const { accessToken, areaDomain } = await getHppToken();

        // Get mappings that need photo sync
        const { data: mappings } = await supabase
          .from("hikvision_employee_mapping")
          .select("*, erp_employee_id")
          .eq("device_id", device_id)
          .eq("avatar_synced", false)
          .not("erp_employee_id", "is", null);

        console.log(`[sync-photos] Found ${mappings?.length || 0} mappings needing photo sync`);

        let synced = 0;
        for (const mapping of (mappings || [])) {
          try {
            console.log(`[sync-photos] Fetching photo for employee ${mapping.device_employee_code}`);
            
            // Try face search endpoint
            const altBody = {
              UserFaceInfoSearchCond: {
                searchID: crypto.randomUUID(),
                searchResultPosition: 0,
                maxResults: 1,
                employeeNo: mapping.device_employee_code,
              },
            };
            
            try {
              const altResp = await isapi(
                areaDomain, accessToken, device_serial,
                "AccessControl/UserInfo/FaceInfo/Search?format=json", "POST", altBody
              );

              const altData = await altResp.json();
              const faceInfo = altData?.UserFaceInfoSearch?.UserFaceInfo?.[0];
              if (faceInfo?.faceURL) {
                const imgResp = await fetch(faceInfo.faceURL, { signal: AbortSignal.timeout(15000) });
                if (imgResp.ok) {
                  const imgBlob = await imgResp.blob();
                  const imgBuffer = new Uint8Array(await imgBlob.arrayBuffer());
                  const filePath = `avatars/${mapping.erp_employee_id}.jpg`;

                  await supabase.storage.from("uploads").upload(filePath, imgBuffer, {
                    contentType: "image/jpeg",
                    upsert: true,
                  });

                  const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(filePath);
                  await supabase.from("employees").update({ avatar_url: urlData.publicUrl }).eq("id", mapping.erp_employee_id);
                  await supabase.from("hikvision_employee_mapping").update({ avatar_synced: true }).eq("id", mapping.id);
                  synced++;
                  console.log(`[sync-photos] Photo synced for ${mapping.device_employee_code}`);
                }
              } else {
                console.log(`[sync-photos] No face URL for ${mapping.device_employee_code}`);
              }
            } catch (faceErr) {
              console.warn(`[sync-photos] Face search failed for ${mapping.device_employee_code}: ${faceErr instanceof Error ? faceErr.message : "unknown"}`);
            }
          } catch (_photoErr) {
            console.error(`[sync-photos] Error for ${mapping.device_employee_code}:`, _photoErr);
          }
        }

        console.log(`[sync-photos] Completed. Synced: ${synced}`);
        await logSync(supabase, device_id, "sync_photos_completed", "success", "photo", synced);
        return jsonResp({ success: true, records_synced: synced, total_mappings: mappings?.length || 0 });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
        console.error(`[sync-photos] FAILED: ${errMsg}`);
        await logSync(supabase, device_id, "sync_photos_failed", "error", "photo", 0, errMsg);
        return jsonResp({ success: false, error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: sync (attendance) - enhanced
    // ═══════════════════════════════════════════════
    if (action === "sync" || action === "sync-attendance") {
      await logSync(supabase, device_id, "sync_started", "success", "attendance");

      try {
        const { accessToken, areaDomain } = await getHppToken();

        const { data: device } = await supabase
          .from("hikvision_devices")
          .select("last_sync_at, name")
          .eq("id", device_id)
          .single();

        let position = 0;
        let totalSynced = 0;
        let hasMore = true;

        // Get existing mappings
        const { data: mappings } = await supabase
          .from("hikvision_employee_mapping")
          .select("*")
          .eq("device_id", device_id);
        const mappingMap = new Map((mappings || []).map((m: any) => [m.device_employee_code, m]));

        while (hasMore) {
          const searchBody: any = {
            AcsEventCond: {
              searchID: crypto.randomUUID(),
              searchResultPosition: position,
              maxResults: 100,
              major: 0,
              minor: 0,
            },
          };

          if (device?.last_sync_at) {
            searchBody.AcsEventCond.startTime = device.last_sync_at;
          }
          searchBody.AcsEventCond.endTime = new Date().toISOString();

          console.log(`[sync-attendance] Fetching events from position ${position}...`);
          const resp = await isapi(areaDomain, accessToken, device_serial, "AccessControl/AcsEvent?format=json", "POST", searchBody);

          const data = await resp.json();
          const events = data?.AcsEvent?.InfoList || [];
          const totalMatches = data?.AcsEvent?.totalMatches || 0;
          console.log(`[sync-attendance] totalMatches: ${totalMatches}, events.length: ${events.length}`);

          for (const event of events) {
            const employeeCode = event.employeeNoString || event.employeeNo?.toString() || "";
            const employeeName = event.name || "";
            const eventTime = event.time || event.dateTime;
            if (!eventTime) continue;

            let eventType = "access";
            const major = event.major;
            const minor = event.minor;
            if (major === 5 && minor === 75) eventType = "checkin";
            else if (major === 5 && minor === 76) eventType = "checkout";
            else {
              const cardType = event.cardType || event.currentEvent?.cardType;
              if (cardType === 1) eventType = "checkin";
              else if (cardType === 2) eventType = "checkout";
            }

            let mapping = mappingMap.get(employeeCode);
            if (!mapping && employeeCode) {
              const { data: newMapping } = await supabase
                .from("hikvision_employee_mapping")
                .upsert({
                  device_employee_code: employeeCode,
                  device_employee_name: employeeName,
                  device_id,
                  synced_at: new Date().toISOString(),
                }, { onConflict: "device_employee_code,device_id" })
                .select()
                .single();
              mapping = newMapping;
              if (mapping) mappingMap.set(employeeCode, mapping);
            }

            const { error: insertError } = await supabase
              .from("hikvision_attendance_logs")
              .upsert({
                device_id,
                employee_code: employeeCode,
                employee_name: employeeName,
                employee_id: mapping?.erp_employee_id || null,
                device_ip: device_serial,
                device_name: device?.name || "",
                event_time: eventTime,
                event_type: eventType,
                raw_data: event,
              }, { onConflict: "device_id,employee_code,event_time" });

            if (!insertError) totalSynced++;
          }

          position += events.length;
          hasMore = position < totalMatches && events.length > 0;
        }

        await supabase.from("hikvision_devices").update({ last_sync_at: new Date().toISOString() }).eq("id", device_id);
        console.log(`[sync-attendance] Completed. Total synced: ${totalSynced}`);
        await logSync(supabase, device_id, "sync_completed", "success", "attendance", totalSynced);
        return jsonResp({ success: true, records_synced: totalSynced });
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

      for (const subAction of ["device-info", "sync-departments", "sync-employees", "sync-photos", "sync-attendance"]) {
        try {
          console.log(`[full-sync] Running sub-action: ${subAction}`);
          const resp = await fetch(baseUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ action: subAction, device_id, device_serial }),
            signal: AbortSignal.timeout(120000),
          });
          results[subAction] = await resp.json();
          console.log(`[full-sync] ${subAction} result: ${JSON.stringify(results[subAction]).substring(0, 200)}`);
        } catch (e) {
          results[subAction] = { success: false, error: e instanceof Error ? e.message : "Failed" };
          console.error(`[full-sync] ${subAction} FAILED: ${e instanceof Error ? e.message : "unknown"}`);
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
        const resp = await fetch(`${areaDomain}/api/hpcgw/v1/mq/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ operationType: "subscribe" }),
          signal: AbortSignal.timeout(15000),
        });
        const result = await resp.json();
        console.log(`[subscribe-events] result: ${JSON.stringify(result).substring(0, 200)}`);
        return jsonResp({ success: result.errorCode === "0", data: result });
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
          .from("hikvision_employee_mapping")
          .select("*")
          .is("erp_employee_id", null);

        let mapped = 0;
        for (const m of (unmapped || [])) {
          const { data: emp } = await supabase
            .from("employees")
            .select("id")
            .eq("device_employee_code", m.device_employee_code)
            .maybeSingle();

          if (emp) {
            await supabase.from("hikvision_employee_mapping")
              .update({ erp_employee_id: emp.id })
              .eq("id", m.id);
            mapped++;
          }
        }
        console.log(`[auto-map] Mapped ${mapped} of ${unmapped?.length || 0} unmapped entries`);
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
