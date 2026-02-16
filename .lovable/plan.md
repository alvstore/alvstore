

# ERP-CRM Phase 5: Customer Portal, Notifications & Integration Wiring

Phases 1-4 built all core modules with live data. This phase focuses on customer-facing features, notification plumbing, and connecting the integration settings to actual functionality.

---

## 1. Customer Portal

Customers who log in with the "customer" role currently see an empty sidebar with no accessible pages. This phase creates a dedicated customer experience.

### New Page: `/portal`
A single dashboard page for customers showing:
- Their quotations (fetched by matching `customers.email` to the logged-in user's email, or by a new `customers.user_id` column)
- Their repair tickets (same lookup)
- Their invoices/payments
- Accept/reject quotation actions inline
- Repair status timeline view

### Database Change
- Add `user_id` column (nullable UUID) to `customers` table to link a customer record to an auth user
- Add RLS policy: customers with "customer" role can SELECT their own row from `customers` where `user_id = auth.uid()`
- Add RLS policies on `quotations`, `repair_tickets`, and `payments` so customers can view records linked to their `customer_id`

### Routing
- When a user with "customer" role logs in, redirect them to `/portal` instead of `/`
- Hide all admin/staff sidebar items for customer role; show only Portal, Settings

---

## 2. Email Notifications via Edge Function

### Edge Function: `send-email`
- Accepts: `to`, `subject`, `body` (HTML), `template_id` (optional)
- Uses SMTP credentials stored as secrets (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- If `template_id` is provided, fetches the template from `templates` table and replaces variables
- Returns success/failure

### Trigger Points (called from frontend)
- Quotation created/sent: email customer with quotation link
- Payment received: email receipt
- Repair status update: email customer with new status

### Secrets Required
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

---

## 3. SMS Notifications via Edge Function

### Edge Function: `send-sms`
- Accepts: `phone`, `message`, `template_id` (optional)
- Uses SMS API credentials stored as secrets (SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID, SMS_DLT_ENTITY_ID)
- DLT-compliant: uses registered template IDs
- If `template_id` is provided, fetches template and replaces variables

### Trigger Points
- POS sale completed: SMS receipt to customer (if phone provided)
- Repair status update: SMS to customer
- Payment confirmation: SMS to customer

### Secrets Required
- SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID, SMS_DLT_ENTITY_ID

---

## 4. Integration Settings -- Make Functional

The current IntegrationsTab in Settings shows disabled input fields. This phase makes them functional by:
- Storing integration credentials in the `business_settings` table as a JSONB column (`integrations`)
- When the admin saves credentials, they are written to `business_settings.integrations`
- Edge functions read credentials from `business_settings` at runtime (or better: store as Lovable secrets)

### Database Change
- Add `integrations` JSONB column to `business_settings` (default: `'{}'`)

---

## 5. POS Receipt Printing & Sending

### Receipt View
- After completing a POS sale, show a printable receipt dialog with:
  - Business name and details (from `business_settings`)
  - Item list with GST breakdown
  - Total and payment method
  - Transaction number and date
- Print button (window.print with print-specific CSS)

### Send Receipt
- Email button: calls `send-email` edge function with receipt HTML
- SMS button: calls `send-sms` edge function with receipt summary
- Requires customer selection (optional) in POS to get contact info

---

## 6. PDF Generation for Quotations

### Client-Side PDF
- On the public quotation page, add a working "Download PDF" button
- Use a lightweight approach: open a print-friendly view and trigger `window.print()` (saves as PDF)
- Or use a library like `jspdf` + `html2canvas` for direct PDF download

### No new dependencies preferred
- Use the print-to-PDF approach first (no extra library needed)

---

## Technical Summary

### Database Changes
- Add `user_id` column to `customers` table
- Add `integrations` JSONB column to `business_settings`
- Add RLS policies for customer role on `quotations`, `repair_tickets`, `payments`

### New Files
- `src/pages/CustomerPortal.tsx` -- customer-facing dashboard
- `supabase/functions/send-email/index.ts` -- SMTP email edge function
- `supabase/functions/send-sms/index.ts` -- SMS API edge function

### Modified Files
- `src/App.tsx` -- add `/portal` route, customer redirect logic
- `src/components/layout/AppSidebar.tsx` -- role-based nav filtering
- `src/pages/Settings.tsx` -- functional integration settings
- `src/pages/POS.tsx` -- receipt dialog with print/send
- `src/pages/PublicQuotation.tsx` -- PDF download button

### Secrets Needed
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
- SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID, SMS_DLT_ENTITY_ID

### Implementation Order
1. Customer portal (database + page + routing)
2. Email edge function + send-email integration
3. SMS edge function + send-sms integration
4. Integration settings wiring
5. POS receipt printing and sending
6. Quotation PDF download

