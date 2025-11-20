-- Migration to make profile_url nullable in crm_contacts table
-- This allows importing contacts without LinkedIn profiles

-- Remove the NOT NULL constraint from profile_url
ALTER TABLE public.crm_contacts
ALTER COLUMN profile_url DROP NOT NULL;

-- Note: The UNIQUE(user_id, profile_url) constraint remains in place
-- PostgreSQL allows multiple rows with NULL in unique constraints,
-- so multiple contacts with NULL profile_url are permitted
