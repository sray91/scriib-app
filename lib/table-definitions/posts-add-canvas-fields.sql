-- Migration: Add missing columns for canvas compilation to posts table
-- Run this in your Supabase SQL editor

-- Add canvas_session_id column for tracking which canvas session created the post
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS canvas_session_id TEXT NULL;

-- Add day_of_week column for scheduling purposes  
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS day_of_week TEXT NULL;

-- Add compiled_from_blocks column to store metadata about which blocks were used
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS compiled_from_blocks JSONB NULL;

-- Create index for canvas_session_id for better query performance
CREATE INDEX IF NOT EXISTS posts_canvas_session_id_idx 
ON public.posts USING btree (canvas_session_id);

-- Add comment for clarity
COMMENT ON COLUMN public.posts.canvas_session_id 
IS 'ID of the canvas session that created this post';

COMMENT ON COLUMN public.posts.day_of_week 
IS 'Day of the week for scheduling (e.g., Monday, Tuesday, etc.)';

COMMENT ON COLUMN public.posts.compiled_from_blocks 
IS 'JSON metadata about which canvas blocks were used to create this post';
