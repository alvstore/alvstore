

# Phase 3: Chat Module, Materialize Products, and Dashboard-Finance Sync

## 1. Chat Module (Database + UI)

### Database Migration
Create two new tables with RLS and realtime:

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
```
- Enable RLS on both tables (authenticated users who are participants can read/write)
- Enable realtime on `chat_messages` via `ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages`

### Chat UI (`src/pages/Chat.tsx`)
- Two-panel Materialize-style layout:
  - **Left panel**: Conversation list with avatar, name, last message preview, timestamp, unread indicator
  - **Right panel**: Message thread with bubbles (sent = right/primary, received = left/muted), input bar with send button
- New conversation button with user/customer selector
- Realtime subscription for live message updates
- Mobile responsive: panels stack vertically

### Route and Sidebar
- Add `/chat` route in `App.tsx`
- Add "Chat" item under a new "CHAT" category in `AppSidebar.tsx` (with `MessageCircle` icon)

---

## 2. Materialize-Style Product Pages

### Product List Page (`src/pages/Inventory.tsx` rewrite)
Replicate the Materialize `app-ecommerce-product-list` layout:
- **KPI cards** at top: Total Products, In Stock, Low Stock, Out of Stock
- **Filter bar**: Search, Category dropdown, Stock Status dropdown, Publish Status, View toggle (list/grid)
- **Product table** columns: Product (image + name + category), SKU, Stock, Price, Status badge, Actions (edit, delete, barcode)
- **Grid view**: Product cards with image, name, price, stock badge, and quick action buttons
- Pagination with "Show X" dropdown
- "Export" button placeholder

### Add/Edit Product Page (`src/pages/ProductAdd.tsx` -- new file)
Replicate the Materialize `app-ecommerce-product-add` layout:
- **Left column (70%)**:
  - Product Information card: Name, SKU, Barcode (with generate button), Description (textarea)
  - Pricing card: Purchase Price, Selling Price, GST Percentage
  - Inventory card: Stock Quantity, Low Stock Threshold, Unit
- **Right column (30%)**:
  - Product Image card: Upload/preview area
  - Category card: Select or create category
  - Status card: Active/Inactive toggle
- Save / Discard buttons at bottom
- Route: `/inventory/add` and `/inventory/:id/edit`

### Route Updates
- Add `/inventory/add` and `/inventory/:id/edit` routes in `App.tsx`

---

## 3. Dashboard Synced with Finance

Currently the Dashboard shows POS sales and payment data, but does NOT pull from the Finance module's `finance_transactions` and `finance_accounts` tables. The Finance module has its own separate dashboard tab.

### Changes to `src/pages/Dashboard.tsx`
- **Replace "Cash Balance" KPI** with actual sum from `finance_accounts` (all account types)
- **Add "Revenue" KPI**: Sum of `finance_transactions` where `type = 'income'` this month
- **Add "Expenses" KPI**: Sum of `finance_transactions` where `type = 'expense'` this month
- **Add Income vs Expense chart**: 7-day bar chart using `finance_transactions` data (same as Finance dashboard tab)
- **Keep existing charts**: Sales Trend (POS), Repair Status, Top Products, Recent Invoices
- Reorder layout: KPI row (Revenue, Expenses, Net Balance, Customers) then charts (Sales + Income/Expense side by side), then Repair + Products, then Recent Invoices

---

## Technical Details

### New Files
- `src/pages/Chat.tsx`
- `src/pages/ProductAdd.tsx`

### Modified Files
- `src/App.tsx` -- add Chat route, ProductAdd routes
- `src/components/layout/AppSidebar.tsx` -- add Chat nav item
- `src/pages/Inventory.tsx` -- Materialize-style product list with KPI cards
- `src/pages/Dashboard.tsx` -- sync with finance_accounts and finance_transactions

### Database Migration
- Create `chat_conversations` and `chat_messages` tables
- RLS policies for authenticated participants
- Enable realtime publication on `chat_messages`

### Implementation Order
1. Database migration (chat tables)
2. Chat page with realtime
3. Product list page rewrite (Materialize style)
4. Product add/edit page (new file)
5. Dashboard finance sync

