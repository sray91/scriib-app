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
DROP POLICY IF EXISTS "Users can delete activities for their campaigns" ON public.campaign_activities;

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

CREATE POLICY "Users can delete activities for their campaigns"
    ON public.campaign_activities
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_activities.campaign_id
            AND campaigns.user_id = auth.uid()
        )
    );

GRANT ALL ON public.campaign_activities TO authenticated;
GRANT ALL ON public.campaign_activities TO service_role;
