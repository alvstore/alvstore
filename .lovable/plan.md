

# Hikvision Employee Sync -- Audit & Fix Plan

## Root Cause Analysis

The employee sync is failing because the `/api/hpcgw/v1/person/synchronize` endpoint requires the **Cloud Attendance Service** subscription on the AppKey. Your AppKey error `0x02401000` confirms: *"The partner of AppKey does not exist for convergence-attendance-user"*. This is a paid/premium module.

**What works:**
- Token acquisition (areaDomain: `apiiind.hik-partner.com`)
- Site discovery (2 sites found)
- Device listing (4 devices, DS-K1T343EFWX is **online**)
- MQ subscription and polling (works, but 0 messages because no new access events happened since subscription)

**What fails:**
- `/person/synchronize` -- requires Cloud Attendance subscription your AppKey lacks
- Fallback to attendance logs -- finds 0 employees because `hikvision_attendance_logs` table is empty (no events ever captured)

**Current state:** `hikvision_employee_mapping` = 0 rows, `hikvision_attendance_logs` = 0 rows, `employees` with `device_employee_code` = 0 rows.

## Solution: ISAPI Passthrough

The DS-K1T343EFWX supports ISAPI commands. Hik-Partner Pro provides `/api/hpcgw/v1/device/isapi` to send ISAPI commands through the cloud to online devices -- no Cloud Attendance subscription needed.

We will:
1. Send `POST /ISAPI/AccessControl/UserInfo/Search` via ISAPI passthrough to get all registered users from the biometric device
2. Map them to `hikvision_employee_mapping` and auto-create `employees` entries

## Implementation

### Edge Function Changes (`supabase/functions/hikvision-sync/index.ts`)

1. **Add `cloudApiIsapi()` helper** -- wraps `/api/hpcgw/v1/device/isapi` to send ISAPI commands to a specific device serial through the cloud gateway

2. **Add `sync-employees-isapi` action** -- new primary employee sync method:
   - Calls `POST /ISAPI/AccessControl/UserInfo/Search?format=json` via ISAPI passthrough
   - Parses `UserInfoSearch.UserInfo[]` response (employeeNo, name, userType)
   - Upserts into `hikvision_employee_mapping`
   - Auto-creates `employees` records for new persons

3. **Update `sync-employees` action** -- change fallback chain:
   - Try 1: ISAPI passthrough (new)
   - Try 2: Cloud `/person/synchronize` (existing, will fail but kept as fallback)
   - Try 3: Attendance logs extraction (existing)

4. **Add `push-employee-to-device` action** -- sync ERP employees TO the device:
   - Calls `POST /ISAPI/AccessControl/UserInfo/Record?format=json` via ISAPI passthrough
   - Sends employee name and code to the biometric device
   - Creates mapping record

5. **Update `full-sync`** to use the new ISAPI-first approach

### No UI Changes Needed

The existing Settings Hikvision stepper already has "Sync Employees" button per device -- it calls `sync-employees` action which we're fixing.

### No Database Changes Needed

All tables (`hikvision_employee_mapping`, `employees`, `hikvision_devices`) already have the right schema.

## Files

```text
EDIT:  supabase/functions/hikvision-sync/index.ts  -- Add ISAPI passthrough + fix sync chain
```

