-- Create pipelines table for CRM workflow management
CREATE TABLE IF NOT EXISTS public.pipelines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON public.pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_created_at ON public.pipelines(created_at DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Users can insert their own pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Users can update their own pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Users can delete their own pipelines" ON public.pipelines;

-- Users can only see their own pipelines
CREATE POLICY "Users can view their own pipelines"
    ON public.pipelines
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own pipelines
CREATE POLICY "Users can insert their own pipelines"
    ON public.pipelines
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own pipelines
CREATE POLICY "Users can update their own pipelines"
    ON public.pipelines
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own pipelines
CREATE POLICY "Users can delete their own pipelines"
    ON public.pipelines
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_pipelines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_pipelines_updated_at ON public.pipelines;
CREATE TRIGGER update_pipelines_updated_at
    BEFORE UPDATE ON public.pipelines
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pipelines_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.pipelines TO authenticated;
GRANT ALL ON public.pipelines TO service_role;
