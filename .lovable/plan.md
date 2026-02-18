

# Comprehensive Enhancement Plan: Repair Workflow, Payments, WhatsApp, Notifications, and Cash Management

## 1. Repair Module Overhaul

### 1A. Device-Specific Checklists

The current checklist is a single static list (DEFAULT_CHECKLIST) used for all devices. This needs to change so that selecting "Laptop" shows laptop-specific items, "iPhone" shows phone-specific items, etc.

**Changes to `src/pages/JobSheetCreate.tsx`:**
- Replace `DEFAULT_CHECKLIST` with a `DEVICE_CHECKLISTS` map keyed by device type
- Example checklists:
  - **Mobile/iPhone**: Power, Display, Touch, Speaker, Mic, Front/Rear Camera, WiFi, Cellular, Bluetooth, Buttons, Charging Port, Fingerprint, Face ID, Accessories (Charger, Cable, Cover, SIM, Memory Card)
  - **Laptop**: Power, Display, Keyboard, Trackpad, Speaker, Mic, Webcam, WiFi, Ethernet, Bluetooth, USB Ports, HDMI, Charging Port, Battery Health, Hinge, Fan Noise, Accessories (Charger, Bag, Mouse)
  - **Tablet**: Power, Display, Touch, Speaker, Mic, Camera, WiFi, Cellular, Bluetooth, Buttons, Charging Port, Stylus Support, Accessories
  - **Desktop**: Power, Monitor Output, Keyboard, Mouse, Speaker, USB Ports, Ethernet, WiFi, Fan/Cooling, Accessories
- When user selects `device_type`, auto-load the matching checklist
- Improve checklist UI: use a table-style layout with colored status pills (Yes = green, No = red, N/A = gray) instead of small badges
- Add category progress bars with percentage completion
- Keep the smart "Device turns ON = No" auto-set logic

### 1B. Estimated Cost and Actual Cost Tracking

**Database migration -- add columns to `job_sheets`:**
```sql
ALTER TABLE job_sheets ADD COLUMN actual_cost numeric DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN technician_payment numeric DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN technician_payment_status text DEFAULT 'pending';
ALTER TABLE job_sheets ADD COLUMN technician_payment_date timestamptz DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN device_received_at timestamptz DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN device_sent_at timestamptz DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN device_received_by uuid DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN device_sent_by uuid DEFAULT NULL;
```

**Changes to `src/pages/JobSheetDetail.tsx`:**
- Add "Cost & Payment" card showing: Estimated Cost, Actual Cost (editable by technician/admin), Technician Payment, Payment Status
- Add "Device Movement" card showing: Sent to Technician (date/by), Received from Technician (date/by)
- Action buttons: "Send to Technician" (records device_sent_at + audit log), "Receive Device" (records device_received_at + audit log)
- "Record Technician Payment" sheet: amount, payment method, date, notes -- inserts into `payments` table with type "technician_payment"

### 1C. Enterprise Job Sheet PDF

**Create new component `src/components/documents/JobSheetPDF.tsx`:**
- Enterprise-grade PDF template using browser print/CSS
- Header: Company logo + name + address + phone + email + GST number
- Job number, date, priority badge, status badge
- Customer details block: Name, Phone, Email, Address, GST
- Device details block: Brand, Type, Model, Serial, IMEI, Color, Storage
- Pre-repair checklist table: Category | Item | Status (with colored indicators)
- Problem description and staff notes
- Cost section: Estimated Cost, Actual Cost, Technician Payment
- Device movement timeline
- Signature area
- Footer: Terms and conditions, company stamp area
- Add "Download PDF" button to JobSheetDetail page

### 1D. Enhanced UI/UX for Checklist

- Use a proper data table layout instead of simple badges
- Each row: Item name | Yes button | No button | N/A button (toggle-style, colored)
- Category headers with progress percentage and colored progress bar
- Collapsible categories with smooth animation
- Visual indicator for auto-set items (small "Auto" tag)
- Overall completion progress bar at the top

---

## 2. Razorpay India Integration with Payment Links

### 2A. Razorpay Webhook Edge Function

**New file: `supabase/functions/razorpay-webhook/index.ts`**
- Receives Razorpay webhook events
- Validates webhook signature using Razorpay secret
- Handles `payment.captured`, `payment_link.paid` events
- Updates `payments` table status to "completed"
- Updates invoice `paid_amount` and `payment_status`
- Inserts finance_audit_log entry

**New file: `supabase/functions/create-payment-link/index.ts`**
- Creates Razorpay payment link via API
- Accepts: amount, customer name/email/phone, invoice_id, description
- Returns payment link URL
- Stores payment link ID in payments table

**Secrets needed:**
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

**UI Changes:**
- Add "Send Payment Link" button on InvoicePreview page
- Sheet form: amount (pre-filled from balance), customer details (auto-filled)
- Show payment link status in payments list
- Add Razorpay settings section in Settings > Integrations

### 2B. Config

```toml
[functions.razorpay-webhook]
verify_jwt = false

[functions.create-payment-link]
verify_jwt = false
```

---

## 3. WhatsApp API Integration with Chat

### 3A. WhatsApp Edge Function

**New file: `supabase/functions/send-whatsapp/index.ts`**
- Sends WhatsApp messages via configured WhatsApp Business API
- Uses `whatsapp_api_url`, `whatsapp_api_key`, `whatsapp_phone_id` from `business_settings`
- Supports: text messages, template messages, media messages

### 3B. Chat Module Integration

