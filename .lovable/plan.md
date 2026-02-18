

# Fix Hikvision Device Access - Customer Site Integration

## Root Cause

Device FF6426490 is under the **ALVStore** site which is a "Customer Site" in Hik-Partner Pro. The current `device/list` API call does NOT include a `siteId` filter, so it only returns devices from the installer's own sites ("RAJAT LEKHARI" and "Site_919414155987"). ALVStore's devices are excluded.

Evidence:
- `POST /api/hpcgw/v1/device/list` returns 4 devices: C29173942, 714635514, F97500719, Q25759169 -- none from ALVStore
- Transparent ISAPI calls for FF6426490 fail with `LAP034000: device not belong to account`
- ALVStore site ID from portal: `da31347fcdc249809c910ff6c956c479`

## Plan

### Step 1: Add `site-search` action to edge function

Add a new action that calls `POST /api/hpcgw/v1/site/search` to discover all sites (including customer sites). This will return site IDs that can be used to filter the device list.

- Request: `POST {areaDomain}/api/hpcgw/v1/site/search` with `{ page: 1, pageSize: 100 }`
- Response includes `rows[]` with `id`, `siteName`, `sharedInfo.shareType` etc.
- Log all discovered sites for debugging

### Step 2: Modify `list-devices` / `list-cloud-devices` action

Update the device list call to:
1. First call `site/search` to get ALL site IDs
2. For each site, call `device/list` with `{ siteId: siteId, page: 1, pageSize: 100 }` 
3. Merge all devices from all sites into one combined list
4. This ensures ALVStore devices (including FF6426490) are included

### Step 3: Deploy and test site discovery

- Deploy edge function
- Test `site-search` to confirm ALVStore appears with its site ID
- Test `list-cloud-devices` to confirm FF6426490 now appears in the combined device list

### Step 4: Test transparent ISAPI with FF6426490

Once the device is confirmed accessible via the API:
- Test `device-info` action for FF6426490
- Test `sync-employees` action
- Test `sync-departments` action
- Test `sync-attendance` action

If transparent ISAPI still fails for customer site devices, fall back to the Cloud Attendance APIs:
- `POST /api/hpcgw/v1/person/add` (person management)
- `POST /api/hpcgw/v1/acs/privilege/config` (apply privileges)
- `POST /api/hpcgw/v1/person/synchronize` (sync persons)

### Step 5: Update Import from Cloud UI

Update the Attendance page Devices tab:
- "Import from Cloud" now shows devices from ALL sites including customer sites
- Display site name alongside each device
- Pre-select FF6426490 if available

---

## Technical Details

### Edge Function Changes (`supabase/functions/hikvision-sync/index.ts`)

**New helper function: `getAllSites()`**
- Calls `POST {areaDomain}/api/hpcgw/v1/site/search` 
- Returns array of `{ id, siteName, shareType }`
- Logs all discovered sites

**New action: `site-search`**
- Exposes `getAllSites()` result to frontend
- Returns `{ success: true, sites: [...] }`

**Modified action: `list-devices` / `list-cloud-devices`**
- Current code: calls `device/list` once with `{ page: 1, pageSize: 100 }`
- New code: calls `getAllSites()` first, then calls `device/list` for each site using `{ siteId, page: 1, pageSize: 100 }`, merges results
- Falls back to current behavior (no siteId) if site-based listing fails

**Modified action: `device-info` / `sync-employees` / `sync-departments` / `sync-attendance`**
- No changes needed to these -- they use transparent ISAPI which should work once the device is properly registered under the account
- If transparent ISAPI still fails for customer site devices, add a fallback using Cloud Attendance APIs

### Testing Sequence

1. Deploy updated edge function
2. Call `site-search` -- verify ALVStore appears
3. Call `list-cloud-devices` -- verify FF6426490 appears
4. Call `test` with FF6426490 -- verify transparent ISAPI works
5. Call `sync-employees` with FF6426490 -- verify employees sync
6. Call `sync-departments` with FF6426490 -- verify departments sync
7. Call `sync-attendance` with FF6426490 -- verify attendance logs sync

### Fallback: Cloud Attendance APIs

If transparent ISAPI fails for customer site devices despite being listed, the edge function will use dedicated Cloud APIs instead:
- Person list: `POST /api/hpcgw/v1/person/synchronize` (get persons synced to device)
- Attendance events: Use message queue subscription `POST /api/hpcgw/v1/mq/messages` instead of ISAPI AcsEvent search

