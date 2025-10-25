-- Create pipeline_contacts table for tracking contacts through pipeline stages
CREATE TABLE IF NOT EXISTS public.pipeline_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- A contact can only be in one stage per pipeline at a time
    UNIQUE(pipeline_id, contact_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pipeline_contacts_pipeline_id ON public.pipeline_contacts(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_contacts_stage_id ON public.pipeline_contacts(stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_contacts_contact_id ON public.pipeline_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_contacts_user_id ON public.pipeline_contacts(user_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.pipeline_contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own pipeline contacts" ON public.pipeline_contacts;
DROP POLICY IF EXISTS "Users can insert their own pipeline contacts" ON public.pipeline_contacts;
DROP POLICY IF EXISTS "Users can update their own pipeline contacts" ON public.pipeline_contacts;
DROP POLICY IF EXISTS "Users can delete their own pipeline contacts" ON public.pipeline_contacts;

-- Users can only see their own pipeline contacts
CREATE POLICY "Users can view their own pipeline contacts"
    ON public.pipeline_contacts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own pipeline contacts
CREATE POLICY "Users can insert their own pipeline contacts"
    ON public.pipeline_contacts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own pipeline contacts
CREATE POLICY "Users can update their own pipeline contacts"
    ON public.pipeline_contacts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own pipeline contacts
CREATE POLICY "Users can delete their own pipeline contacts"
    ON public.pipeline_contacts
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_pipeline_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_pipeline_contacts_updated_at ON public.pipeline_contacts;
CREATE TRIGGER update_pipeline_contacts_updated_at
    BEFORE UPDATE ON public.pipeline_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pipeline_contacts_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.pipeline_contacts TO authenticated;
GRANT ALL ON public.pipeline_contacts TO service_role;
