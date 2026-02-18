

# Hikvision Full Sync Integration Module

## Overview

This plan extends the existing Hik-Partner Pro Cloud integration to build a complete device-to-ERP synchronization system covering device info, employees, photos/avatars, departments, attendance logs, employee mapping, and automated scheduling.

All ISAPI commands are proxied through the Hik-Partner Pro Cloud gateway (already working) using the transparent API endpoint pattern.

---

## Current State

- Edge function `hikvision-sync` already handles: `test`, `sync` (attendance), `list-devices`, `subscribe-events`
- Device `DS-K1T343EFWX` (serial `FF6426490`) is registered and active in the database
- Tables exist: `hikvision_devices`, `hikvision_attendance_logs`, `hikvision_employee_mapping`, `hikvision_sync_log`
- Hik-Partner Pro API credentials are configured

---

## Database Changes

### 1. New Table: `departments`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Department name |
| device_department_id | text | ID from Hikvision device |
| parent_id | uuid | Self-reference for hierarchy |
| device_id | uuid | Which device synced this |
| created_at | timestamptz | Auto |

RLS: Admin full access, staff/technician can view.

### 2. Alter `employees` table

- Add `avatar_url text` column
- Add `department_id uuid` referencing `departments`
- Add `device_employee_code text` for auto-mapping

### 3. Alter `hikvision_devices` table

- Add `device_model text`
- Add `device_version text`
- Add `device_serial text` (proper column instead of reusing `ip_address`)

### 4. Alter `hikvision_employee_mapping` table

- Add `card_number text`
- Add `department_name text`
- Add `synced_at timestamptz`
- Add `avatar_synced boolean default false`

### 5. Alter `hikvision_sync_log` table

- Add `sync_type text` (device_info, employee, photo, department, attendance)

---

## Edge Function Changes (`hikvision-sync/index.ts`)

Add new actions to the existing edge function:

### Action: `device-info`
- GET `/ISAPI/System/deviceInfo` via transparent proxy
- Parse XML response for device name, model, serial, firmware version
- Update `hikvision_devices` record with fetched info

### Action: `sync-employees`
- POST `/ISAPI/AccessControl/UserInfo/Search?format=json` via transparent proxy
- Iterate through all users (paginated with `searchResultPosition`)
- Upsert into `hikvision_employee_mapping`
- Auto-create `employees` records for unmapped users
- Auto-map by employee code match

### Action: `sync-photos`
- For each mapped employee, GET `/ISAPI/Intelligent/FDLib/FDSearch?format=json` or use the face picture download endpoint via transparent proxy
- Download face image binary
- Upload to storage bucket `uploads` under `avatars/` path
- Update `employees.avatar_url` and `hikvision_employee_mapping.avatar_synced`

### Action: `sync-departments`
- GET `/ISAPI/AccessControl/Department?format=json` via transparent proxy
- Upsert into `departments` table
- Link employees to departments

### Action: `sync-attendance` (enhance existing `sync`)
- Same as current `sync` but with improved pagination (loop until all events fetched)
- Better event type detection (check `major`/`minor` event codes)

### Action: `full-sync`
- Orchestrator that runs: device-info, sync-departments, sync-employees, sync-photos, sync-attendance in sequence
- Returns combined results

---

## Auto-Sync Scheduler (pg_cron)

Set up cron jobs using `pg_cron` + `pg_net`:

| Sync Type | Interval | Action |
|-----------|----------|--------|
| Attendance | Every 5 minutes | `sync-attendance` |
| Employees | Every 12 hours | `sync-employees` |
| Photos | Every 24 hours | `sync-photos` |
| Device Info | Every 24 hours | `device-info` |

Note: 30-second attendance sync is not feasible with cron (minimum 1 minute) and would be excessive for cloud API calls. 5-minute intervals provide near-real-time data without overloading the API.

---

## UI Changes

### Attendance Page (`src/pages/Attendance.tsx`)

Enhance existing tabs:

1. **Devices Tab** - Add "Fetch Device Info" button, show model/version/serial columns
2. **Employee Mapping Tab** - Add "Auto Map" button, "Sync Employees from Device" button, show card number and department
3. **New Tab: Departments** - Show synced departments with hierarchy
4. **Sync Logs Tab** - Add sync_type filter column

### Employees Page (`src/pages/Employees.tsx`)

- Display avatar image in employee table (from `avatar_url`)
- Show department from `departments` table
- Add "Sync from Device" indicator badge

### Settings Page (Hikvision tab)

- Add auto-sync toggle and interval configuration
- Show cron job status

---

## Implementation Order

1. **Database migrations** - New tables, column additions, RLS policies
2. **Edge function rewrite** - Add all new actions (device-info, sync-employees, sync-photos, sync-departments, full-sync)
3. **Attendance page UI** - Enhanced tabs with new sync buttons and department tab
4. **Employees page UI** - Avatar display and department column
5. **Auto-sync setup** - pg_cron jobs for scheduled syncing
6. **Testing** - Test each sync action via the UI

---

## Technical Details

### ISAPI Endpoints (via Transparent Proxy)

All requests go through: `{areaDomain}/api/hpcgw/v1/device/transparent/ISAPI/...`

Headers required:
```text
Authorization: Bearer {accessToken}
x-devserial: {deviceSerial}
Content-Type: application/json
```

Key endpoints:
- Device info: `GET .../System/deviceInfo`
- User search: `POST .../AccessControl/UserInfo/Search?format=json`
- Department list: `GET .../AccessControl/Department?format=json`
- Face picture: `GET .../Intelligent/FDLib/FDSearch?format=json` or `POST .../AccessControl/UserInfo/FaceInfo/Search`
- ACS Events: `POST .../AccessControl/AcsEvent?format=json`

### Photo Storage

- Photos stored in existing `uploads` bucket under `avatars/{employee_id}.jpg`
- Public URL generated and saved to `employees.avatar_url`

### Deduplication Strategy

- Employees: unique on `(device_employee_code, device_id)` in mapping table
- Attendance: unique on `(device_id, employee_code, event_time)` (already exists)
- Departments: unique on `(device_department_id, device_id)`

