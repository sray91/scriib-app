-- Migration: Add archived field to posts table
-- Run this in your Supabase SQL editor or database client

-- Add the archived column to the posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Create an index for better query performance when filtering archived posts
CREATE INDEX IF NOT EXISTS posts_archived_idx ON public.posts USING btree (archived) tablespace pg_default;

-- Create a composite index for user_id and archived for efficient filtering
CREATE INDEX IF NOT EXISTS posts_user_archived_idx ON public.posts USING btree (user_id, archived) tablespace pg_default;
