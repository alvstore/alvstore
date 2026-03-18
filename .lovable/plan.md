

# Advanced Repair Workflow + Home Theater SEO Website

This is a massive scope request. I'll break it into two distinct phases and prioritize what can be built effectively.

---

## Phase 1: Advanced Repair Workflow System

### 1A. Dynamic Issue Category & Checklist Engine

**Database Migration:**
```sql
-- Issue categories (Hardware, Software, Screen, Battery, etc.)
CREATE TABLE public.issue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Checklist templates linked to categories + stage
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_category_id uuid REFERENCES public.issue_categories(id),
  stage text NOT NULL DEFAULT 'pre', -- pre / post
  title text NOT NULL,
  type text DEFAULT 'boolean', -- boolean / text / dropdown
  is_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  options jsonb, -- for dropdown type
  created_at timestamptz DEFAULT now()
);
-- RLS: admin/staff full access
-- Seed default categories: Hardware, Software, Screen, Battery, Water Damage, Data Backup, Other
```

**Impact on JobSheetCreate.tsx:**
- Add issue category selector in Device step
- When category selected, fetch `checklist_templates` for `stage='pre'` and dynamically populate the checklist instead of the hardcoded `DEVICE_CHECKLISTS`
- Keep existing hardcoded checklists as fallback when no category selected

### 1B. Enhanced Status Flow

**Database Migration:**
- Add `qc_pending` and `qc_approved` to the `job_sheet_status` enum (currently: created, pending_approval, approved, rejected, assigned, in_progress, waiting_parts, repair_completed, quality_check, invoice_generated, delivered)
- The existing `quality_check` status maps to QC Pending; add `qc_approved` and `qc_failed`

```sql
ALTER TYPE public.job_sheet_status ADD VALUE IF NOT EXISTS 'qc_failed';
ALTER TYPE public.job_sheet_status ADD VALUE IF NOT EXISTS 'ready_for_delivery';
```

**Impact on JobSheetDetail.tsx:**
- Update `JOB_STATUSES` and `TIMELINE_STEPS` arrays
- Add QC approval/rejection actions (only shown at `quality_check` status)
- Block invoice generation unless status is `qc_approved` or later
- Load post-repair checklist from `checklist_templates` (stage='post') for the job's issue category

### 1C. Image Stage Tagging

**Database Migration:**
```sql
-- Add stage column to job_sheet_images
ALTER TABLE public.job_sheet_images ADD COLUMN IF NOT EXISTS stage text DEFAULT 'before';
-- Values: before, during, after
```

**Impact on JobSheetDetail.tsx:**
- Group photos by stage in the Photos tab
- When uploading, allow selecting stage (before/during/after)
- Default stage based on job status (before if pre-repair, during if in_progress, after if repair_completed+)

### 1D. Delivery Report (Public)

**New page: `src/pages/PublicDeliveryReport.tsx`**
- Public link using existing `public_token`
- Shows: job details, before/after photos, pre/post checklists, work summary, warranty details
- Customer actions: approve delivery, digital signature (reuse `SignaturePad`), download/print

**Database Migration:**
```sql
-- Add delivery fields to job_sheets
ALTER TABLE public.job_sheets 
  ADD COLUMN IF NOT EXISTS delivery_signature_data text,
  ADD COLUMN IF NOT EXISTS delivery_signature_name text,
  ADD COLUMN IF NOT EXISTS delivery_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS issue_category_id uuid;
```

### 1E. UI Tab Restructure (JobSheetDetail)

Restructure the detail page into tabs:
- **Overview** - Status, customer, device, quick actions
- **Checklist** - Pre/Post checklists side by side
- **Repair Notes** - Diagnosis, staff notes, repair notes
- **Parts Used** - Parts list with inventory links
- **Photos** - Grouped by stage (before/during/after)
- **Audit Log** - Timeline + audit entries

---

## Phase 2: Home Theater SEO Website

### 2A. New Public Website Pages

Replace the current `LandingPage.tsx` (which mixes repair + home theater) with a dedicated home theater focused site.

**New pages:**
- `src/pages/public/HomeTheaterHome.tsx` - Hero, services overview, CTAs
- `src/pages/public/HomeTheaterAbout.tsx` - Company story, team
- `src/pages/public/HomeTheaterSolutions.tsx` - Service pages (Dolby Atmos, custom cinema, etc.)
- `src/pages/public/HomeTheaterGallery.tsx` - Project gallery
- `src/pages/public/HomeTheaterContact.tsx` - Contact form + lead capture

### 2B. Lead Capture Form

Contact/consultation form fields: Name, Phone, City, Requirement, Budget, Room Size.
On submit → insert into existing `leads` table with `source = 'website'`.

### 2C. SEO Implementation

- Semantic HTML (h1/h2/h3 hierarchy)
- Meta tags via `react-helmet-async`
- Schema.org JSON-LD for local business
- Keywords: "Home theater installation Udaipur", "Luxury home cinema", "Dolby Atmos setup"
- Lazy loading images, optimized assets

### 2D. Routing

```
/                    → HomeTheaterHome (public)
/about               → HomeTheaterAbout
/solutions           → HomeTheaterSolutions
/gallery             → HomeTheaterGallery
/contact             → HomeTheaterContact
/dashboard           → Dashboard (protected, existing)
/login, /signup      → existing auth pages
```

---

## Implementation Order

1. Database migration (issue_categories, checklist_templates, job_sheet_images stage, delivery fields, status enum)
2. Seed default issue categories and checklist templates
3. Update JobSheetCreate with dynamic checklist loading
4. Update JobSheetDetail with tabbed UI, QC workflow, staged photos
5. Create PublicDeliveryReport page
6. Create Home Theater public website pages
7. Lead capture form integration
8. Routing updates

## Files Summary

```text
MIGRATION:  issue_categories, checklist_templates, alter job_sheet_images,
            alter job_sheets, alter job_sheet_status enum, seed data

EDIT:       src/pages/JobSheetCreate.tsx (dynamic checklist)
EDIT:       src/pages/JobSheetDetail.tsx (tabs, QC, staged photos)
EDIT:       src/App.tsx (routes)
EDIT:       src/components/layout/AppSidebar.tsx (if needed)
EDIT:       src/pages/LandingPage.tsx (redirect or replace)

CREATE:     src/pages/PublicDeliveryReport.tsx
CREATE:     src/pages/public/HomeTheaterHome.tsx
CREATE:     src/pages/public/HomeTheaterAbout.tsx
CREATE:     src/pages/public/HomeTheaterSolutions.tsx
CREATE:     src/pages/public/HomeTheaterGallery.tsx
CREATE:     src/pages/public/HomeTheaterContact.tsx
```

