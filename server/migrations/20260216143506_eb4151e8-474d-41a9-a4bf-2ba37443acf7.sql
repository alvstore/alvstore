
-- 1. New enum for job sheet status
CREATE TYPE public.job_sheet_status AS ENUM (
  'created', 'pending_approval', 'approved', 'rejected', 'assigned',
  'in_progress', 'waiting_parts', 'repair_completed', 'quality_check',
  'invoice_generated', 'delivered'
);

-- 2. Lookup tables
CREATE TABLE public.device_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.device_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.device_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view device_brands" ON public.device_brands FOR SELECT USING (true);
CREATE POLICY "Admin and staff can insert device_brands" ON public.device_brands FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Authenticated can view device_types" ON public.device_types FOR SELECT USING (true);
CREATE POLICY "Admin and staff can insert device_types" ON public.device_types FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Seed brands
INSERT INTO public.device_brands (name) VALUES
  ('Apple'), ('Samsung'), ('OnePlus'), ('Xiaomi'), ('Realme'),
  ('Oppo'), ('Vivo'), ('HP'), ('Dell'), ('Lenovo'), ('Asus'), ('Acer');

-- Seed device types
INSERT INTO public.device_types (name) VALUES
  ('Mobile'), ('Laptop'), ('Tablet'), ('iPad'), ('Smartwatch'), ('MacBook');

-- 3. Job Sheets table
CREATE TABLE public.job_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_number TEXT NOT NULL DEFAULT '' UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  device_brand TEXT NOT NULL,
  device_type TEXT NOT NULL,
  device_model TEXT,
  serial_number TEXT,
  imei_number TEXT,
  device_color TEXT,
  storage_capacity TEXT,
  problem_description TEXT NOT NULL,
  issue_tags JSONB DEFAULT '[]'::jsonb,
  pre_repair_checklist JSONB DEFAULT '[]'::jsonb,
  post_repair_checklist JSONB DEFAULT '[]'::jsonb,
  staff_notes TEXT,
  estimated_cost NUMERIC,
  estimated_completion DATE,
  repair_notes TEXT,
  final_cost NUMERIC,
  assigned_technician_id UUID,
  status public.job_sheet_status NOT NULL DEFAULT 'created',
  priority public.repair_priority NOT NULL DEFAULT 'normal',
  approval_status TEXT,
  approval_timestamp TIMESTAMPTZ,
  approval_ip TEXT,
  public_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_sheets ENABLE ROW LEVEL SECURITY;

-- Admin/Staff full access
CREATE POLICY "Admin and staff full access on job_sheets" ON public.job_sheets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Technician can view assigned
CREATE POLICY "Technician can view assigned job_sheets" ON public.job_sheets FOR SELECT
  USING (has_role(auth.uid(), 'technician'::app_role) AND assigned_technician_id = auth.uid());

-- Technician can update assigned
CREATE POLICY "Technician can update assigned job_sheets" ON public.job_sheets FOR UPDATE
  USING (has_role(auth.uid(), 'technician'::app_role) AND assigned_technician_id = auth.uid());

-- Customer can view own job sheets
CREATE POLICY "Customer can view own job_sheets" ON public.job_sheets FOR SELECT
  USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- Public can view by token (for approval page)
CREATE POLICY "Public can view job_sheet by token" ON public.job_sheets FOR SELECT
  USING (true);

-- 4. Job Sheet Images
CREATE TABLE public.job_sheet_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_sheet_id UUID NOT NULL REFERENCES public.job_sheets(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type TEXT NOT NULL DEFAULT 'damage',
  caption TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_sheet_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on job_sheet_images" ON public.job_sheet_images FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Technician can view assigned job_sheet_images" ON public.job_sheet_images FOR SELECT
  USING (has_role(auth.uid(), 'technician'::app_role) AND job_sheet_id IN (
    SELECT id FROM public.job_sheets WHERE assigned_technician_id = auth.uid()
  ));

CREATE POLICY "Technician can insert job_sheet_images" ON public.job_sheet_images FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'technician'::app_role) AND job_sheet_id IN (
    SELECT id FROM public.job_sheets WHERE assigned_technician_id = auth.uid()
  ));

CREATE POLICY "Public can view job_sheet_images" ON public.job_sheet_images FOR SELECT
  USING (true);

-- 5. Job Sheet Audit Log (append-only)
CREATE TABLE public.job_sheet_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_sheet_id UUID NOT NULL REFERENCES public.job_sheets(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  user_id UUID,
  user_role TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_sheet_audit_log ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view audit logs
CREATE POLICY "Authenticated can view job_sheet_audit_log" ON public.job_sheet_audit_log FOR SELECT
  USING (true);

-- Only insert allowed (append-only)
CREATE POLICY "Authenticated can insert job_sheet_audit_log" ON public.job_sheet_audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Public can view audit log (for public approval page)
CREATE POLICY "Public can view audit_log" ON public.job_sheet_audit_log FOR SELECT
  USING (true);

-- 6. Auto-number trigger for job sheets
CREATE OR REPLACE FUNCTION public.generate_job_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  current_year TEXT;
  next_num INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM now())::TEXT;
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(job_number FROM 10) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.job_sheets
  WHERE job_number LIKE 'JOB-' || current_year || '-%';
  
  NEW.job_number := 'JOB-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_job_number
  BEFORE INSERT ON public.job_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_job_number();

-- 7. Status change audit trigger
CREATE OR REPLACE FUNCTION public.log_job_sheet_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.job_sheet_audit_log (job_sheet_id, action, details, user_id)
    VALUES (
      NEW.id,
      'status_changed',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_job_sheet_status
  AFTER UPDATE ON public.job_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_job_sheet_status_change();

-- 8. Updated_at trigger
CREATE TRIGGER update_job_sheets_updated_at
  BEFORE UPDATE ON public.job_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
