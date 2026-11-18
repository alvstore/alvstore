
-- 1. Create departments table
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  device_department_id text,
  parent_id uuid REFERENCES public.departments(id),
  device_id uuid REFERENCES public.hikvision_devices(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraint for deduplication
CREATE UNIQUE INDEX idx_departments_device_dept ON public.departments (device_department_id, device_id) WHERE device_department_id IS NOT NULL;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on departments" ON public.departments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view departments" ON public.departments FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Technician can view departments" ON public.departments FOR SELECT
  USING (has_role(auth.uid(), 'technician'::app_role));

-- 2. Alter employees table
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id),
  ADD COLUMN IF NOT EXISTS device_employee_code text;

-- 3. Alter hikvision_devices table
ALTER TABLE public.hikvision_devices
  ADD COLUMN IF NOT EXISTS device_model text,
  ADD COLUMN IF NOT EXISTS device_version text,
  ADD COLUMN IF NOT EXISTS device_serial text;

-- 4. Alter hikvision_employee_mapping table
ALTER TABLE public.hikvision_employee_mapping
  ADD COLUMN IF NOT EXISTS card_number text,
  ADD COLUMN IF NOT EXISTS department_name text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS avatar_synced boolean DEFAULT false;

-- Add unique constraint for employee deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_hik_emp_mapping_unique ON public.hikvision_employee_mapping (device_employee_code, device_id) WHERE device_id IS NOT NULL;

-- 5. Alter hikvision_sync_log table
ALTER TABLE public.hikvision_sync_log
  ADD COLUMN IF NOT EXISTS sync_type text;

-- Allow service role / edge function inserts to hikvision tables (sync_log needs update for edge function)
CREATE POLICY "Admin and staff can insert hikvision_sync_log" ON public.hikvision_sync_log FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Allow update on hikvision_employee_mapping for staff too
CREATE POLICY "Staff can view hikvision_employee_mapping" ON public.hikvision_employee_mapping FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

-- Allow admin/staff to view hikvision_devices
CREATE POLICY "Staff can view hikvision_devices" ON public.hikvision_devices FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));
