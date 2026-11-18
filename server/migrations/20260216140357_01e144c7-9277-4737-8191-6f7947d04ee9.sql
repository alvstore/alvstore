
-- 1. Admin can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Business settings table (single-row config)
CREATE TABLE public.business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  company_address text,
  company_phone text,
  company_email text,
  gst_number text,
  logo_url text,
  invoice_prefix text DEFAULT 'INV-',
  quotation_prefix text DEFAULT 'QT-',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on business_settings"
ON public.business_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view business_settings"
ON public.business_settings FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER update_business_settings_updated_at
BEFORE UPDATE ON public.business_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.business_settings (company_name) VALUES ('My Company');

-- 3. POS transactions
CREATE TYPE public.payment_method_type AS ENUM ('cash', 'card', 'upi', 'online');

CREATE TABLE public.pos_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  gst_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method payment_method_type NOT NULL DEFAULT 'cash',
  customer_id uuid REFERENCES public.customers(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on pos_transactions"
ON public.pos_transactions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Auto-generate transaction number
CREATE OR REPLACE FUNCTION public.generate_transaction_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(transaction_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num FROM public.pos_transactions;
  NEW.transaction_number := 'POS-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_transaction_number
BEFORE INSERT ON public.pos_transactions
FOR EACH ROW WHEN (NEW.transaction_number = '')
EXECUTE FUNCTION public.generate_transaction_number();

-- 4. Payments
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.payment_type AS ENUM ('invoice', 'pos', 'online');

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text NOT NULL DEFAULT '',
  type payment_type NOT NULL DEFAULT 'pos',
  amount numeric NOT NULL DEFAULT 0,
  payment_method payment_method_type NOT NULL DEFAULT 'cash',
  reference_id text,
  customer_id uuid REFERENCES public.customers(id),
  quotation_id uuid REFERENCES public.quotations(id),
  pos_transaction_id uuid REFERENCES public.pos_transactions(id),
  status payment_status NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on payments"
ON public.payments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Auto-generate payment number
CREATE OR REPLACE FUNCTION public.generate_payment_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(payment_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num FROM public.payments;
  NEW.payment_number := 'PAY-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_payment_number
BEFORE INSERT ON public.payments
FOR EACH ROW WHEN (NEW.payment_number = '')
EXECUTE FUNCTION public.generate_payment_number();

-- 5. Attendance records
CREATE TYPE public.attendance_source AS ENUM ('manual', 'biometric');

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  date date NOT NULL DEFAULT CURRENT_DATE,
  device_id text,
  source attendance_source NOT NULL DEFAULT 'manual',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on attendance"
ON public.attendance_records FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Users can view own attendance"
ON public.attendance_records FOR SELECT TO authenticated
USING (employee_id = auth.uid());

CREATE POLICY "Users can insert own attendance"
ON public.attendance_records FOR INSERT TO authenticated
WITH CHECK (employee_id = auth.uid());

-- 6. Templates
CREATE TYPE public.template_type AS ENUM ('email', 'sms', 'invoice', 'quotation');

CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type template_type NOT NULL,
  subject text,
  body text NOT NULL DEFAULT '',
  variables jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on templates"
ON public.templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "All authenticated can view templates"
ON public.templates FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER update_templates_updated_at
BEFORE UPDATE ON public.templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
