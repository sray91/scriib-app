-- Create LinkedIn outreach accounts table for Unipile integration
-- This is separate from social_accounts which handles OAuth for content/analytics
CREATE TABLE IF NOT EXISTS public.linkedin_outreach_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- User-friendly identifier
    account_name TEXT NOT NULL,

    -- Unipile account identifier (returned from Unipile API)
    unipile_account_id TEXT NOT NULL UNIQUE,

    -- Optional reference to social_accounts for showing which LinkedIn profile this is
    social_account_id UUID REFERENCES public.social_accounts(id) ON DELETE SET NULL,

    -- LinkedIn profile information (from Unipile)
    email TEXT,
    profile_name TEXT,
    profile_url TEXT,

    -- Account status and settings
    is_active BOOLEAN DEFAULT true,
    daily_connection_limit INTEGER DEFAULT 20, -- Max connections per day

    -- Unipile-specific metadata
    unipile_provider_data JSONB, -- Store any additional provider data from Unipile

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_linkedin_outreach_accounts_user_id ON public.linkedin_outreach_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_outreach_accounts_unipile_id ON public.linkedin_outreach_accounts(unipile_account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_outreach_accounts_social_account ON public.linkedin_outreach_accounts(social_account_id);

-- Enable RLS
ALTER TABLE public.linkedin_outreach_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own LinkedIn outreach accounts" ON public.linkedin_outreach_accounts;
DROP POLICY IF EXISTS "Users can insert their own LinkedIn outreach accounts" ON public.linkedin_outreach_accounts;
DROP POLICY IF EXISTS "Users can update their own LinkedIn outreach accounts" ON public.linkedin_outreach_accounts;
DROP POLICY IF EXISTS "Users can delete their own LinkedIn outreach accounts" ON public.linkedin_outreach_accounts;

CREATE POLICY "Users can view their own LinkedIn outreach accounts"
    ON public.linkedin_outreach_accounts
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own LinkedIn outreach accounts"
    ON public.linkedin_outreach_accounts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own LinkedIn outreach accounts"
    ON public.linkedin_outreach_accounts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own LinkedIn outreach accounts"
    ON public.linkedin_outreach_accounts
    FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_linkedin_outreach_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_linkedin_outreach_accounts_updated_at ON public.linkedin_outreach_accounts;
CREATE TRIGGER update_linkedin_outreach_accounts_updated_at
    BEFORE UPDATE ON public.linkedin_outreach_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_linkedin_outreach_accounts_updated_at();

GRANT ALL ON public.linkedin_outreach_accounts TO authenticated;
GRANT ALL ON public.linkedin_outreach_accounts TO service_role;
