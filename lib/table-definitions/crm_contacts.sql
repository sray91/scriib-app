-- Create CRM contacts table to store LinkedIn engagement data
CREATE TABLE IF NOT EXISTS public.crm_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_url TEXT, -- Nullable to allow importing contacts without LinkedIn profiles
    name TEXT,
    job_title TEXT,
    company TEXT,
    email TEXT,
    engagement_type TEXT, -- 'like' or 'comment'
    post_url TEXT, -- The LinkedIn post URL where engagement happened
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate contacts per user (same profile URL)
    -- Note: PostgreSQL allows multiple NULL values in unique constraints
    UNIQUE(user_id, profile_url)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON public.crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_at ON public.crm_contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_name ON public.crm_contacts(name);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON public.crm_contacts(company);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own CRM contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Users can insert their own CRM contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Users can update their own CRM contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Users can delete their own CRM contacts" ON public.crm_contacts;

-- Users can only see their own contacts
CREATE POLICY "Users can view their own CRM contacts"
    ON public.crm_contacts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own contacts
CREATE POLICY "Users can insert their own CRM contacts"
    ON public.crm_contacts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own contacts
CREATE POLICY "Users can update their own CRM contacts"
    ON public.crm_contacts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own contacts
CREATE POLICY "Users can delete their own CRM contacts"
    ON public.crm_contacts
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_crm_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_crm_contacts_updated_at ON public.crm_contacts;
CREATE TRIGGER update_crm_contacts_updated_at
    BEFORE UPDATE ON public.crm_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_crm_contacts_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;
