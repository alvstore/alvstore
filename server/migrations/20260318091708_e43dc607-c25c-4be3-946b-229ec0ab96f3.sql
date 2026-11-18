
-- Issue categories table
CREATE TABLE public.issue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.issue_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on issue_categories" ON public.issue_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Authenticated can view issue_categories" ON public.issue_categories
  FOR SELECT TO authenticated
  USING (true);

-- Checklist templates table
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_category_id uuid REFERENCES public.issue_categories(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'pre',
  title text NOT NULL,
  type text DEFAULT 'boolean',
  is_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  options jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on checklist_templates" ON public.checklist_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Authenticated can view checklist_templates" ON public.checklist_templates
  FOR SELECT TO authenticated
  USING (true);

-- Add stage column to job_sheet_images
ALTER TABLE public.job_sheet_images ADD COLUMN IF NOT EXISTS stage text DEFAULT 'before';

-- Add delivery and issue category fields to job_sheets
ALTER TABLE public.job_sheets 
  ADD COLUMN IF NOT EXISTS delivery_signature_data text,
  ADD COLUMN IF NOT EXISTS delivery_signature_name text,
  ADD COLUMN IF NOT EXISTS delivery_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS issue_category_id uuid REFERENCES public.issue_categories(id);

-- Add new status values to job_sheet_status enum
ALTER TYPE public.job_sheet_status ADD VALUE IF NOT EXISTS 'qc_failed';
ALTER TYPE public.job_sheet_status ADD VALUE IF NOT EXISTS 'ready_for_delivery';

-- Seed default issue categories
INSERT INTO public.issue_categories (name, description) VALUES
  ('Hardware', 'Physical component issues - buttons, ports, frame damage'),
  ('Software', 'OS, app crashes, boot loops, firmware issues'),
  ('Screen', 'Display damage, touch issues, LCD/OLED replacement'),
  ('Battery', 'Battery drain, swelling, charging issues'),
  ('Water Damage', 'Liquid damage diagnosis and recovery'),
  ('Data Backup', 'Data recovery and backup services'),
  ('Other', 'Miscellaneous repair categories');
