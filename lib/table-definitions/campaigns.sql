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
