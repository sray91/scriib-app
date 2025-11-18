-- =====================================================
-- OUTREACH CAMPAIGNS - COMPLETE MIGRATION
-- Run this script in your Supabase SQL Editor
-- =====================================================

-- Migration 1: LinkedIn Outreach Accounts
-- =====================================================
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


-- Migration 2: Campaigns
-- =====================================================
-- Create campaigns table for outreach campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    linkedin_outreach_account_id UUID REFERENCES public.linkedin_outreach_accounts(id) ON DELETE SET NULL,
    pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL, -- Optional pipeline integration

    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, completed, stopped

    -- Campaign settings
    daily_connection_limit INTEGER DEFAULT 20,
    connection_message TEXT, -- Personalized message with connection request
    follow_up_message TEXT, -- Follow-up message after connection acceptance
    follow_up_delay_days INTEGER DEFAULT 3, -- Days to wait before sending follow-up

    -- Tracking metrics
    total_contacts INTEGER DEFAULT 0,
    connections_sent INTEGER DEFAULT 0,
    connections_accepted INTEGER DEFAULT 0,
    connections_rejected INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    replies_received INTEGER DEFAULT 0,

    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_linkedin_account_id ON public.campaigns(linkedin_outreach_account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_pipeline_id ON public.campaigns(pipeline_id);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;

CREATE POLICY "Users can view their own campaigns"
    ON public.campaigns
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns"
    ON public.campaigns
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
    ON public.campaigns
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
    ON public.campaigns
    FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION public.update_campaigns_updated_at();

GRANT ALL ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;


-- Migration 3: Campaign Contacts
-- =====================================================
-- Create campaign_contacts junction table
CREATE TABLE IF NOT EXISTS public.campaign_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending', -- pending, connection_sent, connected, follow_up_sent, replied, failed, skipped

    -- Unipile message/chat IDs for tracking
    unipile_chat_id TEXT, -- Unipile chat ID once connection is made
    connection_request_id TEXT, -- Unipile identifier for connection request
    follow_up_message_id TEXT, -- Unipile message ID for follow-up

    -- Timestamps
    connection_sent_at TIMESTAMP WITH TIME ZONE,
    connection_accepted_at TIMESTAMP WITH TIME ZONE,
    connection_rejected_at TIMESTAMP WITH TIME ZONE,
    follow_up_sent_at TIMESTAMP WITH TIME ZONE,
    reply_received_at TIMESTAMP WITH TIME ZONE,

    -- Pipeline integration
    pipeline_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,

    error_message TEXT, -- Store any error messages
    metadata JSONB, -- Additional tracking data

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate contacts in same campaign
    UNIQUE(campaign_id, contact_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign_id ON public.campaign_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_contact_id ON public.campaign_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON public.campaign_contacts(status);
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_pipeline_stage ON public.campaign_contacts(pipeline_stage_id);

-- Enable RLS
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (based on campaign ownership)
DROP POLICY IF EXISTS "Users can view campaign contacts for their campaigns" ON public.campaign_contacts;
DROP POLICY IF EXISTS "Users can insert campaign contacts for their campaigns" ON public.campaign_contacts;
DROP POLICY IF EXISTS "Users can update campaign contacts for their campaigns" ON public.campaign_contacts;
DROP POLICY IF EXISTS "Users can delete campaign contacts for their campaigns" ON public.campaign_contacts;

CREATE POLICY "Users can view campaign contacts for their campaigns"
    ON public.campaign_contacts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_contacts.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert campaign contacts for their campaigns"
    ON public.campaign_contacts
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_contacts.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update campaign contacts for their campaigns"
    ON public.campaign_contacts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_contacts.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete campaign contacts for their campaigns"
    ON public.campaign_contacts
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_contacts.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_campaign_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_campaign_contacts_updated_at ON public.campaign_contacts;
CREATE TRIGGER update_campaign_contacts_updated_at
    BEFORE UPDATE ON public.campaign_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_campaign_contacts_updated_at();

GRANT ALL ON public.campaign_contacts TO authenticated;
GRANT ALL ON public.campaign_contacts TO service_role;


-- Migration 4: Campaign Activities
-- =====================================================
-- Create campaign_activities table for activity logging
CREATE TABLE IF NOT EXISTS public.campaign_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
    campaign_contact_id UUID REFERENCES public.campaign_contacts(id) ON DELETE CASCADE,

    activity_type TEXT NOT NULL, -- connection_sent, connection_accepted, connection_rejected, follow_up_sent, reply_received, error, campaign_started, campaign_paused, campaign_stopped
    message TEXT, -- Activity description or error message
    metadata JSONB, -- Additional data (e.g., message content, error details)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaign_activities_campaign_id ON public.campaign_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activities_contact_id ON public.campaign_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activities_campaign_contact_id ON public.campaign_activities(campaign_contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_activities_type ON public.campaign_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_campaign_activities_created_at ON public.campaign_activities(created_at DESC);

-- Enable RLS
ALTER TABLE public.campaign_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view activities for their campaigns" ON public.campaign_activities;
DROP POLICY IF EXISTS "Users can insert activities for their campaigns" ON public.campaign_activities;

CREATE POLICY "Users can view activities for their campaigns"
    ON public.campaign_activities
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_activities.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert activities for their campaigns"
    ON public.campaign_activities
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_activities.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

GRANT ALL ON public.campaign_activities TO authenticated;
GRANT ALL ON public.campaign_activities TO service_role;


-- Migration 5: Campaign Daily Stats
-- =====================================================
-- Create campaign_daily_stats table for analytics
CREATE TABLE IF NOT EXISTS public.campaign_daily_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Daily metrics
    connections_sent INTEGER DEFAULT 0,
    connections_accepted INTEGER DEFAULT 0,
    connections_rejected INTEGER DEFAULT 0,
    follow_ups_sent INTEGER DEFAULT 0,
    replies_received INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One record per campaign per day
    UNIQUE(campaign_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaign_daily_stats_campaign_id ON public.campaign_daily_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_daily_stats_date ON public.campaign_daily_stats(date DESC);

-- Enable RLS
ALTER TABLE public.campaign_daily_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view stats for their campaigns" ON public.campaign_daily_stats;
DROP POLICY IF EXISTS "Users can insert stats for their campaigns" ON public.campaign_daily_stats;
DROP POLICY IF EXISTS "Users can update stats for their campaigns" ON public.campaign_daily_stats;

CREATE POLICY "Users can view stats for their campaigns"
    ON public.campaign_daily_stats
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_daily_stats.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert stats for their campaigns"
    ON public.campaign_daily_stats
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_daily_stats.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update stats for their campaigns"
    ON public.campaign_daily_stats
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_daily_stats.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_campaign_daily_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_campaign_daily_stats_updated_at ON public.campaign_daily_stats;
CREATE TRIGGER update_campaign_daily_stats_updated_at
    BEFORE UPDATE ON public.campaign_daily_stats
    FOR EACH ROW
    EXECUTE FUNCTION public.update_campaign_daily_stats_updated_at();

GRANT ALL ON public.campaign_daily_stats TO authenticated;
GRANT ALL ON public.campaign_daily_stats TO service_role;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
