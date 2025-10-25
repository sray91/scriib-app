-- Create CRM contact notes table
CREATE TABLE IF NOT EXISTS public.crm_contact_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_crm_contact_notes_contact_id ON public.crm_contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_notes_user_id ON public.crm_contact_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contact_notes_created_at ON public.crm_contact_notes(created_at DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.crm_contact_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own contact notes" ON public.crm_contact_notes;
DROP POLICY IF EXISTS "Users can insert their own contact notes" ON public.crm_contact_notes;
DROP POLICY IF EXISTS "Users can update their own contact notes" ON public.crm_contact_notes;
DROP POLICY IF EXISTS "Users can delete their own contact notes" ON public.crm_contact_notes;

-- Users can only see their own contact notes
CREATE POLICY "Users can view their own contact notes"
    ON public.crm_contact_notes
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own contact notes
CREATE POLICY "Users can insert their own contact notes"
    ON public.crm_contact_notes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own contact notes
CREATE POLICY "Users can update their own contact notes"
    ON public.crm_contact_notes
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own contact notes
CREATE POLICY "Users can delete their own contact notes"
    ON public.crm_contact_notes
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_crm_contact_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_crm_contact_notes_updated_at ON public.crm_contact_notes;
CREATE TRIGGER update_crm_contact_notes_updated_at
    BEFORE UPDATE ON public.crm_contact_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_crm_contact_notes_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.crm_contact_notes TO authenticated;
GRANT ALL ON public.crm_contact_notes TO service_role;
