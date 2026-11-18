
ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS apple_id TEXT;
ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS apple_id_password TEXT;
ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS google_account TEXT;
ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS google_account_password TEXT;
ALTER TABLE public.job_sheets ADD COLUMN IF NOT EXISTS device_lock_code TEXT;
