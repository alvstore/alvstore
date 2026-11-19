-- Idempotent runtime hooks, installed by the Prisma seed after db push.

-- Prisma owns ALL tables/enums/indexes; this file owns only trigger behaviour.

-- No Supabase roles, auth helpers, RLS policies, or migration ledger.



CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  -- Signup never grants admin; only the seed/admin endpoint can do that.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff') ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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

CREATE OR REPLACE FUNCTION public.log_repair_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.repair_status_history (ticket_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NULLIF(current_setting('app.user_id', true), '')::uuid);
  END IF;
  RETURN NEW;
END;
$$;

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
      NULLIF(current_setting('app.user_id', true), '')::uuid
    );
  END IF;
  RETURN NEW;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
  RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_num FROM public.invoices WHERE invoice_number LIKE 'INV-%';
  NEW.invoice_number := 'INV-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_challan_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(challan_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num FROM public.delivery_challans WHERE challan_number LIKE 'DC-%';
  NEW.challan_number := 'DC-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_stock_on_movement ON public.stock_movements;
CREATE TRIGGER trg_update_stock_on_movement AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_movement();

DROP TRIGGER IF EXISTS update_quotations_updated_at ON public.quotations;
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_generate_quotation_number ON public.quotations;
CREATE TRIGGER trg_generate_quotation_number BEFORE INSERT ON public.quotations
  FOR EACH ROW WHEN (NEW.quotation_number = '')
  EXECUTE FUNCTION public.generate_quotation_number();

DROP TRIGGER IF EXISTS update_repair_tickets_updated_at ON public.repair_tickets;
CREATE TRIGGER update_repair_tickets_updated_at BEFORE UPDATE ON public.repair_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_generate_ticket_number ON public.repair_tickets;
CREATE TRIGGER trg_generate_ticket_number BEFORE INSERT ON public.repair_tickets
  FOR EACH ROW WHEN (NEW.ticket_number = '')
  EXECUTE FUNCTION public.generate_ticket_number();

DROP TRIGGER IF EXISTS trg_log_repair_status_change ON public.repair_tickets;
CREATE TRIGGER trg_log_repair_status_change AFTER UPDATE ON public.repair_tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_repair_status_change();

DROP TRIGGER IF EXISTS update_business_settings_updated_at ON public.business_settings;
CREATE TRIGGER update_business_settings_updated_at
BEFORE UPDATE ON public.business_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_transaction_number ON public.pos_transactions;
CREATE TRIGGER set_transaction_number
BEFORE INSERT ON public.pos_transactions
FOR EACH ROW WHEN (NEW.transaction_number = '')
EXECUTE FUNCTION public.generate_transaction_number();

DROP TRIGGER IF EXISTS set_payment_number ON public.payments;
CREATE TRIGGER set_payment_number
BEFORE INSERT ON public.payments
FOR EACH ROW WHEN (NEW.payment_number = '')
EXECUTE FUNCTION public.generate_payment_number();

DROP TRIGGER IF EXISTS update_templates_updated_at ON public.templates;
CREATE TRIGGER update_templates_updated_at
BEFORE UPDATE ON public.templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_job_number ON public.job_sheets;
CREATE TRIGGER set_job_number
  BEFORE INSERT ON public.job_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_job_number();

DROP TRIGGER IF EXISTS log_job_sheet_status ON public.job_sheets;
CREATE TRIGGER log_job_sheet_status
  AFTER UPDATE ON public.job_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_job_sheet_status_change();

DROP TRIGGER IF EXISTS update_job_sheets_updated_at ON public.job_sheets;
CREATE TRIGGER update_job_sheets_updated_at
  BEFORE UPDATE ON public.job_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_generate_finance_transaction_id ON public.finance_transactions;
CREATE TRIGGER trg_generate_finance_transaction_id
  BEFORE INSERT ON public.finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_finance_transaction_id();

DROP TRIGGER IF EXISTS trg_update_account_balance ON public.finance_transactions;
CREATE TRIGGER trg_update_account_balance
  BEFORE INSERT ON public.finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance_on_transaction();

DROP TRIGGER IF EXISTS trg_log_finance_action ON public.finance_transactions;
CREATE TRIGGER trg_log_finance_action
  AFTER INSERT ON public.finance_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_finance_action();

DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_invoice_number ON public.invoices;
CREATE TRIGGER set_invoice_number BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_challan_number ON public.delivery_challans;
CREATE TRIGGER set_challan_number BEFORE INSERT ON public.delivery_challans
FOR EACH ROW WHEN (NEW.challan_number = '' OR NEW.challan_number IS NULL)
EXECUTE FUNCTION public.generate_challan_number();

DROP TRIGGER IF EXISTS set_po_number ON public.purchase_orders;
CREATE TRIGGER set_po_number BEFORE INSERT ON public.purchase_orders
FOR EACH ROW WHEN (NEW.po_number = '') EXECUTE FUNCTION public.generate_po_number();

DROP TRIGGER IF EXISTS set_bill_number ON public.purchase_bills;
CREATE TRIGGER set_bill_number BEFORE INSERT ON public.purchase_bills
FOR EACH ROW WHEN (NEW.bill_number = '') EXECUTE FUNCTION public.generate_bill_number();

DROP TRIGGER IF EXISTS set_return_number ON public.purchase_returns;
CREATE TRIGGER set_return_number BEFORE INSERT ON public.purchase_returns
FOR EACH ROW WHEN (NEW.return_number = '') EXECUTE FUNCTION public.generate_return_number();

DROP TRIGGER IF EXISTS set_register_number ON public.payment_register;
CREATE TRIGGER set_register_number
  BEFORE INSERT ON public.payment_register
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_register_number();
