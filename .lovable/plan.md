

# Hikvision Attendance Sync Module

## Architecture Overview

The Hikvision device at 10.0.1.116 uses the ISAPI protocol. Since the ERP runs on Lovable Cloud, a backend function will proxy requests to the device. The device must be reachable from the internet (via port forwarding or VPN) for automatic sync to work. The module includes device management, attendance log storage, employee mapping, and audit logging.

## 1. Database Changes

### New Tables

**`hikvision_devices`** -- Stores configured Hikvision devices

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | e.g., "Office Controller" |
| ip_address | TEXT NOT NULL | |
| port | INTEGER DEFAULT 80 | |
| username | TEXT | |
| password | TEXT | encrypted in integrations JSONB |
| status | TEXT DEFAULT 'active' | active/inactive |
| last_sync_at | TIMESTAMPTZ | |
| created_by | UUID | |
| created_at | TIMESTAMPTZ | now() |

RLS: Admin only.

**`hikvision_attendance_logs`** -- Raw attendance events from device

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| device_id | UUID FK hikvision_devices | |
| employee_code | TEXT | From device |
| employee_name | TEXT | From device |
| employee_id | UUID | Mapped ERP employee, nullable |
| device_ip | TEXT | |
| device_name | TEXT | |
| event_time | TIMESTAMPTZ NOT NULL | |
| event_type | TEXT | checkin/checkout/access |
| raw_data | JSONB | Full event JSON |
| created_at | TIMESTAMPTZ | now() |

Unique constraint on (device_id, employee_code, event_time) to prevent duplicates. RLS: Admin + Staff SELECT.

**`hikvision_employee_mapping`** -- Maps device employee codes to ERP employees

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| device_employee_code | TEXT NOT NULL | |
| device_employee_name | TEXT | |
| erp_employee_id | UUID FK employees | nullable until mapped |
| device_id | UUID FK hikvision_devices | |
| created_at | TIMESTAMPTZ | now() |

Unique on (device_employee_code, device_id). RLS: Admin only.

**`hikvision_sync_log`** -- Audit trail for sync operations

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| device_id | UUID FK hikvision_devices | |
| action | TEXT | sync_started/sync_completed/sync_failed/test_connection |
| status | TEXT | success/error |
| records_synced | INTEGER DEFAULT 0 | |
| error_message | TEXT | |
| created_at | TIMESTAMPTZ | now() |

RLS: Admin SELECT + INSERT.

Seed default device: "Office Hikvision Controller" at 10.0.1.116:80.

## 2. Backend Function: `hikvision-sync`

A new edge function that handles three operations:

- **test**: Calls `GET /ISAPI/System/deviceInfo` with Digest Auth to verify connectivity
- **sync**: Calls `POST /ISAPI/AccessControl/AcsEvent?format=json` to fetch access events, stores new records, auto-creates employee mappings for unknown codes, and links to `attendance_records` for mapped employees
- **device-info**: Returns device information

The function receives device credentials and IP from the request body (fetched from DB by the caller). It uses HTTP Basic/Digest auth as required by ISAPI.

**Important note**: The device must be reachable from the internet for cloud-based sync. If only accessible on the local network, users should access the ERP from the same network and use browser-based sync as a fallback.

## 3. Enhanced Attendance Page

Restructure `src/pages/Attendance.tsx` with tabs:

**Tab: Attendance** (existing)
- Current manual check-in/check-out and records table (unchanged)

**Tab: Devices** (new, admin only)
- Table of configured Hikvision devices with status indicators (green/red)
- "Add Device" slide-over form: Name, IP, Port, Username, Password
- "Test Connection" button per device
- "Sync Now" button per device
- Last sync timestamp display
- Edit/delete device

**Tab: Sync Logs** (new, admin only)
- Table of all sync operations: Timestamp, Device, Action, Status, Records Synced, Error
- Filter by device and date

**Tab: Employee Mapping** (new, admin only)
- Table of device employee codes mapped to ERP employees
- Auto-populated when sync finds new employee codes
- Dropdown to select ERP employee for each mapping
- "Auto Map" button that matches by employee code

**Tab: Device Logs** (new, admin only)
- Raw attendance events from Hikvision devices
- Filters by device, employee, date range
- Shows event time, employee code/name, event type, device

## 4. File Changes

### New Files
- `supabase/functions/hikvision-sync/index.ts` -- Edge function for device communication

### Modified Files
- `src/pages/Attendance.tsx` -- Add tabs for Devices, Sync Logs, Employee Mapping, Device Logs
- `src/components/layout/AppSidebar.tsx` -- No changes needed (Attendance already under HRM)

### Database Migration
- Create 4 new tables with RLS policies
- Seed default device record
- Update `supabase/config.toml` to register the new edge function

## 5. Implementation Order

1. Database migration -- 4 new tables + RLS + seed data
2. Edge function -- `hikvision-sync` with test/sync operations
3. Attendance page overhaul -- Add 4 new tabs with full CRUD
4. Deploy and test edge function

## Network Considerations

The Hikvision device is on a private network (10.0.1.116). For the cloud-based sync to reach it:
- Option A: Port forward the device to a public IP (configure that IP in the device settings)
- Option B: Use a VPN that makes the device accessible
- Option C: Access the ERP from the same local network (browser-based sync)

The system stores connection details per device, so it works with any accessible IP/hostname.

