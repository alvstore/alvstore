
ALTER TABLE public.hikvision_attendance_logs
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS source_mode text DEFAULT 'polling',
  ADD COLUMN IF NOT EXISTS attendance_status text,
  ADD COLUMN IF NOT EXISTS verify_mode text,
  ADD COLUMN IF NOT EXISTS event_serial_no text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hik_attendance_dedupe
  ON public.hikvision_attendance_logs (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
