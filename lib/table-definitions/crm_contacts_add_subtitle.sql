-- Add subtitle column to crm_contacts table
-- This stores the LinkedIn headline/tagline (different from job_title)
ALTER TABLE public.crm_contacts
ADD COLUMN IF NOT EXISTS subtitle TEXT;

-- Add index for better query performance on subtitle
CREATE INDEX IF NOT EXISTS idx_crm_contacts_subtitle ON public.crm_contacts(subtitle);
