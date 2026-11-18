
-- Fix audit log INSERT policy to require user_id match
DROP POLICY "Authenticated can insert audit logs" ON public.system_audit_log;

CREATE POLICY "Authenticated can insert own audit logs" ON public.system_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
