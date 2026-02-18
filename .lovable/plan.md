

# Remove ISAPI, Cloud-Only Hikvision Integration

## Overview

Strip out all ISAPI/transparent proxy code from the edge function and keep only the Cloud API path. Update the Settings UI to let admins enter/update App Key and Secret Key directly (saving them as backend secrets). Properly audit all Cloud API calls against the official documentation. Test each action after deployment.

## Changes

### 1. Edge Function Rewrite (`supabase/functions/hikvision-sync/index.ts`)

**Remove entirely:**
- The `isapi()` helper function (lines 141-162)
- The `checkApiError()` function (lines 126-139)
- The `isIsapiBlocked()` helper (lines 43-46)
- All ISAPI-first-then-fallback patterns in `test`, `device-info`, `sync-employees`, `sync-departments`, `sync-photos`, `sync-attendance`
- The `cloud-enable` action (no longer needed)

**Keep and clean up:**
- `getHppToken()` - already correct per docs (POST `/api/hpcgw/v1/token/get` with `appKey` + `secretKey`, returns `accessToken`, `areaDomain`, `expireTime`)
- `cloudApi()` - already correct (uses `Bearer {accessToken}` header)
- `getAllSites()` - already correct (uses `site/search` + `customer/list`)

**Rewrite actions to Cloud-only:**

- **`test`**: Call `device/list` for the device's site. If device serial found and `isOnline === "1"`, return success. No ISAPI needed.

- **`device-info`**: Use `device/list` response data (deviceName, deviceModel, deviceVersion, deviceSerial) to populate the DB. No ISAPI needed.

- **`sync-employees`**: Call `person/synchronize` directly (Cloud Attendance API). If it fails with `0x02401000` (AppKey not authorized for attendance tier), fall back to extracting employees from `hikvision_attendance_logs`. Remove ISAPI path entirely.

- **`sync-attendance`**: Call `mq/subscribe` then `mq/messages` then `mq/offset` directly. No ISAPI fallback. Already working correctly.

- **`sync-departments`**: Call `person/synchronize` then extract department names from `person/synchronize/details`. If person/synchronize fails, extract from attendance logs. No ISAPI path.

- **`sync-photos`**: Since ISAPI is removed and there is no Cloud API for face photos, mark this action as unsupported and return a clear message. Photos can be uploaded manually.

- **`subscribe-events`**: Keep as-is (already Cloud-only).

- **`poll-messages`**: Keep as-is (already Cloud-only).

**Add new action: `save-credentials`**
- Accepts `appKey` and `secretKey` in the request body
- Validates by calling `token/get` with them
- If successful, stores them using Deno env (the actual storage will be via the secrets system, but the action validates first)
- Returns the token info (areaDomain, expireTime) for UI feedback

### 2. Settings UI Update (`src/pages/Settings.tsx`)

**Current state:** App Key and Secret fields are disabled/masked with a note "Stored as secret". No way to update them from the UI.

**New behavior:**
- Show editable App Key and Secret Key input fields (type=password with show/hide toggle)
- Add a "Save & Test" button that:
  1. Calls the edge function `save-credentials` action with the entered values
  2. If token is obtained successfully, shows green status with areaDomain and expireTime
  3. Prompts the user to confirm saving (the actual secret storage happens via the existing secrets system)
- After successful test, display:
  - Area Domain (e.g., `https://apiiind.hik-partner.com`)
  - Token expiry (7 days from now)
  - Number of discovered sites and devices
- Keep the discovered sites table and default site selector as-is

### 3. Attendance UI Minor Updates (`src/pages/Attendance.tsx`)

- Remove references to ISAPI in status messages/tooltips
- Update "Test Connection" button result to show "Cloud API Connected" instead of "ISAPI blocked, Cloud API required"
- Remove the "Enable Cloud Access" button references if any remain
- Sync Photos button should show "Not available (Cloud API)" tooltip

## Technical Details

### Edge function action map (Cloud-only)

```text
test              -> device/list (check device online status)
device-info       -> device/list (get device metadata)
list-devices      -> site/search + device/list per site
site-search       -> site/search + customer/list
sync-employees    -> person/synchronize -> progress -> details (fallback: attendance_logs)
sync-departments  -> person/synchronize -> details (extract dept names; fallback: attendance_logs)
sync-attendance   -> mq/subscribe + mq/messages + mq/offset
sync-photos       -> return "unsupported in Cloud-only mode"
subscribe-events  -> mq/subscribe
poll-messages     -> mq/subscribe + mq/messages + mq/offset
full-sync         -> device-info + sync-departments + sync-employees + sync-attendance
auto-map          -> query DB only (no API call)
save-credentials  -> token/get (validate appKey/secretKey)
```

### API call patterns (per documentation)

All API calls use:
- `POST` method
- `Content-Type: application/json` header
- `Authorization: Bearer {accessToken}` header
- Body as JSON

Token: `POST https://api.hik-partner.com/api/hpcgw/v1/token/get` with `{ appKey, secretKey }`.
All subsequent calls use the returned `areaDomain` as base URL.

### Files to modify

1. `supabase/functions/hikvision-sync/index.ts` - Major rewrite removing all ISAPI code, keeping Cloud API only
2. `src/pages/Settings.tsx` - Update HikvisionTab to allow credential entry and validation
3. `src/pages/Attendance.tsx` - Minor: remove ISAPI references from UI text

### Testing sequence after deployment

```text
1. save-credentials (validate API keys work)
2. list-devices (discover sites + devices)
3. test FF6426490 (verify device online via device/list)
4. device-info FF6426490 (get metadata from device/list)
5. subscribe-events (setup MQ subscription)
6. sync-attendance FF6426490 (poll MQ messages)
7. sync-employees FF6426490 (person/synchronize or attendance_logs fallback)
8. sync-departments FF6426490 (from person details or logs)
```

