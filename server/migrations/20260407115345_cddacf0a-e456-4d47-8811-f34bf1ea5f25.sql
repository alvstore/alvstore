ALTER TABLE payment_register
  ADD COLUMN IF NOT EXISTS card_network text,
  ADD COLUMN IF NOT EXISTS mdr_percentage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_bank_name text,
  ADD COLUMN IF NOT EXISTS settlement_date date,
  ADD COLUMN IF NOT EXISTS payment_sub_mode text;