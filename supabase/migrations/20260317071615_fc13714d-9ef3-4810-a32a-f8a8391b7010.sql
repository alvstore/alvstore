
-- Payment Register table
CREATE TABLE public.payment_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_number text NOT NULL DEFAULT '',
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  customer_name text NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  invoice_number text,
  invoice_id uuid REFERENCES public.invoices(id),
  invoice_amount numeric NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'card',
  bank_name text,
  card_type text,
  transaction_reference text,
  cheque_number text,
  cheque_deposit_date date,
  cheque_clearance_date date,
  received_amount numeric NOT NULL DEFAULT 0,
  bank_charges numeric NOT NULL DEFAULT 0,
  net_received_amount numeric GENERATED ALWAYS AS (received_amount - bank_charges) STORED,
  difference_amount numeric GENERATED ALWAYS AS (invoice_amount - (received_amount - bank_charges)) STORED,
  difference_type text GENERATED ALWAYS AS (
    CASE
      WHEN invoice_amount - (received_amount - bank_charges) > 0.01 THEN 'short'
      WHEN invoice_amount - (received_amount - bank_charges) < -0.01 THEN 'excess'
      ELSE 'none'
    END
  ) STORED,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  document_url text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Auto-number trigger
CREATE OR REPLACE FUNCTION public.generate_register_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(register_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num FROM public.payment_register WHERE register_number LIKE 'REG-%';
  NEW.register_number := 'REG-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_register_number
  BEFORE INSERT ON public.payment_register
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_register_number();

-- RLS
ALTER TABLE public.payment_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on payment_register"
  ON public.payment_register FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view payment_register"
  ON public.payment_register FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can insert payment_register"
  ON public.payment_register FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can update payment_register"
  ON public.payment_register FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role));
