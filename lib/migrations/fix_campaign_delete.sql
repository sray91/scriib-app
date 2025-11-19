-- Fix campaign deletion by adding missing DELETE policy to campaign_activities table
-- This allows cascade deletes to work when removing campaigns

DROP POLICY IF EXISTS "Users can delete activities for their campaigns" ON public.campaign_activities;

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
