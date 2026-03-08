ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS warranty_days integer DEFAULT 0;
ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS warranty_terms text;
ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS warranty_start_date date;