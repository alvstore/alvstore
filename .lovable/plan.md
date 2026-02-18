

# Robust Fix: Switch from Transparent ISAPI to Cloud Attendance APIs

## Root Cause (Final)

Error `LAP035001: RESOURCE_NOT_OPEN` means the **transparent ISAPI proxy** is not enabled for device FF6426490. The device IS accessible under your account, but transparent ISAPI commands are blocked because the "cloud enable" feature hasn't been activated for this device type.

This is different from the previous "device not belong to account" error. The device shows up in `device/list` and is online, but ISAPI passthrough is not allowed.

## Solution Overview

Stop relying on transparent ISAPI proxy calls and instead use the **dedicated Cloud Attendance APIs** provided by Hik-Partner Pro, which are designed specifically for access control devices like the DS-K1T343EFWX. These APIs work at the cloud platform level and do not require transparent ISAPI to be enabled.

## Step-by-Step Implementation

### Step 1: Try enabling ISAPI access (optional first attempt)

Add a new `cloud-enable` action that calls:
- `POST {areaDomain}/api/hpcgw/v1/device/cloud/enable`
- Body: `{ "deviceSerial": "FF6426490", "enable": true }`

If this succeeds, all existing ISAPI-based sync actions will start working. If it fails, we proceed with Step 2.

### Step 2: Add Cloud Attendance API - Sync Persons from Device

Replace ISAPI-based `sync-employees` with the Cloud Attendance approach:

1. **Trigger sync**: `POST {areaDomain}/api/hpcgw/v1/person/synchronize`
   - Body: `{ "deviceSerial": "FF6426490" }`
   - This tells the Hik cloud to pull person data FROM the device TO the platform

2. **Poll progress**: `POST {areaDomain}/api/hpcgw/v1/person/synchronize/progress`
   - Body: `{ "deviceSerial": "FF6426490" }`
   - Wait until progress reaches 100%

3. **Get synced person details**: `POST {areaDomain}/api/hpcgw/v1/person/synchronize/details`
   - Body: `{ "deviceSerial": "FF6426490", "page": 1, "pageSize": 100 }`
   - Returns the list of persons synced from the device
   - Save these to `hikvision_employee_mapping` table

### Step 3: Add Cloud Attendance API - Get Attendance Events

Replace ISAPI-based `sync-attendance` with event subscription:

1. **Subscribe to events**: `POST {areaDomain}/api/hpcgw/v1/mq/subscribe`
   - Body: `{ "eventTypes": ["ACSEvent"] }` (access control events)
   - Only needs to be called once

2. **Poll for messages**: `POST {areaDomain}/api/hpcgw/v1/mq/messages`
   - Long polling (20s timeout if no messages)
   - Returns ACS event notifications including check-in/check-out events
   - Parse `ACSEvent` from `alarmData` JSON

3. **Confirm receipt**: `POST {areaDomain}/api/hpcgw/v1/mq/offset`
   - Acknowledges messages have been processed

### Step 4: Smart fallback logic in the edge function

The edge function will try methods in order:
1. First, try transparent ISAPI (current method)
2. If `LAP035001` (RESOURCE_NOT_OPEN) or `LAP034000` (device not belong), automatically fall back to Cloud Attendance APIs
3. Log which method was used for debugging

### Step 5: Test each API call before deploying

After updating the edge function:
1. Call `cloud-enable` for FF6426490 and log result
2. Call `person/synchronize` and check if sync triggers
3. Poll `person/synchronize/progress` until complete
4. Call `person/synchronize/details` to get employee list
5. Call `mq/subscribe` for ACSEvent
6. Call `mq/messages` to check for attendance events
7. Verify data is saved to database tables

### Step 6: Update UI to show sync method

In the Attendance page Devices tab:
- Show which sync method is active per device (ISAPI vs Cloud API)
- Display clear error messages with suggested fixes
- Add "Enable Cloud Access" button that calls the `cloud-enable` action

---

## Technical Details

### Edge Function Changes (`supabase/functions/hikvision-sync/index.ts`)

**New actions:**

```text
"cloud-enable"
  -> POST {areaDomain}/api/hpcgw/v1/device/cloud/enable
  -> Body: { deviceSerial, enable: true }

"sync-employees" (updated with fallback)
  -> Try ISAPI first: POST AccessControl/UserInfo/Search?format=json
  -> On LAP035001/LAP034000: fall back to Cloud Attendance flow:
     1. POST /api/hpcgw/v1/person/synchronize { deviceSerial }
     2. Poll POST /api/hpcgw/v1/person/synchronize/progress
     3. GET details via POST /api/hpcgw/v1/person/synchronize/details

"sync-attendance" (updated with fallback)
  -> Try ISAPI first: POST AccessControl/AcsEvent?format=json
  -> On LAP035001/LAP034000: fall back to:
     1. POST /api/hpcgw/v1/mq/subscribe { eventTypes: ["ACSEvent"] }
     2. POST /api/hpcgw/v1/mq/messages (long poll)
     3. POST /api/hpcgw/v1/mq/offset (confirm)

"sync-departments" (updated)
  -> Try ISAPI first: GET AccessControl/Department?format=json
  -> On error: extract department info from person/synchronize/details
```

**Error detection for automatic fallback:**

```text
function isResourceNotOpen(error: Error): boolean {
  return error.message.includes("LAP035001") || 
         error.message.includes("RESOURCE_NOT_OPEN") ||
         error.message.includes("LAP034000");
}
```

### Testing Sequence (will be done before applying)

```text
1. cloud-enable FF6426490         -> check if ISAPI gets unlocked
2. test FF6426490                 -> re-test ISAPI after enable
3. person/synchronize FF6426490   -> trigger cloud sync from device
4. person/synchronize/progress    -> wait for completion
5. person/synchronize/details     -> get employee list
6. mq/subscribe ACSEvent          -> subscribe to attendance events
7. mq/messages                    -> poll for recent events
```

### Files to modify
- `supabase/functions/hikvision-sync/index.ts` - Add cloud-enable action, add fallback logic to sync-employees and sync-attendance
- `src/pages/Attendance.tsx` - Add "Enable Cloud Access" button, show sync method per device

