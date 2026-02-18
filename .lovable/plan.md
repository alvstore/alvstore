

# Invoice/Quotation Add/Edit Pages, Chat Audit, and Calendar Module

## Overview

Three areas of work: (1) Replace the current side-drawer (Sheet) forms for creating invoices and quotations with dedicated full-page Materialize-style add/edit pages matching the reference screenshots, (2) Audit and fix the Chat module so all roles can participate, and (3) Build a new Calendar module.

---

## Part 1: Materialize-Style Invoice/Quotation Add/Edit Pages

Currently, creating a new invoice or quotation opens a narrow Sheet (side drawer). The Materialize reference shows a full-page layout with:
- Left column (70%): A white card containing the business header, invoice number, date fields, customer selector with auto-populated address, items table (Item, Cost, Qty, Price columns), salesperson field, note/message field, and totals summary
- Right column (30%): Sticky sidebar with "Send Invoice" button, Preview button, Save button, Accept Payments dropdown, and toggle switches for Payment Terms, Client Notes, Payment Stub

### Changes

**New file: `src/pages/InvoiceAdd.tsx`**
- Full-page form matching Materialize `app-invoice-add` layout
- Left card (70%):
  - Business header (logo + company info) top-left, "Invoice" label + auto-generated number top-right
  - Date Issued and Due Date fields
  - "Invoice To:" customer dropdown with auto-populated address/phone/email below
  - "Bill To:" section showing payment summary (Total Due, Bank details placeholder)
  - Separator, then items table: Item (select), Cost (input), Qty (input), Price (computed), delete button, description textarea per item
  - "+ Add Item" button
  - Salesperson input field
  - Message/thanks textarea
  - Totals section (Subtotal, Discount, Tax, Total) aligned right
  - Note section at bottom
- Right sidebar (30%):
  - "Send Invoice" primary button
  - "Preview" outlined button
  - "Save" outlined button
  - "Accept payments via" dropdown (placeholder)
  - Toggle switches: Payment Terms, Client Notes, Payment Stub
- On save, inserts invoice + items to database, then navigates to `/invoices/:id`

**New file: `src/pages/QuotationAdd.tsx`**
- Same layout adapted for quotations
- "Quotation" label instead of "Invoice"
- "Valid Until" date instead of "Due Date"
- GST inclusive toggle in sidebar
- Right sidebar: "Send Quotation", Preview, Save buttons
- On save, inserts quotation + items, then navigates to `/sales/:id`

**Modified: `src/pages/Sales.tsx`**
- Remove the create Sheet entirely (lines 305-358)
- Remove the detail Sheet (lines 361-438) -- detail is already handled by QuotationPreview page
- Remove DocumentPreview modal (lines 440-466)
- Remove all form state variables (lines 66-74)
- Change "New Quotation" button to navigate to `/sales/new`
- Keep list view, KPIs, filters, and table as-is

**Modified: `src/pages/Invoices.tsx`**
- Remove the create Sheet (lines 304-346)
- Remove the detail Sheet (lines 348-423)
- Remove payment sheet (lines 425-451) -- payment is on InvoicePreview page
- Remove DocumentPreview modal (lines 453-478)
- Remove all form state variables (lines 64-77)
- Change "New Invoice" button to navigate to `/invoices/new`
- Keep list view, KPIs, filters, and table

**Modified: `src/App.tsx`**
- Add routes: `/invoices/new` -> InvoiceAdd, `/sales/new` -> QuotationAdd
- Add route: `/calendar` -> Calendar

---

## Part 2: Chat Module Audit

Current issues found in code review:

1. **RLS policies may be missing or too restrictive** -- The chat_conversations table uses `participant_ids uuid[]` but RLS policies need to check if `auth.uid()` is in the array. Need to verify existing policies work.

2. **All roles should access chat** -- Currently sidebar shows Chat only for admin/staff nav. Technicians and customers cannot see it. Fix: Add Chat to `technicianNav` and `customerNav` in AppSidebar.

