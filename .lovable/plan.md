

# Comprehensive Enhancement Plan — 6 Areas

## 1. Public Website Enhancement (Home Theater)

### Current State
- Pure black (#000000) + deep navy aesthetic with gold/amber accents
- CinemaParticles.tsx renders 500-point starfield
- 3D flip cards, masonry gallery, testimonial carousel exist
- Page is functional but feels flat — no scrolling 3D elements, no depth beyond particles

### Plan
- Add scroll-triggered 3D floating elements: a speaker model, a projector, and sound wave rings using Three.js (rendered as simple geometric primitives, not heavy GLB models)
- Add parallax depth layers — foreground gold dust particles, midground content, background starfield at different scroll speeds
- Add a 3D room preview section: simple wireframe theater room that rotates/reveals as user scrolls (built with Three.js primitives — boxes for walls, screen plane, speaker cones)
- Add subtle ambient glow orbs that float across sections (CSS animated radial gradients)
- Lighten the palette slightly — keep cinematic dark but add more warm gold/amber gradients between sections instead of pure black-to-black
- Add more visual breathing room with section dividers (gold line or gradient)

### Files
```
EDIT: src/pages/public/HomeTheaterHome.tsx (add 3D scroll elements, parallax layers, section dividers)
EDIT: src/components/home-theater/CinemaParticles.tsx (add floating 3D objects in scene)
```

---

## 2. Hikvision Deep Audit + Testing

### Current State
- Edge function has correct V2.15.0 transparent API format
- Actions: test-credentials, test, site-search, list-devices, sync-employees, sync-attendance, backfill-attendance, full-sync, auto-map
- Webhook endpoint exists at `hikvision-webhook`
- No curl testing or demo data validation has been done

### Issues Found
- `transparentApi()` uses `encodeURIComponent` on the full ISAPI path — this is wrong. The Hik-Partner Pro gateway expects the ISAPI path as-is in the URL, not URL-encoded. `/ISAPI/AccessControl/UserInfo/Search?format=json` becomes `%2FISAPI%2F...` which will 404.
- MQ polling `pollMqAttendance` subscribes then immediately polls — but V2.15.0 says subscription needs to complete before messages are available. No wait/retry.
- No demo/test mode — cannot verify flow without live device

### Plan
- Fix `transparentApi()` — remove `encodeURIComponent`, pass ISAPI path segments directly
- Add a `demo-test` action that inserts mock attendance events into `hikvision_attendance_logs` and processes them through the attendance pipeline — validates the full flow without real devices
- Add curl test documentation as comments in the edge function
- Add better error logging with request/response bodies for debugging
- Fix MQ polling retry logic — add 2s delay after subscribe before first poll

### Files
```
EDIT: supabase/functions/hikvision-sync/index.ts (fix URL encoding, add demo-test action, fix MQ timing)
EDIT: supabase/functions/hikvision-webhook/index.ts (add request body logging)
```

---

## 3. SEO/AEO — Remove Lovable Branding

### Current State
- `index.html` has: `<meta name="author" content="Lovable" />`, `<meta name="twitter:site" content="@Lovable" />`, OG image points to Lovable CDN
- Title is just "ALVStore", description is just "ERP" — terrible for SEO
- No structured data (JSON-LD), no sitemap, no robots meta for public pages

### Plan
- Remove all Lovable references from meta tags
- Add proper SEO meta: title "ALV Store — Premium Home Theater & Apple Products | Rajasthan", rich description
- Add Open Graph tags with proper business description
- Add JSON-LD structured data (LocalBusiness schema) in the home page
- Add dynamic `<title>` per route using `react-helmet-async` or document.title
- Update `public/robots.txt` with sitemap reference
- Create a basic sitemap component or static sitemap

### Files
```
EDIT: index.html (fix meta tags, remove Lovable, add JSON-LD)
EDIT: public/robots.txt (add sitemap)
EDIT: src/pages/public/HomeTheaterHome.tsx (add document.title + meta description)
INSTALL: (none needed — use useEffect for document.title)
```

---

## 4. Attendance System Redesign

### Current Problem
- Employees can self-check-in even if absent — defeats the purpose
- No admin-controlled attendance marking
- No weekly view
- No shift/late tracking
- Calendar view shows only present percentage, not individual employee details

### Plan
- **Remove self-service Check In/Check Out buttons** — attendance should come from biometric (Hikvision) or admin manual entry only
- **Admin Attendance Marking**: Add a new UI where admin sees all active employees for a date, with status toggles (Present/Absent/Half Day/Leave) and check-in/out time inputs
- **Weekly View Tab**: Grid showing Mon-Sun for all employees with color-coded cells (green=present, red=absent, yellow=half day, gray=leave)
- **Enhanced Monthly Report**: Add late count, half-day count, overtime hours, leave days alongside present/absent
- **Payroll Integration**: Show calculated working days, deduction days in monthly report — directly feeds into payroll generation
- **Source tracking**: Show whether attendance came from biometric, manual-admin, or system

### Files
```
EDIT: src/pages/Attendance.tsx (full rewrite — remove self-checkin, add admin marking, weekly view)
```

---

## 5. Advanced Lead Management CRM

### Current State
- Basic CRUD with status filter and table view
- No pipeline visualization, no scoring, no activity timeline, no follow-up reminders, no analytics

### Plan
- **Kanban Pipeline View**: Drag-and-drop columns (New → Contacted → Qualified → Proposal → Negotiation → Converted / Lost)
- **Lead Scoring**: Auto-score based on source (referral=high, ads=medium, walkin=low), budget range, response time
- **Activity Timeline**: Per-lead interaction history — calls, emails, WhatsApp, meetings with timestamps
- **Follow-up Reminders**: Schedule next action with date/time, show overdue follow-ups prominently
- **KPI Dashboard**: Conversion rate, avg conversion time, leads by source chart, pipeline value
- **Bulk Actions**: Assign multiple leads, change status in bulk
- **Lead Detail Page**: Full-page view with timeline, notes, documents, linked quotations

### Database
```sql
-- Add columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS expected_value numeric DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason text;

-- Lead activities table
CREATE TABLE lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL, -- call, email, whatsapp, meeting, note, status_change
  description text,
  outcome text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
```

### Files
```
MIGRATE: Add lead_activities table + lead columns
REWRITE: src/pages/Leads.tsx (Kanban + detail view + KPIs + activity timeline)
```

---

## 6. Hikvision OpenAPI Re-Audit & Testing

This overlaps with item 2 but focuses on end-to-end validation:

### Plan
- Create a `demo-test` edge function action that:
  1. Inserts 5 mock attendance events with realistic Hikvision payloads
  2. Runs them through the dedupe + attendance_records pipeline
  3. Returns results showing what was created
- Add a "Run Demo Test" button in Settings Hikvision tab
- Add a "Curl Examples" info card showing exact curl commands for each action
- Validate webhook endpoint with a mock POST simulating Hik-Partner Pro format

---

## Implementation Order
1. SEO fixes (quick, high impact)
2. Hikvision URL encoding fix + demo test action
3. Attendance system redesign
4. Lead Management CRM upgrade (with migration)
5. Public website 3D enhancements
6. End-to-end Hikvision testing

## Files Summary
```
EDIT:    index.html
EDIT:    public/robots.txt
EDIT:    src/pages/public/HomeTheaterHome.tsx
EDIT:    src/components/home-theater/CinemaParticles.tsx
REWRITE: src/pages/Attendance.tsx
REWRITE: src/pages/Leads.tsx
EDIT:    supabase/functions/hikvision-sync/index.ts
EDIT:    supabase/functions/hikvision-webhook/index.ts
MIGRATE: lead_activities table + leads columns
```

