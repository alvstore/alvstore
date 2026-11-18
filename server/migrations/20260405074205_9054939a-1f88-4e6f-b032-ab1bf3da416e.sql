
-- Add advanced CRM columns to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_follow_up timestamptz;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS expected_value numeric DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pipeline_stage text DEFAULT 'new';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason text;

-- Create lead_activities table for interaction history
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  description text,
  outcome text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff can manage lead_activities"
  ON public.lead_activities FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));
