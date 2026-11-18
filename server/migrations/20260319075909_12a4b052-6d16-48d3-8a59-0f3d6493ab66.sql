-- Add event_type column to templates for WhatsApp automation
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS event_type text;

-- Add comment for reference
COMMENT ON COLUMN public.templates.event_type IS 'Event type for automation triggers: lead_created, job_created, job_approved, job_in_progress, job_ready, job_delivered, invoice_generated, payment_received, quotation_sent, payment_reminder';