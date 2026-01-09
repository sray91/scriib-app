-- Create canvas_sessions table for persisting CoCreate workspaces
-- Removed redundant constraint definition to avoid "already exists" errors
CREATE TABLE IF NOT EXISTS public.canvas_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT DEFAULT 'Untitled Session',
    nodes JSONB DEFAULT '[]'::jsonb,
    edges JSONB DEFAULT '[]'::jsonb,
    dynamic_context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching user's sessions quickly
CREATE INDEX IF NOT EXISTS idx_canvas_sessions_user_id ON public.canvas_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_canvas_sessions_last_accessed ON public.canvas_sessions(last_accessed DESC);

-- Enable RLS (this is safe to run multiple times)
ALTER TABLE public.canvas_sessions ENABLE ROW LEVEL SECURITY;

-- drop policies if they exist to avoid duplication errors on re-run
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.canvas_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.canvas_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.canvas_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.canvas_sessions;

-- Re-create Policies
CREATE POLICY "Users can view their own sessions" 
    ON public.canvas_sessions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" 
    ON public.canvas_sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" 
    ON public.canvas_sessions FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" 
    ON public.canvas_sessions FOR DELETE 
    USING (auth.uid() = user_id);
