-- Add AI personalization fields to campaigns table
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS use_ai_personalization BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_instructions TEXT,
ADD COLUMN IF NOT EXISTS ai_tone TEXT DEFAULT 'professional', -- professional, casual, friendly
ADD COLUMN IF NOT EXISTS ai_max_length INTEGER DEFAULT 200, -- character limit for AI-generated messages
ADD COLUMN IF NOT EXISTS follow_up_use_ai BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS follow_up_ai_instructions TEXT;

-- Add comment to explain the fields
COMMENT ON COLUMN public.campaigns.use_ai_personalization IS 'Whether to use AI to personalize connection messages';
COMMENT ON COLUMN public.campaigns.ai_instructions IS 'Instructions for AI on how to personalize messages';
COMMENT ON COLUMN public.campaigns.ai_tone IS 'Tone for AI-generated messages: professional, casual, or friendly';
COMMENT ON COLUMN public.campaigns.ai_max_length IS 'Maximum character length for AI-generated messages';
COMMENT ON COLUMN public.campaigns.follow_up_use_ai IS 'Whether to use AI for follow-up messages';
COMMENT ON COLUMN public.campaigns.follow_up_ai_instructions IS 'Instructions for AI on how to personalize follow-up messages';
