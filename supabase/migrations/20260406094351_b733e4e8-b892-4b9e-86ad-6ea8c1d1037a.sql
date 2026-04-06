DROP INDEX IF EXISTS idx_hik_attendance_dedupe;
CREATE UNIQUE INDEX idx_hik_attendance_dedupe ON public.hikvision_attendance_logs (dedupe_key);