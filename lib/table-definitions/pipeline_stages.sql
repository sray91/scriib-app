-- Create pipeline_stages table for CRM workflow stages
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    color TEXT DEFAULT '#3b82f6', -- Default blue color
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON public.pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order ON public.pipeline_stages("order");

-- Add RLS (Row Level Security) policies
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view stages of their pipelines" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can insert stages to their pipelines" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can update stages of their pipelines" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can delete stages of their pipelines" ON public.pipeline_stages;

-- Users can only see stages of their own pipelines
CREATE POLICY "Users can view stages of their pipelines"
    ON public.pipeline_stages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.pipelines
            WHERE pipelines.id = pipeline_stages.pipeline_id
            AND pipelines.user_id = auth.uid()
        )
    );

-- Users can insert stages to their own pipelines
CREATE POLICY "Users can insert stages to their pipelines"
    ON public.pipeline_stages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.pipelines
            WHERE pipelines.id = pipeline_stages.pipeline_id
            AND pipelines.user_id = auth.uid()
        )
    );

-- Users can update stages of their own pipelines
CREATE POLICY "Users can update stages of their pipelines"
    ON public.pipeline_stages
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.pipelines
            WHERE pipelines.id = pipeline_stages.pipeline_id
            AND pipelines.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.pipelines
            WHERE pipelines.id = pipeline_stages.pipeline_id
            AND pipelines.user_id = auth.uid()
        )
    );

-- Users can delete stages of their own pipelines
CREATE POLICY "Users can delete stages of their pipelines"
    ON public.pipeline_stages
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.pipelines
            WHERE pipelines.id = pipeline_stages.pipeline_id
            AND pipelines.user_id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_pipeline_stages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_pipeline_stages_updated_at ON public.pipeline_stages;
CREATE TRIGGER update_pipeline_stages_updated_at
    BEFORE UPDATE ON public.pipeline_stages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_pipeline_stages_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.pipeline_stages TO authenticated;
GRANT ALL ON public.pipeline_stages TO service_role;
