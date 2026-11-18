
-- 1. Job sheets: add cost tracking and device movement columns
ALTER TABLE job_sheets ADD COLUMN IF NOT EXISTS actual_cost numeric DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN IF NOT EXISTS technician_payment numeric DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN IF NOT EXISTS technician_payment_status text DEFAULT 'pending';
ALTER TABLE job_sheets ADD COLUMN IF NOT EXISTS technician_payment_date timestamptz DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN IF NOT EXISTS device_received_at timestamptz DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN IF NOT EXISTS device_sent_at timestamptz DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN IF NOT EXISTS device_received_by uuid DEFAULT NULL;
ALTER TABLE job_sheets ADD COLUMN IF NOT EXISTS device_sent_by uuid DEFAULT NULL;

-- 2. Chat: add WhatsApp channel support
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel text DEFAULT 'internal';
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS whatsapp_message_id text DEFAULT NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT NULL;
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS channel text DEFAULT 'internal';
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS whatsapp_phone text DEFAULT NULL;

-- 3. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  link text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated can insert notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 4. Daily cash control: add advanced columns
ALTER TABLE daily_cash_control ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;
ALTER TABLE daily_cash_control ADD COLUMN IF NOT EXISTS denominations jsonb DEFAULT NULL;
ALTER TABLE daily_cash_control ADD COLUMN IF NOT EXISTS pos_total numeric DEFAULT 0;
ALTER TABLE daily_cash_control ADD COLUMN IF NOT EXISTS manual_income numeric DEFAULT 0;
ALTER TABLE daily_cash_control ADD COLUMN IF NOT EXISTS manual_expense numeric DEFAULT 0;
ALTER TABLE daily_cash_control ADD COLUMN IF NOT EXISTS expected_closing numeric DEFAULT NULL;
ALTER TABLE daily_cash_control ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';
ALTER TABLE daily_cash_control ADD COLUMN IF NOT EXISTS closed_by uuid DEFAULT NULL;
ALTER TABLE daily_cash_control ADD COLUMN IF NOT EXISTS closed_at timestamptz DEFAULT NULL;
