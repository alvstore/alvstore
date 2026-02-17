
-- Add new columns to business_settings for GST, timezone, WhatsApp
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS gst_state_code text,
  ADD COLUMN IF NOT EXISTS gst_type text DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS default_cgst_rate numeric DEFAULT 9,
  ADD COLUMN IF NOT EXISTS default_sgst_rate numeric DEFAULT 9,
  ADD COLUMN IF NOT EXISTS default_igst_rate numeric DEFAULT 18,
  ADD COLUMN IF NOT EXISTS hsn_default text,
  ADD COLUMN IF NOT EXISTS whatsapp_api_url text,
  ADD COLUMN IF NOT EXISTS whatsapp_api_key text,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_id text;

-- Allow staff to also view profiles (needed for staff page to show all members)
CREATE POLICY "Staff can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

-- Allow admin to update any profile (for staff management)
CREATE POLICY "Admin can update any profile"
  ON public.profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admin to insert profiles for new staff
CREATE POLICY "Admin can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
