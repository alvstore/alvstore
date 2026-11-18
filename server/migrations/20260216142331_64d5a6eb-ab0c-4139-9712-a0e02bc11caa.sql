
-- Add user_id to customers table for portal login linking
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);

-- Add integrations JSONB column to business_settings
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS integrations JSONB DEFAULT '{}';

-- RLS: customers with "customer" role can view their own customer record
CREATE POLICY "Customers can view own record"
ON public.customers
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
);

-- Drop existing select policies on customers that might conflict
-- (we keep the new one above which covers all roles)

-- RLS: customers can view their own quotations
CREATE POLICY "Customers can view own quotations"
ON public.quotations
FOR SELECT
TO authenticated
USING (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
);

-- RLS: customers can view their own repair tickets
CREATE POLICY "Customers can view own repair tickets"
ON public.repair_tickets
FOR SELECT
TO authenticated
USING (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(auth.uid(), 'technician')
);

-- RLS: customers can view their own payments
CREATE POLICY "Customers can view own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
);
