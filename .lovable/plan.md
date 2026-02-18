

# Fix Hikvision API Integration - Robust MQ Attendance Sync

## Current Issues Found

1. **`mq/offset` fails**: The API requires a `batchId` parameter (from the messages response), but the code passes an empty object `{}`
2. **Wrong event format parsing**: MQ messages use `AccessControllerEvent` format with `majorEventType`/`subEventType`, but code looks for `ACSEvent` with `major`/`minor`
3. **Employee extraction from MQ events**: Since `person/synchronize` requires Cloud Attendance tier (which the current App Key doesn't have), we should extract employee info directly from MQ attendance events as a fallback
4. **No `employeeNoString` extraction from correct path**: The actual data path is `msg.alarmData -> AccessControllerEvent -> employeeNoString`

## Evidence from Logs

The MQ messages ARE flowing successfully. Here is the actual format:
```text
AccessControllerEvent: {
  deviceName: "Access Controller",
  majorEventType: 3,
  subEventType: 112,
  employeeNoString: "...",
  ...
}
```

## Plan

### Step 1: Fix `cloudSyncAttendance` - Pass `batchId` to `mq/offset`

The `mq/messages` response includes `data.batchId`. The `mq/offset` API requires this `batchId` to acknowledge receipt. Currently passing `{}` which causes `LAP000001: batchId must not be blank`.

**Fix**: Extract `batchId` from messages response and pass it to offset call.

### Step 2: Fix Event Parsing for `AccessControllerEvent` Format

The current code looks for:
- `alarmData.ACSEvent` or `alarmData.accessControlEvent` -- WRONG
- `acsEvent.major` / `acsEvent.minor` -- WRONG

The actual MQ format from the device is:
- `alarmData.AccessControllerEvent` -- CORRECT
- `AccessControllerEvent.majorEventType` / `.subEventType` -- CORRECT
- `AccessControllerEvent.employeeNoString` -- CORRECT
- `alarmData.dateTime` for event time -- CORRECT

### Step 3: Add MQ-based Employee Discovery

Since `person/synchronize` requires Cloud Attendance tier (error `0x02401000`), add a new approach:
- When `sync-employees` Cloud API fallback fails, automatically extract employee info from MQ attendance events already stored in `hikvision_attendance_logs`
- Also create employee mappings on-the-fly during attendance sync from MQ events (already partially done, but needs fixing)

### Step 4: Test All Actions Sequentially

After deploying, test in order:
1. `subscribe-events` -- confirm subscription active
2. `sync-attendance` / `poll-messages` -- confirm events parsed and saved
3. `sync-employees` -- confirm fallback extracts employees from attendance logs
4. Verify `mq/offset` succeeds with batchId

---

## Technical Details

### File: `supabase/functions/hikvision-sync/index.ts`

**Change 1 - Fix `mq/offset` (line ~457)**

Before:
```typescript
await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/offset", {});
```

After:
```typescript
await cloudApi(areaDomain, accessToken, "/api/hpcgw/v1/mq/offset", { batchId });
```

The `batchId` comes from the `mq/messages` response: `msgResult.data.batchId`

**Change 2 - Fix event parsing in `cloudSyncAttendance` (lines ~380-410)**

Update the event extraction logic to handle the actual `AccessControllerEvent` format:
- Check `alarmData.AccessControllerEvent` in addition to `ACSEvent`
- Use `majorEventType` / `subEventType` instead of `major` / `minor`
- Extract `employeeNoString` from `AccessControllerEvent`
- Use `alarmData.dateTime` as primary event time

**Change 3 - Add employee extraction fallback in `sync-employees` (lines ~820-830)**

When Cloud API `person/synchronize` fails with `0x02401000`, add a third fallback:
- Query existing `hikvision_attendance_logs` for the device
- Extract unique employee codes and names
- Create mappings and employee records from that data

### Testing Sequence

```text
1. Deploy updated edge function
2. Call subscribe-events -> verify subscription
3. Call sync-attendance for FF6426490 -> verify events parsed and batchId offset works
4. Call sync-employees for FF6426490 -> verify fallback extracts from attendance logs
5. Check hikvision_attendance_logs table for new records
6. Check hikvision_employee_mapping table for auto-created mappings
```

