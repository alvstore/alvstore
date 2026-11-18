
-- Technician Payments
CREATE TABLE public.technician_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL,
  job_sheet_id uuid REFERENCES public.job_sheets(id),
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  payment_date date,
  payment_mode text,
  finance_transaction_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.technician_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and staff full access on technician_payments" ON public.technician_payments FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
CREATE POLICY "Technician can view own payments" ON public.technician_payments FOR SELECT TO authenticated USING (technician_id = auth.uid());

-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gst_number text,
  phone text,
  email text,
  address text,
  outstanding_balance numeric DEFAULT 0,
  status text DEFAULT 'active',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and staff full access on suppliers" ON public.suppliers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Purchase Orders
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL DEFAULT '',
  supplier_id uuid REFERENCES public.suppliers(id),
  status text DEFAULT 'draft',
  subtotal numeric DEFAULT 0,
  gst_amount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  notes text,
  expected_date date,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and staff full access on purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Purchase Order Items
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer DEFAULT 1,
  received_quantity integer DEFAULT 0,
  unit_price numeric DEFAULT 0,
  gst_percentage numeric DEFAULT 18,
  total numeric DEFAULT 0
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and staff full access on purchase_order_items" ON public.purchase_order_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Purchase Bills
CREATE TABLE public.purchase_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number text NOT NULL DEFAULT '',
  po_id uuid REFERENCES public.purchase_orders(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  status text DEFAULT 'draft',
  subtotal numeric DEFAULT 0,
  gst_amount numeric DEFAULT 0,
  discount_value numeric DEFAULT 0,
  total numeric DEFAULT 0,
  payment_status text DEFAULT 'unpaid',
  paid_amount numeric DEFAULT 0,
  bill_date date DEFAULT CURRENT_DATE,
  due_date date,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and staff full access on purchase_bills" ON public.purchase_bills FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Purchase Bill Items
CREATE TABLE public.purchase_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.purchase_bills(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0,
  gst_percentage numeric DEFAULT 18,
  serial_numbers text[],
  batch_number text,
  expiry_date date,
  total numeric DEFAULT 0
);
ALTER TABLE public.purchase_bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and staff full access on purchase_bill_items" ON public.purchase_bill_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Purchase Returns
CREATE TABLE public.purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL DEFAULT '',
  supplier_id uuid REFERENCES public.suppliers(id),
  bill_id uuid REFERENCES public.purchase_bills(id),
  status text DEFAULT 'draft',
  subtotal numeric DEFAULT 0,
  total numeric DEFAULT 0,
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and staff full access on purchase_returns" ON public.purchase_returns FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Purchase Return Items
CREATE TABLE public.purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0
);
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and staff full access on purchase_return_items" ON public.purchase_return_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Auto-number triggers
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num FROM public.purchase_orders WHERE po_number LIKE 'PO-%';
  NEW.po_number := 'PO-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_po_number BEFORE INSERT ON public.purchase_orders
FOR EACH ROW WHEN (NEW.po_number = '') EXECUTE FUNCTION public.generate_po_number();

CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(bill_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num FROM public.purchase_bills WHERE bill_number LIKE 'PB-%';
  NEW.bill_number := 'PB-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_bill_number BEFORE INSERT ON public.purchase_bills
FOR EACH ROW WHEN (NEW.bill_number = '') EXECUTE FUNCTION public.generate_bill_number();

CREATE OR REPLACE FUNCTION public.generate_return_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num FROM public.purchase_returns WHERE return_number LIKE 'PR-%';
  NEW.return_number := 'PR-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_return_number BEFORE INSERT ON public.purchase_returns
FOR EACH ROW WHEN (NEW.return_number = '') EXECUTE FUNCTION public.generate_return_number();
