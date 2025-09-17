-- User Context Guides table for storing editable context guides for AI content generation
DROP TABLE IF EXISTS public.user_context_guides CASCADE;

CREATE TABLE public.user_context_guides (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL DEFAULT 'My Content Guide',
    content TEXT NOT NULL DEFAULT '',
    description TEXT NULL,
    guide_type TEXT NOT NULL DEFAULT 'content_creation',
    is_active BOOLEAN NOT NULL DEFAULT true,
    word_count INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    metadata JSONB NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Primary key
    CONSTRAINT user_context_guides_pkey PRIMARY KEY (id),
    
    -- Foreign key to auth.users
    CONSTRAINT user_context_guides_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    
    -- Guide type constraint
    CONSTRAINT user_context_guides_guide_type_check CHECK (
        guide_type = ANY (ARRAY['content_creation'::text, 'voice_analysis'::text, 'brand_guidelines'::text, 'custom'::text])
    ),
    
    -- Ensure one active guide per user per type
    CONSTRAINT user_context_guides_unique_active_per_type 
        UNIQUE (user_id, guide_type, is_active) DEFERRABLE INITIALLY DEFERRED
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS user_context_guides_user_id_idx 
    ON public.user_context_guides USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS user_context_guides_guide_type_idx 
    ON public.user_context_guides USING btree (guide_type) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS user_context_guides_is_active_idx 
    ON public.user_context_guides USING btree (is_active) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS user_context_guides_created_at_idx 
    ON public.user_context_guides USING btree (created_at DESC) TABLESPACE pg_default;

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_context_guides ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own context guides" ON public.user_context_guides
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own context guides" ON public.user_context_guides
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own context guides" ON public.user_context_guides
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own context guides" ON public.user_context_guides
    FOR DELETE USING (auth.uid() = user_id);

-- Create a function to automatically update word count and updated_at
CREATE OR REPLACE FUNCTION update_context_guide_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Update word count
    NEW.word_count = array_length(string_to_array(trim(NEW.content), ' '), 1);
    
    -- Update timestamp
    NEW.updated_at = timezone('utc'::text, now());
    
    -- Increment version on content changes
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        NEW.version = OLD.version + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update metadata
CREATE TRIGGER update_context_guide_metadata_trigger
    BEFORE UPDATE ON public.user_context_guides
    FOR EACH ROW
    EXECUTE FUNCTION update_context_guide_metadata();

-- Create trigger to set word count on insert
CREATE TRIGGER insert_context_guide_metadata_trigger
    BEFORE INSERT ON public.user_context_guides
    FOR EACH ROW
    EXECUTE FUNCTION update_context_guide_metadata();

-- Grant necessary permissions
GRANT ALL ON public.user_context_guides TO authenticated;
GRANT ALL ON public.user_context_guides TO service_role;
