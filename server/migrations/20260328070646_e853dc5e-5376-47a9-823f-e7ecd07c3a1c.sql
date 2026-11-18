ALTER TABLE public.apple_pricing_rules
  ADD COLUMN IF NOT EXISTS cash_discount_type text DEFAULT 'on_base_price',
  ADD COLUMN IF NOT EXISTS cash_discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_discount_mode text DEFAULT 'percentage';