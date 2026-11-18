
-- Delivery Challans tables
CREATE TABLE public.delivery_challans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_number text NOT NULL DEFAULT '',
  customer_id uuid REFERENCES public.customers(id),
  status text NOT NULL DEFAULT 'draft',
  notes text,
  invoice_id uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.delivery_challan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id uuid REFERENCES public.delivery_challans(id) ON DELETE CASCADE NOT NULL,
  product_id uuid,
  product_name text NOT NULL DEFAULT '',
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0
);

ALTER TABLE public.delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage challans" ON public.delivery_challans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage challan items" ON public.delivery_challan_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-generate challan number
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

CREATE TRIGGER set_challan_number BEFORE INSERT ON public.delivery_challans
FOR EACH ROW WHEN (NEW.challan_number = '' OR NEW.challan_number IS NULL)
EXECUTE FUNCTION public.generate_challan_number();

-- Chat file columns
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Salesperson + payment terms on quotations and invoices
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS salesperson_id uuid;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS salesperson_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_terms text;

-- Chat files storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-files', 'chat-files', true) ON CONFLICT DO NOTHING;

-- RLS for chat-files bucket
CREATE POLICY "Auth users upload chat files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-files');
CREATE POLICY "Anyone can view chat files" ON storage.objects FOR SELECT USING (bucket_id = 'chat-files');

-- Update policy for chat_messages to allow marking read
CREATE POLICY "Participants can update messages" ON public.chat_messages FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND auth.uid() = ANY(chat_conversations.participant_ids)));
