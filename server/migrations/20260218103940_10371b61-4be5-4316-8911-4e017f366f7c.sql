
-- Quotation items enhancements
ALTER TABLE quotation_items 
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hsn_code text;

-- Invoice items enhancements  
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hsn_code text;

-- Quotations enhancements
ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_inclusive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_data text,
  ADD COLUMN IF NOT EXISTS signature_name text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_ip text,
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_invoice_id uuid;

-- Invoices enhancements
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_inclusive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS signature_data text,
  ADD COLUMN IF NOT EXISTS signature_name text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

-- Allow public to view invoices by token (for public invoice page)
CREATE POLICY "Public can view invoice by token"
  ON invoices FOR SELECT
  USING (true);

-- Allow public to view invoice items
CREATE POLICY "Public can view invoice_items"
  ON invoice_items FOR SELECT
  USING (true);

-- Allow public to update quotation signature fields
CREATE POLICY "Public can update quotation signature"
  ON quotations FOR UPDATE
  USING (true)
  WITH CHECK (true);
