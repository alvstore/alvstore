

# Materialize-Style ERP UI Overhaul

## Current State Assessment

The system already has most modules built and functioning with a Materialize-inspired style:
- Dashboard with KPI cards, charts, and recent invoices
- CRM (customer list with avatars, search, CRUD)
- Sales/Quotations (full CRUD, KPI cards, status tabs, convert-to-invoice)
- Invoices (full CRUD, payment recording, progress bars)
- POS, Inventory, Leads, Attendance, Repairs, Finance, Employees, Payroll, Tasks, Audit Logs, Settings

What needs to change to fully match the Materialize reference:

## Phase 1: Invoice and Quotation Preview Pages with Right Action Sidebar

Currently, document detail opens in a side Sheet. The Materialize template uses a **full page layout** with the document on the left and a sticky action sidebar on the right.

**Changes:**
- Create `src/pages/QuotationPreview.tsx` -- dedicated full-page preview
- Create `src/pages/InvoicePreview.tsx` -- dedicated full-page preview
- Both pages use a two-column layout:
  - Left (70%): Document card with business header, invoice number, dates, customer info ("Invoice To" / "Bill To"), items table, totals, notes, signature
  - Right (30%): Sticky action sidebar with buttons: Send, Download, Print, Edit, Add Payment (invoice only), Convert to Invoice (quotation only)
- Add routes: `/sales/:id` and `/invoices/:id`
- Update list tables to navigate to preview page on row click instead of opening Sheet
- Keep the Sheet for quick create/edit

**Design details (matching reference image):**
- Document card has rounded corners, soft shadow, white background
- Business logo and name top-left, document number and dates top-right
- "Invoice To" and "Bill To" sections side by side
- Clean items table with ITEM, DESCRIPTION, COST, QTY, PRICE columns
- Totals section at bottom right
- Right sidebar: primary "Send Invoice/Quotation" button (gradient), outlined Download, Print/Edit row, green "Add Payment" button

## Phase 2: Customer Profile Page

Currently CRM only has a list view. Add a detail page:

**Changes:**
- Create `src/pages/CustomerProfile.tsx`
- Add route `/customers/:id`
- Layout: Contact card on left, tabbed content on right
- Contact card: Avatar (large), name, company, phone, email, address, GSTIN, status badge
- Tabs: Overview, Invoices, Quotations, Payments, Notes
- Each tab shows filtered data for that customer

## Phase 3: Chat Module

Brand new module with real-time messaging.

**Database:**
- Create `chat_conversations` table (id, type: 'customer'|'internal', participant_ids, last_message, last_message_at, created_at)
- Create `chat_messages` table (id, conversation_id, sender_id, content, attachments, read_at, created_at)
- Enable realtime on `chat_messages`

**UI:**
- Create `src/pages/Chat.tsx`
- Two-panel layout:
  - Left panel: Conversation list with avatar, name, last message preview, timestamp, unread badge
  - Right panel: Message thread with bubbles (sent right/blue, received left/gray), input bar with text field, send button, attachment button
- Add route `/chat` and sidebar nav item
- Support customer and internal team conversations

## Phase 4: Sidebar Navigation Update

Update sidebar categories to match the requested structure:

```
Dashboard
CRM > Leads, Customers, Contacts
Sales > Quotations, Invoices, Payments
Ecommerce > Products, Orders, Categories
Chat
Finance > Transactions, Expenses
HRM > Employees, Attendance, Payroll
Repairs
Tasks
Reports
Settings > Business Profile, Users, Roles
```

## Phase 5: Minor UI Polish

- Ensure all tables match the exact Materialize column layout (checkbox column, avatar+email in customer column, consistent action icons)
- Add "Show X" dropdown and "Export" button to list pages
- Add pagination to all data tables
- Ensure consistent card shadows (`shadow-sm`), border radius, and spacing across all modules

---

## Technical Details

### New Files

```
src/pages/QuotationPreview.tsx
src/pages/InvoicePreview.tsx
src/pages/CustomerProfile.tsx
src/pages/Chat.tsx
```

### Modified Files

```
src/App.tsx -- add new routes (/sales/:id, /invoices/:id, /customers/:id, /chat)
src/components/layout/AppSidebar.tsx -- restructure navigation categories
src/pages/Sales.tsx -- change row click to navigate to /sales/:id
src/pages/Invoices.tsx -- change row click to navigate to /invoices/:id
src/pages/CRM.tsx -- change row click to navigate to /customers/:id
```

### Database Migration (Phase 3 only)

```sql
CREATE TABLE chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'internal',
  title text,
  participant_ids uuid[] NOT NULL DEFAULT '{}',
  last_message text,
  last_message_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
```

### Implementation Order

Due to the scope, this should be built in phases:

1. **Phase 1** (highest impact): Invoice and Quotation full-page previews with right action sidebar
2. **Phase 2**: Customer profile page
3. **Phase 3**: Chat module (new DB tables required)
4. **Phase 4**: Sidebar restructure
5. **Phase 5**: Table pagination and polish

Each phase can be approved and implemented independently.

