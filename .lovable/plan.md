

# Fix Hikvision Sync - Device Access and Error Handling

## Problem Identified

The root cause of all sync failures (employees, departments, photos, attendance returning 0 records) is:

**Device FF6426490 (DS-K1T343EFWX) is NOT accessible via the current Hik-Partner Pro API credentials.**

Evidence:
- `list-devices` API returns 4 devices, none with serial FF6426490
- `test` action returns `LAP034000: device not belong to account`
- All sync operations report "success" with 0 records (hiding the real error)

The API credentials access sites "RAJAT LEKHARI" and "Site_919414155987", but the device is under site "ALVStore" which appears to be on a different account or API key.

---

## Step 1: Fix API Credentials (User Action Required)

The user needs to verify that the `HIK_PARTNER_APP_KEY` and `HIK_PARTNER_SECRET_KEY` secrets belong to the account that owns the ALVStore site. If they don't match, update the secrets with the correct credentials.

---

## Step 2: Fix Edge Function Error Handling

The current edge function has a critical bug: it reports "success" even when the Hik-Partner API returns errors. This must be fixed across all actions.

Changes to `supabase/functions/hikvision-sync/index.ts`:

### 2a. Fix `isapi()` helper to detect API-level errors
- After receiving a response, check if the response body contains an `errorCode` field
- If errorCode is present and not "0", treat it as an error and throw

### 2b. Fix `test` action
- Currently returns `success: true` even when device returns LAP034000
- Parse the response body and check for errorCode before reporting success

### 2c. Fix `sync-employees` action  
- Add console.log of the raw ISAPI response for debugging
- If the response contains an error, throw with the error message instead of silently returning 0

### 2d. Fix `sync-departments` action
- Same error detection as sync-employees
- Log the raw response body

### 2e. Fix `sync-attendance` action
- Same error detection pattern

### 2f. Add `list-cloud-devices` action
- New action that calls `list-devices` and returns results
- Also provides an "import" feature to create/update `hikvision_devices` records from cloud device list

---

## Step 3: UI Improvements

### Attendance Page - Devices Tab
- Add "Import from Cloud" button that calls `list-cloud-devices` and shows available cloud devices
- Auto-populate device serial from cloud device list
- Show clear error messages when sync fails (instead of showing 0 records with no error)

### Attendance Page - Employee Mapping Tab
- Add "Sync Employees" button with a device dropdown (only show devices that are verified)
- Show error state clearly when sync returns errors

---

## Step 4: Add Debug Logging

Add `console.log` statements in the edge function for:
- Token acquisition (areaDomain returned)
- Device serial being used for each ISAPI call
- Raw response status and body from each ISAPI call
- Number of records parsed from response

This will make future debugging much easier via function logs.

---

## Implementation Order

1. Update API credentials (user action)
2. Rewrite edge function error handling and add debug logging
3. Deploy and test with correct credentials
4. Update UI to show errors and add cloud device import

---

## Technical Details

### Error Detection Pattern

```text
// After ISAPI call:
const resp = await isapi(...)
const text = await resp.text()

// Check for Hik-Partner API error wrapper
try {
  const parsed = JSON.parse(text)
  if (parsed.errorCode && parsed.errorCode !== "0") {
    throw new Error(`Hik API error: ${parsed.message || parsed.errorCode}`)
  }
} catch (parseErr) {
  // Not JSON - might be XML (deviceInfo), continue normally
}
```

### Cloud Device Import Flow

```text
1. Call list-devices API
2. Return device list to frontend
3. User selects device to import
4. Create/update hikvision_devices record with correct serial
5. Test connection with imported serial
6. If successful, enable sync buttons
```

