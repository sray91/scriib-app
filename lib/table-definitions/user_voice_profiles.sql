-- User Voice Profiles Table
-- Unified voice profile storage for world-class post generation
-- Replaces fragmented voice analysis across multiple systems

DROP TABLE IF EXISTS public.user_voice_profiles CASCADE;

CREATE TABLE public.user_voice_profiles (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,

  -- Core voice attributes (structured for consistency)
  writing_style jsonb NOT NULL DEFAULT '{
    "formality": 0.5,
    "directness": 0.5,
    "sentence_length_avg": 15,
    "sentence_length_variance": "medium",
    "paragraph_style": "medium"
  }'::jsonb,

  tone jsonb NOT NULL DEFAULT '{
    "primary": "professional",
    "secondary": "approachable",
    "emotional_range": []
  }'::jsonb,

  vocabulary jsonb NOT NULL DEFAULT '{
    "level": "professional",
    "industry_terms": [],
    "signature_phrases": [],
    "words_to_avoid": []
  }'::jsonb,

  formatting jsonb NOT NULL DEFAULT '{
    "uses_emojis": false,
    "uses_hashtags": false,
    "uses_line_breaks": true,
    "preferred_hooks": [],
    "cta_style": "soft"
  }'::jsonb,

  content_preferences jsonb NOT NULL DEFAULT '{
    "expertise_areas": [],
    "storytelling_style": "personal anecdote",
    "typical_post_length": 800
  }'::jsonb,

  -- Analysis metadata
  analysis_sources jsonb NOT NULL DEFAULT '{
    "past_posts_count": 0,
    "training_docs_count": 0,
    "context_guide_words": 0,
    "last_post_analyzed_at": null
  }'::jsonb,

  -- Performance insights (updated from feedback loop)
  performance_insights jsonb DEFAULT NULL,

  -- Raw analysis data for debugging/reprocessing
  raw_analysis jsonb DEFAULT NULL,

  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Constraints
  CONSTRAINT user_voice_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_voice_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_voice_profiles_user_unique UNIQUE (user_id)
) TABLESPACE pg_default;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS user_voice_profiles_user_id_idx
  ON public.user_voice_profiles USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS user_voice_profiles_updated_at_idx
  ON public.user_voice_profiles USING btree (updated_at DESC) TABLESPACE pg_default;

-- Enable Row Level Security
ALTER TABLE public.user_voice_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own voice profile"
  ON public.user_voice_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice profile"
  ON public.user_voice_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice profile"
  ON public.user_voice_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice profile"
  ON public.user_voice_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Ghostwriter access policies
CREATE POLICY "Ghostwriters can view approver voice profiles"
  ON public.user_voice_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ghostwriter_approver_link
      WHERE ghostwriter_id = auth.uid()
      AND approver_id = user_id
      AND active = true
    )
  );

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_user_voice_profiles_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_voice_profiles_updated_at_trigger
  BEFORE UPDATE ON public.user_voice_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_voice_profiles_updated_at();

-- Comments
COMMENT ON TABLE public.user_voice_profiles IS 'Unified voice profile for each user, used by the post generation pipeline';
COMMENT ON COLUMN public.user_voice_profiles.version IS 'Auto-incremented on each update for cache invalidation';
COMMENT ON COLUMN public.user_voice_profiles.writing_style IS 'Quantified writing style attributes';
COMMENT ON COLUMN public.user_voice_profiles.performance_insights IS 'Learnings from post performance feedback loop';
