

# Premium 3D Home Theater Website + WhatsApp Automation System

This is a two-part request. Given the massive scope, I'll focus on what's buildable effectively within this stack.

---

## Part 1: Premium 3D Home Theater Website

### What exists
`src/pages/public/HomeTheaterHome.tsx` — a basic static page with services, testimonials, FAQs, and a lead capture form. No 3D, no animations, no interactive configurator.

### Plan

**Replace `HomeTheaterHome.tsx`** with a premium 3D experience using React Three Fiber (`@react-three/fiber@^8.18`, `@react-three/drei@^9.122.0`, `three@^0.170`).

#### Sections to build:

1. **Hero** — 3D theater room scene (simple geometric room with floating speaker meshes + screen). Mouse-move camera tilt via `useFrame`. Scroll-driven zoom. Two CTAs: "Get Free Consultation" / "Book Demo" (scrolls to form).

2. **Services** — 3D floating glassmorphic cards with hover tilt (CSS `perspective` + `transform`). No heavy Three.js needed here.

3. **Interactive Configurator** — Room size selector (Small/Medium/Large), budget range, setup type (Basic/Premium/Ultra). On selection, shows recommended config with estimated price. Pure React state — no 3D needed.

4. **Projects/Portfolio** — Parallax grid with CSS 3D tilt on hover.

5. **Testimonials** — Auto-scrolling floating cards.

6. **Lead Capture Form** — Same fields as current (name, phone, city, requirement, budget, room_size). Inserts into `leads` table with `source: 'website'`.

7. **Floating WhatsApp Button** — Fixed position, opens `https://wa.me/91XXXXXXXXXX?text=Hi, I want Home Theater setup`. Phone number from `business_settings`.

#### Mobile fallback
Detect mobile via `use-mobile` hook. On mobile: skip Three.js scene, show a static hero image with gradient overlay instead.

#### SEO
Keep existing React Helmet meta tags and JSON-LD schema.

#### Files:
```
EDIT:    src/pages/public/HomeTheaterHome.tsx  (complete rewrite with 3D hero)
CREATE:  src/components/home-theater/TheaterScene.tsx  (R3F 3D scene)
CREATE:  src/components/home-theater/Configurator.tsx  (interactive configurator)
CREATE:  src/components/home-theater/WhatsAppFloat.tsx  (floating WA button)
```

#### Dependencies:
- `@react-three/fiber@^8.18`
- `@react-three/drei@^9.122.0`
- `three@^0.170`
- `@types/three` (dev)

---

## Part 2: WhatsApp Automation System

### What exists
- `send-whatsapp` edge function — sends text/template messages via WhatsApp Business API
- `templates` table — stores email/SMS/invoice templates with variable support
- `Chat.tsx` — full chat UI with WhatsApp and internal messaging
- Business settings store WA API keys

### Plan

#### 2A. WhatsApp Automation Templates

**Add `event_type` column to `templates` table** to link templates to ERP events.

```sql
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS event_type text;
-- Values: lead_created, job_created, job_approved, job_in_progress, 
--         job_ready, job_delivered, invoice_generated, payment_received,
--         quotation_sent, payment_reminder
```

#### 2B. Automation Trigger Edge Function

**Create `supabase/functions/whatsapp-automation/index.ts`**

Called from client code at key workflow moments (job status change, invoice creation, etc.). Flow:
1. Receives `{ event_type, customer_phone, variables: { name, job_id, amount, status, link } }`
2. Looks up template by `event_type` in `templates` table
3. Replaces `{{variable}}` placeholders
4. Calls existing `send-whatsapp` function logic internally
5. Falls back to SMS (calls `send-sms` function) if WhatsApp fails

#### 2C. Trigger Points in Existing Code

Add automation calls at these points:
- **JobSheetDetail.tsx** — on status change (calls automation with `job_*` event types)
- **InvoiceAdd.tsx** — on invoice creation (`invoice_generated`)
- **Payments page** — on payment received (`payment_received`)
- **Leads.tsx** — on lead creation (`lead_created`)

Each trigger: fetch customer phone → call `whatsapp-automation` function.

#### 2D. Automation Settings UI

**Add "WhatsApp Automation" section in Settings** (under existing WhatsApp tab):
- Toggle automation on/off per event type
- Link to template for each event
- Test button to send sample message

#### 2E. Delivery Status Tracking

Already partially exists in `chat_messages.delivery_status`. Enhance the `send-whatsapp` edge function to update `delivery_status` field (sent/delivered/read/failed) — this requires webhook handling which is already scaffolded in the GET handler.

#### Files:
```
MIGRATION:  Add event_type column to templates
CREATE:     supabase/functions/whatsapp-automation/index.ts
EDIT:       src/pages/JobSheetDetail.tsx (add automation triggers on status change)
EDIT:       src/pages/Settings.tsx (add automation toggle UI in WhatsApp tab)
```

---

## Implementation Order

1. Install 3D dependencies
2. Create TheaterScene, Configurator, WhatsAppFloat components
3. Rewrite HomeTheaterHome with 3D hero + all sections
4. Database migration (templates.event_type)
5. Create whatsapp-automation edge function
6. Add trigger points in JobSheetDetail
7. Add automation settings UI

