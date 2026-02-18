
# Fix Device Online Status + Test Sync Actions

## Problem

The Hik-Partner Pro Cloud API returns `deviceOnlineStatus` (integer: 0=offline, 1=online), but the edge function checks `found.isOnline === "1"` -- a field that does not exist in the response. This causes every device to appear offline regardless of actual status.

**Evidence from API logs:**
```json
{"deviceOnlineStatus":0,"deviceSerial":"C29173942",...}
```
The DS-K1T343EFWX (FF6426490) shows "Network: Online" in the Hik-Partner Pro portal, confirming the issue is in our field name mapping.

## Fix 1: Device status field name (`supabase/functions/hikvision-sync/index.ts`)

Three locations need updating:

- **Line 493** (`test` action): Change `found.isOnline === "1"` to check `found.deviceOnlineStatus`
- **Line 498**: Same -- pass correct online status in response
- **Line 574** (`list-devices` import): Change `d.isOnline === "1"` to `d.deviceOnlineStatus`

The field is an integer (1 = online, 0 = offline), so we need: `String(found.deviceOnlineStatus) === "1"` to handle both string and number types safely.

## Fix 2: Device-info should also update status

Lines 602-609: The `device-info` action updates name/model/version but does NOT update the `status` field. Add `status: String(found.deviceOnlineStatus) === "1" ? "active" : "inactive"` to the update.

## Testing Plan

After deploying, test these actions sequentially:
1. `test` with FF6426490 -- verify "online" status
2. `device-info` with FF6426490 -- verify status updated in DB
3. `sync-employees` with FF6426490 -- verify fallback to attendance logs
4. `sync-departments` with FF6426490 -- verify fallback to attendance logs

## Files to Modify

1. `supabase/functions/hikvision-sync/index.ts` -- Fix `deviceOnlineStatus` field references at lines 493, 498, 574, and 603-609
