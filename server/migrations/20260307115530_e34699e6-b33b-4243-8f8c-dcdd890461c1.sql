
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS delivery_person text;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS vehicle_number text;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS receiver_signature text;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS gst_inclusive boolean DEFAULT false;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS gst_amount numeric DEFAULT 0;
ALTER TABLE public.delivery_challans ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;

ALTER TABLE public.delivery_challan_items ADD COLUMN IF NOT EXISTS hsn_code text;
ALTER TABLE public.delivery_challan_items ADD COLUMN IF NOT EXISTS gst_percentage numeric DEFAULT 18;
ALTER TABLE public.delivery_challan_items ADD COLUMN IF NOT EXISTS gst_amount numeric DEFAULT 0;