**Changes to `src/pages/Chat.tsx`:**
- Add conversation type "whatsapp" alongside "internal"
- Add WhatsApp icon indicator on WhatsApp conversations
- When sending a message in a WhatsApp conversation, call the `send-whatsapp` edge function
- Add "Send via WhatsApp" button in conversation header for customer chats
- Show delivery status indicators (sent, delivered, read) for WhatsApp messages

**Database migration:**
```sql
ALTER TABLE chat_messages ADD COLUMN channel text DEFAULT 'internal';
ALTER TABLE chat_messages ADD COLUMN whatsapp_message_id text DEFAULT NULL;
ALTER TABLE chat_messages ADD COLUMN delivery_status text DEFAULT NULL;
ALTER TABLE chat_conversations ADD COLUMN channel text DEFAULT 'internal';
ALTER TABLE chat_conversations ADD COLUMN whatsapp_phone text DEFAULT NULL;
```

---

## 4. Notification Bell System

The notification bell in AppHeader currently does nothing -- it's a static icon with a red dot.

### 4A. Database

**New table: `notifications`**
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  link text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

### 4B. UI Changes to `src/components/layout/AppHeader.tsx`

- Bell icon shows unread count badge (number instead of just a dot)
- Click bell opens a dropdown/popover with notification list
- Each notification: icon, title, message, time ago, read/unread indicator
- "Mark all as read" button
- Click notification navigates to linked page
- Realtime subscription for live notification updates
- Generate notifications on key events:
  - New repair job assigned (technician)
  - Repair status changed (admin/customer)
  - Payment received (admin/staff)
  - New chat message (all participants)
  - Invoice created (customer)

### 4C. Notification Helper

**Create `src/lib/notifications.ts`:**
- `createNotification(userId, title, message, type, link)` helper function
- Called from relevant pages when actions occur (job assignment, payment, etc.)

---

## 5. Advanced Daily Cash Management

The current Cash Control tab is very basic -- just opening/closing cash with a difference.

### 5A. Database Enhancement

```sql
ALTER TABLE daily_cash_control ADD COLUMN notes text DEFAULT NULL;
ALTER TABLE daily_cash_control ADD COLUMN denominations jsonb DEFAULT NULL;
ALTER TABLE daily_cash_control ADD COLUMN pos_total numeric DEFAULT 0;
ALTER TABLE daily_cash_control ADD COLUMN manual_income numeric DEFAULT 0;
ALTER TABLE daily_cash_control ADD COLUMN manual_expense numeric DEFAULT 0;
ALTER TABLE daily_cash_control ADD COLUMN expected_closing numeric DEFAULT NULL;
ALTER TABLE daily_cash_control ADD COLUMN status text DEFAULT 'open';
ALTER TABLE daily_cash_control ADD COLUMN closed_by uuid DEFAULT NULL;
ALTER TABLE daily_cash_control ADD COLUMN closed_at timestamptz DEFAULT NULL;
```

### 5B. Enhanced Cash Control UI

**Rewrite `CashControlTab` in `src/pages/Finance.tsx`:**

- **Day Open workflow:**
  - Staff enters opening cash amount
  - Optional denomination breakdown (2000, 500, 200, 100, 50, 20, 10, 5, 2, 1 rupee notes/coins)
  - Auto-calculates total from denominations
  - Status changes to "open"

- **Day Close workflow:**
  - Auto-calculates expected closing: Opening + Day's Income - Day's Expenses
  - Staff enters actual closing cash
  - Optional closing denomination breakdown
  - Shows variance (actual - expected) with color coding (green = match, red = short, yellow = over)
  - Requires notes if variance exceeds threshold
  - Status changes to "closed"
  - Records closed_by and closed_at
  - Inserts audit log entry

- **Dashboard view:**
  - Today's card at top: Status (Open/Closed), Opening, Expected Closing, Actual Closing, Variance
  - 7-day history table with color-coded variance column
  - Variance trend mini-chart

---

## Technical Details

### New Files
```
supabase/functions/razorpay-webhook/index.ts
supabase/functions/create-payment-link/index.ts
supabase/functions/send-whatsapp/index.ts
src/components/documents/JobSheetPDF.tsx
src/lib/notifications.ts
```

### Modified Files
```
src/pages/JobSheetCreate.tsx -- device-specific checklists, enhanced UI
src/pages/JobSheetDetail.tsx -- cost tracking, device movement, PDF button
src/pages/Chat.tsx -- WhatsApp channel support
src/pages/Finance.tsx -- advanced cash control
src/components/layout/AppHeader.tsx -- notification bell with dropdown
src/pages/InvoicePreview.tsx -- Razorpay payment link button
src/pages/Settings.tsx -- Razorpay settings section
```

### Database Migrations
1. `job_sheets` -- add actual_cost, technician_payment, device movement columns
2. `chat_messages` and `chat_conversations` -- add WhatsApp channel columns
3. `notifications` -- new table with RLS and realtime
4. `daily_cash_control` -- add denomination, status, expected_closing columns

### Secrets Required
- `RAZORPAY_KEY_ID` -- Razorpay API Key ID
- `RAZORPAY_KEY_SECRET` -- Razorpay API Secret
- `RAZORPAY_WEBHOOK_SECRET` -- Razorpay Webhook Secret

### Implementation Order
1. Database migrations (all schema changes)
2. Repair module (checklists, costs, device movement, PDF)
3. Notification system (table + AppHeader + helper)
4. Razorpay integration (edge functions + UI)
5. WhatsApp integration (edge function + Chat UI)
6. Advanced cash management (Finance.tsx rewrite)

