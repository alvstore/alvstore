
-- 1. Service charge categories table
CREATE TABLE public.service_charge_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  default_charge numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_charge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on service_charge_categories"
  ON public.service_charge_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view service_charge_categories"
  ON public.service_charge_categories FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Technician can view service_charge_categories"
  ON public.service_charge_categories FOR SELECT
  USING (has_role(auth.uid(), 'technician'::app_role));

-- Seed default categories
INSERT INTO public.service_charge_categories (name, default_charge) VALUES
  ('iPhone', 750),
  ('Android', 500),
  ('Laptop', 2600),
  ('MacBook', 3500),
  ('Tablet', 1000),
  ('Other', 500);

-- 2. Repair parts table
CREATE TABLE public.repair_parts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_sheet_id uuid NOT NULL REFERENCES public.job_sheets(id) ON DELETE CASCADE,
  name text NOT NULL,
  cost numeric NOT NULL DEFAULT 0,
  gst_percentage numeric DEFAULT 18,
  quantity integer NOT NULL DEFAULT 1,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on repair_parts"
  ON public.repair_parts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Technician can view assigned repair_parts"
  ON public.repair_parts FOR SELECT
  USING (
    has_role(auth.uid(), 'technician'::app_role)
    AND job_sheet_id IN (
      SELECT id FROM public.job_sheets WHERE assigned_technician_id = auth.uid()
    )
  );

CREATE POLICY "Public can view repair_parts"
  ON public.repair_parts FOR SELECT
  USING (true);

-- 3. Alter job_sheets with billing columns
ALTER TABLE public.job_sheets
  ADD COLUMN service_charge numeric DEFAULT 0,
  ADD COLUMN discount_type text DEFAULT 'none',
  ADD COLUMN discount_value numeric DEFAULT 0,
  ADD COLUMN gst_mode text DEFAULT 'exclusive',
  ADD COLUMN gst_percentage numeric DEFAULT 18,
  ADD COLUMN gst_amount numeric DEFAULT 0,
  ADD COLUMN parts_total numeric DEFAULT 0,
  ADD COLUMN total_amount numeric DEFAULT 0,
  ADD COLUMN invoice_id uuid REFERENCES public.invoices(id),
  ADD COLUMN payment_status text DEFAULT 'unpaid';
