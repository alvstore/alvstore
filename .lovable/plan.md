

# Phase 9: Settings Overhaul, Staff Management, and System Enhancements

This phase consolidates Templates into Settings, adds comprehensive configuration tabs, enhances Staff Directory with Add/Edit capabilities, and fixes the Technician Dashboard to show only assigned data.

---

## 1. Move Templates into Settings

Remove the standalone `/templates` route and page. Instead, add a "Templates" tab inside the Settings page. The existing Templates component logic will be embedded as a sub-tab within Settings.

**Changes:**
- Remove `Templates` from sidebar navigation (SYSTEM category will only have "Settings")
- Remove `/templates` route from `App.tsx`
- Move the Templates UI into a new tab within `Settings.tsx`

---

## 2. Enhanced Settings Page -- New Tabs

The Settings page will be restructured with these tabs (admin-only tabs marked):

| Tab | Content | Access |
|-----|---------|--------|
| Profile | Existing profile + password form | All users |
| Users | Existing user/role management | Admin only |
| Business | Enhanced: company info, logo upload, address, timezone | Admin only |
| GST | GST number, GSTIN, HSN/SAC defaults, tax rates (CGST/SGST/IGST) | Admin only |
| Email/SMTP | SMTP host, port, username, password, from name, from email, test button | Admin only |
| SMS | API URL, API key, sender ID, DLT entity ID, test button | Admin only |
| WhatsApp | WhatsApp Business API URL, API key, phone number ID | Admin only |
| Hikvision | Device IP, username, password, sync settings for facial access | Admin only |
| Templates | Merged from existing Templates page | Admin only |

### Database Changes
Add columns to `business_settings`:
- `timezone` TEXT default 'Asia/Kolkata'
- `gst_state_code` TEXT
- `gst_type` TEXT (regular/composition)
- `default_cgst_rate` NUMERIC default 9
- `default_sgst_rate` NUMERIC default 9
- `default_igst_rate` NUMERIC default 18
- `hsn_default` TEXT
- `whatsapp_api_url` TEXT
- `whatsapp_api_key` TEXT
- `whatsapp_phone_id` TEXT

The existing `integrations` JSONB column already stores SMS/SMTP/Hikvision credentials -- these will now have dedicated UI sections within Settings instead of the generic "Integrations" tab.

---

## 3. Staff Directory Enhancement -- Add/Edit Staff

Currently Staff page is read-only. Add:
- **"Add Staff" button** (Admin only) -- opens a slide-over form
- **"Edit" button** on each staff card (Admin only)
- **Staff creation form fields:**
  - Full Name (required)
  - Email (required -- used to create auth account)
  - Phone
  - Role selection (Admin/Staff/Technician)
  - Password (for new accounts)
- Staff creation will use a backend function to create the auth user and assign the role
- Edit allows changing name, phone, and role

### New Edge Function: `manage-staff`
Creates a new user via Supabase Admin API (service role key), sets their profile, and assigns a role. This is needed because client-side cannot create users for other people.

---

## 4. Technician Dashboard Fix

Currently the Technician Dashboard shows "My Repairs" but an admin user visiting `/technicians` sees their own data (which is empty since admins aren't assigned repairs). 

**Fix:**
- For admin/staff users visiting `/technicians`, show a **Staff Directory of Technicians** with their assigned jobs count
- For technician-role users, show the existing "My Repairs" dashboard with their assigned jobs
- This way admins see an overview of all technicians and their workload

---

## 5. Sidebar Navigation Update

Remove Templates from SYSTEM category. Merge Technicians and Staff into a single "Team" page or keep them separate but ensure the routing logic is clear.

Updated sidebar:
```
SYSTEM
  Settings       (includes Templates, Business, GST, Integrations)
```

The TEAM category stays as-is:
```
TEAM
  Technicians    (admin sees overview, technician sees own repairs)
  Staff          (admin sees directory with add/edit)
```

---

## Technical Summary

### Database Migration
- Add columns to `business_settings`: `timezone`, `gst_state_code`, `gst_type`, `default_cgst_rate`, `default_sgst_rate`, `default_igst_rate`, `hsn_default`, `whatsapp_api_url`, `whatsapp_api_key`, `whatsapp_phone_id`

### New Edge Function
- `supabase/functions/manage-staff/index.ts` -- creates/updates staff users via admin API

### Files to Delete
- None (Templates page kept but route removed; code merged into Settings)

### Files to Modify
- `src/pages/Settings.tsx` -- major rewrite with 9 tabs, merged Templates, logo upload, GST settings, integration sections
- `src/pages/Staff.tsx` -- add "Add Staff" and "Edit" slide-over forms
- `src/pages/TechnicianDashboard.tsx` -- role-aware: admin sees technician overview, technician sees own repairs
- `src/App.tsx` -- remove `/templates` route (redirect to `/settings`)
- `src/components/layout/AppSidebar.tsx` -- remove Templates from SYSTEM

### Implementation Order
1. Database migration (new columns on business_settings)
2. Edge function for staff management
3. Settings page overhaul with all tabs
4. Staff page enhancement with add/edit
5. Technician dashboard role-aware logic
6. Sidebar and routing cleanup

