

# Enhanced Hikvision Integration UI/UX

## Overview
Redesign the Hikvision configuration and device management experience. The Settings Hikvision tab will show Cloud API connection status and let admins manage credentials. The Attendance Devices tab will get an enhanced "Import from Cloud" dialog showing site hierarchy, site IDs, and zone info per device. Each device record will store its associated site ID and zone.

## Database Changes

Add `site_id`, `site_name`, and `zone` columns to the `hikvision_devices` table:

```sql
ALTER TABLE public.hikvision_devices
  ADD COLUMN IF NOT EXISTS site_id text,
  ADD COLUMN IF NOT EXISTS site_name text,
  ADD COLUMN IF NOT EXISTS zone text;
```

## Changes to Settings > Hikvision Tab (`src/pages/Settings.tsx`)

Replace the current outdated HikvisionTab (lines 498-532) with a modern Cloud API configuration panel:

- **Connection Status Card**: Shows whether API keys are configured by calling the edge function `site-search` action. Displays a green/red status indicator and the number of accessible sites/devices.
- **API Credentials Section**: Two input fields for App Key and API Secret. Since these are stored as backend secrets (not in `business_settings`), show masked values and a note explaining that credentials are securely stored. Include a "Test Connection" button that calls `site-search` and reports how many sites/devices were found.
- **Default Site ID Field**: Optional field to store a default site ID in `business_settings.integrations.hik_default_site_id`. When set, the system filters device operations to this site.
- **Discovered Sites List**: After testing connection, display a read-only table of all discovered sites (name, ID, type: installer vs customer). The admin can click a site row to set it as default.
- Remove the old local IP/port/username/password fields since they are no longer used (the system uses Cloud API).

## Changes to Attendance > Devices Tab (`src/pages/Attendance.tsx`)

### Enhanced "Import from Cloud" Flow

Replace the current simple `fetchCloudDevices` function with a multi-step dialog (Sheet slide-over):

1. **Step 1 - Fetch Sites**: Calls `list-devices` action. Shows a loading spinner while fetching.
2. **Step 2 - Site + Device List**: Displays results grouped by site. Each group header shows `Site Name | Site ID | Type (installer/customer)`. Under each site, shows a table of devices with columns:
   - Checkbox (for selection)
   - Device Name
   - Serial Number
   - Model
   - Online Status (green/red dot)
   - Already Imported (badge if device serial already exists in `hikvision_devices`)
3. **Step 3 - Import Selected**: Button to import selected devices. Each imported device stores `site_id`, `site_name`, and `zone` from the cloud data.

### Enhanced Device Table

Add two new columns to the registered devices table:
- **Site** - Shows `site_name` (with `site_id` as tooltip)
- **Zone** - Shows zone value, editable inline

### Enhanced Add/Edit Device Sheet

Update the device form (lines 394-407) to include:
- Device Name (existing)
- Device Serial Number (existing)
- Site ID (new - with a "Search Sites" button that fetches available sites and shows a dropdown)
- Site Name (new - auto-populated when site is selected)
- Zone (new - free text field like "Main Entrance", "Floor 2", etc.)

### Edge Function Update (`supabase/functions/hikvision-sync/index.ts`)

Update the `list-devices` / `list-cloud-devices` action response to include `_siteId` and `_siteName` (already present). Update the import logic to save `site_id` and `site_name` to the database when importing devices.

## Technical Details

### Files to Modify

1. **Database migration** - Add `site_id`, `site_name`, `zone` columns to `hikvision_devices`
2. **`src/pages/Settings.tsx`** - Rewrite `HikvisionTab` component (lines 498-532) with Cloud API config UI, connection test, and site discovery
3. **`src/pages/Attendance.tsx`** - Rewrite `fetchCloudDevices` (lines 256-277) with Sheet-based import dialog; update device table (lines 343-392) to show site/zone columns; update form (lines 394-407) with site/zone fields
4. **`supabase/functions/hikvision-sync/index.ts`** - Update import logic (lines 620-633) to save `site_id` and `site_name`

### HikvisionTab New Structure

```text
Card: Hik-Partner Pro Cloud API
  - Status indicator (connected/not configured)
  - App Key input (masked, stored as secret)
  - API Secret input (masked, stored as secret)  
  - [Test Connection] button
  - Result: "Connected - Found X sites, Y devices"

Card: Discovered Sites (shown after test)
  - Table: Site Name | Site ID | Type | Devices Count
  - Click to set as default

Card: Sync Settings
  - Default Site ID (dropdown from discovered sites)
  - Sync Mode (manual/auto)
  - Auto-sync interval
```

### Import from Cloud Sheet Structure

```text
Sheet: Import Devices from Cloud
  Header: "Select devices to add to your ERP"
  
  [Fetching sites and devices... spinner]
  
  Site Group: "ALVStore" (da31347f...) - Customer Site
    [ ] DS-K1T343EFWX  | FF6426490 | Online  | Already imported
    
  Site Group: "RAJAT LEKHARI" (abc123...) - Installer Site  
    [x] House Main Gate | Q25759169 | Online  | New
    [x] ALVSTORE SEC 14 | C29173942 | Online  | New
    
  Zone assignment: [text input per selected device]
  
  [Import X Selected Devices] button
```

