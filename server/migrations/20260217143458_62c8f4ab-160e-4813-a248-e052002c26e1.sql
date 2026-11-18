
-- Hikvision Devices table
CREATE TABLE public.hikvision_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 80,
  username TEXT,
  password TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hikvision_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on hikvision_devices"
  ON public.hikvision_devices FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Hikvision Attendance Logs table
CREATE TABLE public.hikvision_attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.hikvision_devices(id) ON DELETE CASCADE,
  employee_code TEXT,
  employee_name TEXT,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  device_ip TEXT,
  device_name TEXT,
  event_time TIMESTAMPTZ NOT NULL,
  event_type TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, employee_code, event_time)
);

ALTER TABLE public.hikvision_attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and staff can view hikvision_attendance_logs"
  ON public.hikvision_attendance_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Authenticated can insert hikvision_attendance_logs"
  ON public.hikvision_attendance_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Hikvision Employee Mapping table
CREATE TABLE public.hikvision_employee_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_employee_code TEXT NOT NULL,
  device_employee_name TEXT,
  erp_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.hikvision_devices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_employee_code, device_id)
);

ALTER TABLE public.hikvision_employee_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on hikvision_employee_mapping"
  ON public.hikvision_employee_mapping FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Hikvision Sync Log table
CREATE TABLE public.hikvision_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.hikvision_devices(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hikvision_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view hikvision_sync_log"
  ON public.hikvision_sync_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert hikvision_sync_log"
  ON public.hikvision_sync_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