3. **Profile lookup assumes `profiles` table exists** -- The chat fetches from `profiles` table. If profiles don't exist for all users, conversations show "User" instead of names.

4. **No online status indicator** -- The Materialize reference shows green/red dots for online status. Add a simple "last seen" concept using presence or a timestamp.

### Changes

**Modified: `src/components/layout/AppSidebar.tsx`**
- Add `{ title: "Chat", url: "/chat", icon: MessageCircle }` to `technicianNav` items
- Add `{ title: "Chat", url: "/chat", icon: MessageCircle }` to `customerNav` items

**Modified: `src/pages/Chat.tsx`**
- Add "Chats" and "Contacts" section headers in left panel (matching Materialize reference)
- Show online status dot (green/gray) next to avatars
- Add empty state with chat bubble icon and "Select a contact to start a conversation" text
- Improve the "New Chat" flow: Instead of a Sheet, show contacts list directly in left panel under "Contacts" heading

**Verify RLS policies** on `chat_conversations` and `chat_messages`:
- Users should only see conversations where their ID is in `participant_ids`
- Users should only read/write messages for conversations they participate in
- If policies are missing, create a migration to add them

---

## Part 3: Calendar Module

New full-page calendar matching the Materialize `app-calendar` reference.

### Database

**New table: `calendar_events`**
```
id uuid PK
title text NOT NULL
description text
start_date timestamptz NOT NULL
end_date timestamptz
all_day boolean DEFAULT false
category text DEFAULT 'business' (personal, business, family, holiday, etc.)
color text (for display)
created_by uuid REFERENCES auth.users(id)
created_at timestamptz DEFAULT now()
```
- RLS: authenticated users can CRUD their own events; admins can see all

### UI

**New file: `src/pages/Calendar.tsx`**
- Two-column layout matching reference:
  - Left sidebar (25%):
    - "+ Add Event" primary button at top
    - Small month calendar (using existing Calendar component from react-day-picker)
    - "Event Filters" section with color-coded checkboxes: View All, Personal, Business, Family, Holiday, ETC
  - Right content (75%):
    - Header: prev/next arrows, "February 2026" title, view toggle buttons (Month, Week, Day, List)
    - Month view: 7-column grid (Sun-Sat), day cells showing event chips with category colors
    - Events show as colored rounded pills with time + title text
    - Click on event to edit, click on empty day to add
- Add Event dialog/sheet: Title, Start date/time, End date/time, All Day toggle, Category select, Description textarea
- Custom month grid built with date-fns (already installed)

**Modified: `src/components/layout/AppSidebar.tsx`**
- Add Calendar item under a new category or alongside Chat

**Modified: `src/App.tsx`**
- Add `/calendar` route

---

## Technical Details

### New Files
```
src/pages/InvoiceAdd.tsx
src/pages/QuotationAdd.tsx
src/pages/Calendar.tsx
```

### Modified Files
```
src/App.tsx -- add routes for /invoices/new, /sales/new, /calendar
src/pages/Sales.tsx -- remove Sheets, navigate to /sales/new
src/pages/Invoices.tsx -- remove Sheets, navigate to /invoices/new
src/components/layout/AppSidebar.tsx -- add Chat to all roles, add Calendar nav item
src/pages/Chat.tsx -- Materialize UI improvements, Chats/Contacts sections
```

### Database Migration
```sql
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  all_day boolean DEFAULT false,
  category text DEFAULT 'business',
  color text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own events"
  ON calendar_events FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can view all events"
  ON calendar_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

### Implementation Order
1. Database migration (calendar_events table)
2. InvoiceAdd and QuotationAdd full-page forms
3. Simplify Sales.tsx and Invoices.tsx (remove Sheets)
4. Route updates in App.tsx
5. Chat audit (sidebar nav for all roles, UI improvements)
6. Calendar page with month grid view

