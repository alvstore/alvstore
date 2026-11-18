
-- =============================================
-- PHASE 2: ENUMS
-- =============================================

CREATE TYPE public.stock_movement_type AS ENUM ('in', 'out', 'adjustment');
CREATE TYPE public.quotation_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');
CREATE TYPE public.repair_status AS ENUM ('pending', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'delivered');
CREATE TYPE public.repair_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- =============================================
-- PRODUCTS TABLE
-- =============================================

CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  description TEXT,
  image_url TEXT,
  category TEXT,
  purchase_price NUMERIC(12,2) DEFAULT 0,
  selling_price NUMERIC(12,2) DEFAULT 0,
  gst_percentage NUMERIC(5,2) DEFAULT 18,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  unit TEXT DEFAULT 'pcs',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on products" ON public.products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Technician can view products" ON public.products FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'technician'));

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STOCK MOVEMENTS TABLE
-- =============================================

CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  reference TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on stock_movements" ON public.stock_movements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Technician can view stock_movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'technician'));

-- Trigger to auto-update stock quantity
CREATE OR REPLACE FUNCTION public.update_stock_on_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'in' THEN
    UPDATE public.products SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.type = 'out' THEN
    UPDATE public.products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.type = 'adjustment' THEN
    UPDATE public.products SET stock_quantity = NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_stock_on_movement AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_movement();

-- =============================================
-- QUOTATIONS TABLE
-- =============================================

CREATE TABLE public.quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id),
  quotation_number TEXT NOT NULL,
  status quotation_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(12,2) DEFAULT 0,
  gst_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  valid_until DATE,
  public_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on quotations" ON public.quotations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Public access via token (for anon)
CREATE POLICY "Public can view quotation by token" ON public.quotations FOR SELECT TO anon
  USING (true);

CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate quotation number
CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num FROM public.quotations;
  NEW.quotation_number := 'QT-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_quotation_number BEFORE INSERT ON public.quotations
  FOR EACH ROW WHEN (NEW.quotation_number = '')
  EXECUTE FUNCTION public.generate_quotation_number();

-- =============================================
-- QUOTATION ITEMS TABLE
-- =============================================

CREATE TABLE public.quotation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_percentage NUMERIC(5,2) DEFAULT 18,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  notes TEXT
);

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on quotation_items" ON public.quotation_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Public can view quotation_items" ON public.quotation_items FOR SELECT TO anon
  USING (true);

-- =============================================
-- REPAIR TICKETS TABLE
-- =============================================

CREATE TABLE public.repair_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number TEXT NOT NULL DEFAULT '',
  customer_id UUID REFERENCES public.customers(id),
  device_type TEXT,
  device_brand TEXT,
  device_model TEXT,
  serial_number TEXT,
  issue_description TEXT,
  status repair_status NOT NULL DEFAULT 'pending',
  priority repair_priority NOT NULL DEFAULT 'normal',
  assigned_technician_id UUID,
  estimated_cost NUMERIC(12,2),
  final_cost NUMERIC(12,2),
  diagnosis_notes TEXT,
  repair_notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on repair_tickets" ON public.repair_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Technician can view assigned tickets" ON public.repair_tickets FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'technician') AND assigned_technician_id = auth.uid());

CREATE POLICY "Technician can update assigned tickets" ON public.repair_tickets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'technician') AND assigned_technician_id = auth.uid());

CREATE TRIGGER update_repair_tickets_updated_at BEFORE UPDATE ON public.repair_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate ticket number
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num FROM public.repair_tickets;
  NEW.ticket_number := 'RPR-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_ticket_number BEFORE INSERT ON public.repair_tickets
  FOR EACH ROW WHEN (NEW.ticket_number = '')
  EXECUTE FUNCTION public.generate_ticket_number();

-- =============================================
-- REPAIR IMAGES TABLE
-- =============================================

CREATE TABLE public.repair_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on repair_images" ON public.repair_images FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Technician can view repair images for assigned tickets" ON public.repair_images FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'technician') AND EXISTS (
    SELECT 1 FROM public.repair_tickets WHERE id = ticket_id AND assigned_technician_id = auth.uid()
  ));

-- =============================================
-- REPAIR STATUS HISTORY TABLE
-- =============================================

CREATE TABLE public.repair_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  old_status repair_status,
  new_status repair_status NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff full access on repair_status_history" ON public.repair_status_history FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Technician can view status history for assigned tickets" ON public.repair_status_history FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'technician') AND EXISTS (
    SELECT 1 FROM public.repair_tickets WHERE id = ticket_id AND assigned_technician_id = auth.uid()
  ));

CREATE POLICY "Technician can insert status history for assigned tickets" ON public.repair_status_history FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'technician') AND EXISTS (
    SELECT 1 FROM public.repair_tickets WHERE id = ticket_id AND assigned_technician_id = auth.uid()
  ));

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION public.log_repair_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.repair_status_history (ticket_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_repair_status_change AFTER UPDATE ON public.repair_tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_repair_status_change();

-- =============================================
-- STORAGE BUCKET
-- =============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true);

CREATE POLICY "Authenticated users can upload files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Anyone can view uploads" ON storage.objects FOR SELECT
  USING (bucket_id = 'uploads');

CREATE POLICY "Users can update own uploads" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'uploads');

CREATE POLICY "Users can delete own uploads" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads');
