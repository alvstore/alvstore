
-- Apple Products table
CREATE TABLE public.apple_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number text NOT NULL UNIQUE,
  description text NOT NULL,
  sap_description text,
  category text NOT NULL,
  subcategory text,
  mrp numeric NOT NULL DEFAULT 0,
  alp_ex_vat numeric NOT NULL DEFAULT 0,
  gst_percentage numeric DEFAULT 18,
  is_new boolean DEFAULT false,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Apple Offers table
CREATE TABLE public.apple_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_type text NOT NULL,
  bank_name text,
  applicable_category text NOT NULL,
  applicable_product text,
  discount_amount numeric DEFAULT 0,
  discount_description text,
  start_date date,
  end_date date,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Apple Pricing Rules table
CREATE TABLE public.apple_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  discount_percentage numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  rule_name text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.apple_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apple_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apple_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view apple_products" ON public.apple_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/staff can manage apple_products" ON public.apple_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Authenticated users can view apple_offers" ON public.apple_offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/staff can manage apple_offers" ON public.apple_offers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Authenticated users can view apple_pricing_rules" ON public.apple_pricing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/staff can manage apple_pricing_rules" ON public.apple_pricing_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')) WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
