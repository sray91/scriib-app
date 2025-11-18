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
