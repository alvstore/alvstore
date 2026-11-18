
-- ============================================
-- FINANCE MODULE: Tables, Triggers, RLS, Seed
-- ============================================

-- 1. finance_accounts
CREATE TABLE public.finance_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash',
  account_number TEXT,
  bank_name TEXT,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on finance_accounts" ON public.finance_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view finance_accounts" ON public.finance_accounts FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can insert finance_accounts" ON public.finance_accounts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can update finance_accounts" ON public.finance_accounts FOR UPDATE
  USING (has_role(auth.uid(), 'staff'::app_role));

-- 2. finance_categories
CREATE TABLE public.finance_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on finance_categories" ON public.finance_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view finance_categories" ON public.finance_categories FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can insert finance_categories" ON public.finance_categories FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- Seed default categories
INSERT INTO public.finance_categories (name, type) VALUES
  ('POS Sales', 'income'),
  ('Repair Income', 'income'),
  ('Service Income', 'income'),
  ('Other Income', 'income'),
  ('Salary', 'expense'),
  ('Rent', 'expense'),
  ('Purchase', 'expense'),
  ('Utilities', 'expense'),
  ('Maintenance', 'expense'),
  ('Misc Expense', 'expense');

-- 3. finance_transactions
CREATE TABLE public.finance_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL,
  payment_mode TEXT,
  account_id UUID REFERENCES public.finance_accounts(id),
  to_account_id UUID REFERENCES public.finance_accounts(id),
  category_id UUID REFERENCES public.finance_categories(id),
  customer_id UUID REFERENCES public.customers(id),
  reference TEXT,
  description TEXT,
  attachment_url TEXT,
  balance_after NUMERIC,
  created_by UUID,
  staff_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on finance_transactions" ON public.finance_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view finance_transactions" ON public.finance_transactions FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can insert finance_transactions" ON public.finance_transactions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- 4. finance_audit_log
CREATE TABLE public.finance_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details TEXT,
  staff_name TEXT,
  user_id UUID,
  user_role TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on finance_audit_log" ON public.finance_audit_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view finance_audit_log" ON public.finance_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Authenticated can insert finance_audit_log" ON public.finance_audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. daily_cash_control
CREATE TABLE public.daily_cash_control (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  opening_cash NUMERIC NOT NULL DEFAULT 0,
  closing_cash NUMERIC,
  difference NUMERIC,
  staff_name TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_cash_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on daily_cash_control" ON public.daily_cash_control FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view daily_cash_control" ON public.daily_cash_control FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can insert daily_cash_control" ON public.daily_cash_control FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can update daily_cash_control" ON public.daily_cash_control FOR UPDATE
  USING (has_role(auth.uid(), 'staff'::app_role));

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-generate transaction_id (FIN-00001)
CREATE OR REPLACE FUNCTION public.generate_finance_transaction_id()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(transaction_id FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.finance_transactions
    WHERE transaction_id LIKE 'FIN-%';
  NEW.transaction_id := 'FIN-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_generate_finance_transaction_id
  BEFORE INSERT ON public.finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_finance_transaction_id();

-- Update account balance on transaction insert
CREATE OR REPLACE FUNCTION public.update_account_balance_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'income' THEN
    UPDATE public.finance_accounts SET current_balance = current_balance + NEW.amount, updated_at = now() WHERE id = NEW.account_id;
    NEW.balance_after := (SELECT current_balance FROM public.finance_accounts WHERE id = NEW.account_id);
  ELSIF NEW.type = 'expense' THEN
    UPDATE public.finance_accounts SET current_balance = current_balance - NEW.amount, updated_at = now() WHERE id = NEW.account_id;
    NEW.balance_after := (SELECT current_balance FROM public.finance_accounts WHERE id = NEW.account_id);
  ELSIF NEW.type = 'transfer' THEN
    UPDATE public.finance_accounts SET current_balance = current_balance - NEW.amount, updated_at = now() WHERE id = NEW.account_id;
    UPDATE public.finance_accounts SET current_balance = current_balance + NEW.amount, updated_at = now() WHERE id = NEW.to_account_id;
    NEW.balance_after := (SELECT current_balance FROM public.finance_accounts WHERE id = NEW.account_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_update_account_balance
  BEFORE INSERT ON public.finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance_on_transaction();

-- Auto audit log on transaction insert
CREATE OR REPLACE FUNCTION public.log_finance_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.finance_audit_log (action, entity_type, entity_id, details, staff_name, user_id)
  VALUES (
    UPPER(NEW.type) || ' Created',
    'transaction',
    NEW.id,
    NEW.type || ' of ' || NEW.amount || ' via ' || COALESCE(NEW.payment_mode, 'N/A'),
    NEW.staff_name,
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_log_finance_action
  AFTER INSERT ON public.finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_finance_action();
