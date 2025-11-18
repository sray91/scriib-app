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
