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

  const resp = await fetch(`${HPP_BASE_URL}/api/hpcgw/v1/token/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, secretKey }),
  });
  if (!resp.ok) throw new Error(`Token request failed: HTTP ${resp.status}`);
  const result: TokenResponse = await resp.json();
  if (result.errorCode !== "0" || !result.data?.accessToken) throw new Error(`Token error: ${result.errorCode}`);
  return { accessToken: result.data.accessToken, areaDomain: result.data.areaDomain };
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isapi(areaDomain: string, accessToken: string, deviceSerial: string, path: string, method = "GET", body?: unknown) {
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
  return fetch(`${areaDomain}/api/hpcgw/v1/device/transparent/ISAPI/${path}`, opts);
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
  return serial || "";
}

async function logSync(supabase: any, deviceId: string | null, action: string, status: string, syncType?: string, records?: number, error?: string) {
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
    const device_serial = await getDeviceSerial(supabase, body);

    // ═══════════════════════════════════════════════
    // ACTION: test
    // ═══════════════════════════════════════════════
    if (action === "test") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const resp = await isapi(areaDomain, accessToken, device_serial, "System/deviceInfo");
        const text = await resp.text();
        if (resp.ok) {
          await logSync(supabase, device_id, "test_connection", "success", "device_info");
          return jsonResp({ success: true, status: "connected", data: text });
        }
        await logSync(supabase, device_id, "test_connection", "error", "device_info", 0, `HTTP ${resp.status}: ${text.substring(0, 500)}`);
        return jsonResp({ success: false, status: "failed", error: `HTTP ${resp.status}: ${text.substring(0, 200)}` });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Connection failed";
        await logSync(supabase, device_id, "test_connection", "error", "device_info", 0, errMsg);
        return jsonResp({ success: false, status: "error", error: errMsg });
      }
    }

    // ═══════════════════════════════════════════════
    // ACTION: list-devices
    // ═══════════════════════════════════════════════
    if (action === "list-devices") {
      try {
        const { accessToken, areaDomain } = await getHppToken();
        const resp = await fetch(`${areaDomain}/api/hpcgw/v1/device/list`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ page: 1, pageSize: 100 }),
          signal: AbortSignal.timeout(15000),
        });
        const result = await resp.json();
        if (result.errorCode !== "0") return jsonResp({ success: false, error: `API error: ${result.errorCode}` });
        return jsonResp({ success: true, devices: result.data?.rows || [] });
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Failed to list devices" });
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
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text.substring(0, 500)}`);

        // Parse XML response
        const getName = (t: string, tag: string) => { const m = t.match(new RegExp(`<${tag}>(.*?)</${tag}>`)); return m ? m[1] : null; };
        const deviceName = getName(text, "deviceName");
        const deviceModel = getName(text, "model");
        const serialNumber = getName(text, "serialNumber");
        const firmwareVersion = getName(text, "firmwareVersion");

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

          const resp = await isapi(areaDomain, accessToken, device_serial, "AccessControl/UserInfo/Search?format=json", "POST", searchBody);
          if (!resp.ok) {
            const errorText = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${errorText.substring(0, 500)}`);
          }

          const data = await resp.json();
          const userList = data?.UserInfoSearch?.UserInfo || [];
          const totalMatches = data?.UserInfoSearch?.totalMatches || 0;

          for (const user of userList) {
            const employeeCode = user.employeeNo || "";
            const employeeName = user.name || "";
            const cardNo = user.numOfCard > 0 ? (user.CardList?.Card?.[0]?.cardNo || "") : "";

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

        await logSync(supabase, device_id, "sync_employees_completed", "success", "employee", totalSynced);
        return jsonResp({ success: true, records_synced: totalSynced });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
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

        // Try JSON endpoint first
        const resp = await isapi(areaDomain, accessToken, device_serial, "AccessControl/Department?format=json");
        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${errorText.substring(0, 500)}`);
        }

        const data = await resp.json();
        const deptList = data?.DepartmentList?.Department || data?.Department || [];
        let synced = 0;

        for (const dept of (Array.isArray(deptList) ? deptList : [deptList])) {
          const deptId = dept.departmentNo?.toString() || dept.id?.toString() || "";
          const deptName = dept.departmentName || dept.name || `Department ${deptId}`;

          if (!deptId) continue;

          await supabase.from("departments").upsert({
            name: deptName,
            device_department_id: deptId,
            device_id,
          }, { onConflict: "device_department_id,device_id" });
          synced++;
        }

        await logSync(supabase, device_id, "sync_departments_completed", "success", "department", synced);
        return jsonResp({ success: true, records_synced: synced });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
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

        let synced = 0;
        for (const mapping of (mappings || [])) {
          try {
            // Search for face data using UserInfo/FaceInfo
            const searchBody = {
              searchResultPosition: 0,
              maxResults: 1,
              faceLibType: "blackFD",
              FDID: "1",
              FPID: mapping.device_employee_code,
            };

            const resp = await isapi(
              areaDomain, accessToken, device_serial,
              "Intelligent/FDLib/FDSearch?format=json", "POST", searchBody
            );

            if (!resp.ok) {
              // Try alternative endpoint
              const altBody = {
                UserFaceInfoSearchCond: {
                  searchID: crypto.randomUUID(),
                  searchResultPosition: 0,
                  maxResults: 1,
                  employeeNo: mapping.device_employee_code,
                },
              };
              const altResp = await isapi(
                areaDomain, accessToken, device_serial,
                "AccessControl/UserInfo/FaceInfo/Search?format=json", "POST", altBody
              );

              if (altResp.ok) {
                const altData = await altResp.json();
                const faceInfo = altData?.UserFaceInfoSearch?.UserFaceInfo?.[0];
                if (faceInfo?.faceURL || faceInfo?.modelData) {
                  // If we get a face URL, download and store it
                  const faceUrl = faceInfo.faceURL;
                  if (faceUrl) {
                    const imgResp = await fetch(faceUrl, { signal: AbortSignal.timeout(15000) });
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
                    }
                  }
                }
              }
              continue;
            }

            const data = await resp.json();
            const matchList = data?.MatchList?.MatchItem || [];
            if (matchList.length > 0 && matchList[0].faceURL) {
              const imgResp = await fetch(matchList[0].faceURL, { signal: AbortSignal.timeout(15000) });
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
              }
            }
          } catch (_photoErr) {
            // Skip individual photo errors, continue with others
            console.error(`Photo sync error for ${mapping.device_employee_code}:`, _photoErr);
          }
        }

        await logSync(supabase, device_id, "sync_photos_completed", "success", "photo", synced);
        return jsonResp({ success: true, records_synced: synced, total_mappings: mappings?.length || 0 });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Failed";
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

          const resp = await isapi(areaDomain, accessToken, device_serial, "AccessControl/AcsEvent?format=json", "POST", searchBody);
          if (!resp.ok) {
            const errorText = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${errorText.substring(0, 500)}`);
          }

          const data = await resp.json();
          const events = data?.AcsEvent?.InfoList || [];
          const totalMatches = data?.AcsEvent?.totalMatches || 0;

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
        await logSync(supabase, device_id, "sync_completed", "success", "attendance", totalSynced);
        return jsonResp({ success: true, records_synced: totalSynced });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Sync failed";
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

      await logSync(supabase, device_id, "full_sync_completed", "success", "full_sync");
      return jsonResp({ success: true, results });
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
        // Match unmapped entries by employee code
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
        return jsonResp({ success: true, mapped });
      } catch (e) {
        return jsonResp({ success: false, error: e instanceof Error ? e.message : "Failed" });
      }
    }

    return jsonResp({ error: "Invalid action" }, 400);
  } catch (e) {
    return jsonResp({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
