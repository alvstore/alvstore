

# Hikvision Hik-Partner Pro V2.15.0 — Full Redesign Plan

## Audit Findings

### Critical: Removed APIs Still in Use
The current edge function calls these endpoints that were **removed in V2.15.0**:
- `POST /api/hpcgw/v1/person/synchronize` (line 331)
- `POST /api/hpcgw/v1/person/synchronize/progress` (line 347)
- `POST /api/hpcgw/v1/person/synchronize/details` (line 368)

These are used in `cloudSyncEmployees()` and `sync-departments` action. They will fail at runtime.

### Critical: Transparent API Format Wrong
Current code (line 153-227) sends a JSON body with `{ url, method, contentType, body }` to `/api/hpcgw/v2/device/transparent`. Per V2.15.0, the correct format is:
- `POST /api/hpcgw/v1/device/transparent/{isapi_uri}` with header `X-Devserial: {serial}`
- The ISAPI path goes in the URL, not the body

### Critical: No Offline Backfill
No ISAPI `AcsEvent` search for historical attendance recovery. The MQ queue only retains ~2 hours. If polling is missed, events are lost permanently.

### Issue: Credentials Not Actually Saved
`save-credentials` (line 637-652) only validates the token — it does NOT save the keys as secrets. The keys must already be pre-configured as `HIK_PARTNER_APP_KEY` / `HIK_PARTNER_SECRET_KEY`. The UI misleads users into thinking entering keys will persist them.

### Issue: Weak Auth Gate
Line 620-626: the auth check skips validation if the Authorization header contains the anon key. This is a security gap.

### Issue: No Webhook Ingestion
V2.15.0 recommends webhook delivery for production. Current code only uses MQ polling (3 attempts max). No webhook endpoint exists.

---

## Redesign Plan

### 1. Rewrite Edge Function: `supabase/functions/hikvision-sync/index.ts`

**Remove:**
- `cloudSyncEmployees()` — uses removed person/synchronize APIs
- `sync-departments` action using person/synchronize
- Incorrect v2/transparent body-wrapping logic

**Fix transparent API:**
```
// V2.15.0 correct format:
POST {areaDomain}/api/hpcgw/v1/device/transparent/ISAPI/AccessControl/UserInfo/Search?format=json
Header: X-Devserial: {deviceSerial}
Body: { UserInfoSearchCond: { ... } }
```

**Add new action: `backfill-attendance`**
- Uses ISAPI transparent channel to call `/ISAPI/AccessControl/AcsEvent?format=json`
- Accepts `start_time`, `end_time` parameters
- Pages through results using `searchResultPosition` + `maxResults`
- Deduplicates using `deviceSerial + serialNo` (primary) or `deviceSerial + employeeNoString + eventTime + attendanceStatus` (fallback)
- Saves raw events to `hikvision_attendance_logs`
- Converts to `attendance_records` for CRM

**Fix auth gate:**
- Always validate JWT via `supabase.auth.getUser()` (no anon key bypass)
- Check admin role

**Fix `save-credentials`:**
- Remove the misleading action entirely — keys are already stored as backend secrets
- Replace with a `test-credentials` action that only validates

**Simplify `sync-employees`:**
- Keep only ISAPI UserInfo/Search (working) + attendance logs fallback
- Remove broken cloud person/synchronize path

**Simplify `sync-departments`:**
- Extract from ISAPI UserInfo/Search `PersonInfoExtends` field
- Fallback to attendance log extraction (keep existing)

### 2. Add Webhook Endpoint: `supabase/functions/hikvision-webhook/index.ts`

New edge function for Hik-Partner Pro webhook push delivery:

**GET handler:** Verification challenge response (if Hik uses one)

**POST handler:**
- Validate `X-Hook-Signature` using HMAC-SHA256: `HMAC(timestamp + "." + batchId, signSecret)`
- Parse access control events from payload
- Extract `employeeNoString`, `dateTime`, `attendanceStatus`, `currentVerifyMode`, `cardNo`
- Deduplicate and insert into `hikvision_attendance_logs`
- Map to `attendance_records` via employee mapping
- Return 200 immediately

**Config:** Add `[functions.hikvision-webhook] verify_jwt = false` to `supabase/config.toml`

### 3. Database Migration

```sql
-- Add dedupe_key to prevent duplicate event insertion
ALTER TABLE hikvision_attendance_logs
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS source_mode text DEFAULT 'polling',
  ADD COLUMN IF NOT EXISTS attendance_status text,
  ADD COLUMN IF NOT EXISTS verify_mode text,
  ADD COLUMN IF NOT EXISTS event_serial_no text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hik_attendance_dedupe
  ON hikvision_attendance_logs (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
```

### 4. Settings UI Redesign: `HikvisionTab` in Settings.tsx

**Step 1 — Credentials:**
- Remove the App Key / Secret Key input fields (they're already backend secrets)
- Show only a "Test Connection" button that calls `test-credentials`
- Display connection status: connected/disconnected badge, area domain, token expiry
- Add note: "API keys are configured as backend secrets. Contact admin to change."

**Step 2 — Sites:** Keep as-is (works correctly)

**Step 3 — Devices:** Keep as-is (works correctly)

**Step 4 — Sync & Monitoring:**
- Remove "Sync Departments" button (uses removed API)
- Rename buttons: "Sync Employees (from Device)", "Poll Attendance (MQ)", "Backfill Attendance (ISAPI)"
- Add date range picker for backfill action
- Add webhook status card showing webhook URL and configuration instructions
- Keep manual employee mapping and sync dashboard

---

## Files Summary

```
REWRITE:  supabase/functions/hikvision-sync/index.ts
CREATE:   supabase/functions/hikvision-webhook/index.ts
MIGRATE:  Add dedupe_key, source_mode, attendance_status columns to hikvision_attendance_logs
EDIT:     src/pages/Settings.tsx (HikvisionTab section only)
EDIT:     supabase/config.toml (add hikvision-webhook function config)
```

## Implementation Order
1. Database migration (new columns)
2. Rewrite edge function (fix transparent API, remove dead code, add backfill)
3. Create webhook endpoint
4. Update Settings UI

