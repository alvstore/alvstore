CREATE TABLE public.follow_up_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  note text NOT NULL,
  outcome text,
  next_follow_up_date date,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.follow_up_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage follow_up_notes"
  ON public.follow_up_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);