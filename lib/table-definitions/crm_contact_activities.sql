-- Create CRM contact activities table for tracking contact history
CREATE TABLE IF NOT EXISTS public.crm_contact_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'post_liked', 'post_commented', 'added_to_pipeline', 'stage_changed', 'note_added', etc.
    description TEXT NOT NULL,
    metadata JSONB, -- Store additional data like pipeline_id, stage_id, old/new values, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_crm_contact_activities_contact_id ON public.crm_contact_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_activities_user_id ON public.crm_contact_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_activities_created_at ON public.crm_contact_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contact_activities_type ON public.crm_contact_activities(activity_type);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.crm_contact_activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own contact activities" ON public.crm_contact_activities;
DROP POLICY IF EXISTS "Users can insert their own contact activities" ON public.crm_contact_activities;

-- Users can only see their own contact activities
CREATE POLICY "Users can view their own contact activities"
    ON public.crm_contact_activities
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own contact activities
CREATE POLICY "Users can insert their own contact activities"
    ON public.crm_contact_activities
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON public.crm_contact_activities TO authenticated;
GRANT ALL ON public.crm_contact_activities TO service_role;
