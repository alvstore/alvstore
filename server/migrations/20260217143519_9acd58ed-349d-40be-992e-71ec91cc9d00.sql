
-- Fix overly permissive INSERT policies
DROP POLICY "Authenticated can insert hikvision_attendance_logs" ON public.hikvision_attendance_logs;
CREATE POLICY "Admin and staff can insert hikvision_attendance_logs"
  ON public.hikvision_attendance_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

DROP POLICY "Authenticated can insert hikvision_sync_log" ON public.hikvision_sync_log;
CREATE POLICY "Admin can insert hikvision_sync_log"
  ON public.hikvision_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
