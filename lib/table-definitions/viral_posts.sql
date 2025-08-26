-- Drop table if exists
DROP TABLE IF EXISTS public.viral_posts CASCADE;

-- Create viral_posts table for storing scraped LinkedIn posts
CREATE TABLE public.viral_posts (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  external_id TEXT UNIQUE NOT NULL, -- LinkedIn post ID from Apify
  content TEXT NOT NULL,
  author_name TEXT,
  author_title TEXT,
  author_profile_url TEXT,
  author_image_url TEXT,
  post_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  reactions_count INTEGER DEFAULT 0,
  viral_score DECIMAL(10,2) DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  keywords TEXT[],
  post_type TEXT, -- 'text', 'image', 'video', 'article', etc.
  media_urls TEXT[],
  hashtags TEXT[],
  mentions TEXT[],
  is_viral BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS viral_posts_external_id_idx ON public.viral_posts USING btree (external_id);
CREATE INDEX IF NOT EXISTS viral_posts_viral_score_idx ON public.viral_posts USING btree (viral_score DESC);
CREATE INDEX IF NOT EXISTS viral_posts_published_at_idx ON public.viral_posts USING btree (published_at DESC);
CREATE INDEX IF NOT EXISTS viral_posts_scraped_at_idx ON public.viral_posts USING btree (scraped_at DESC);
CREATE INDEX IF NOT EXISTS viral_posts_is_viral_idx ON public.viral_posts USING btree (is_viral);
CREATE INDEX IF NOT EXISTS viral_posts_engagement_rate_idx ON public.viral_posts USING btree (engagement_rate DESC);

-- Create a GIN index for keyword searches
CREATE INDEX IF NOT EXISTS viral_posts_keywords_gin_idx ON public.viral_posts USING gin (keywords);
CREATE INDEX IF NOT EXISTS viral_posts_hashtags_gin_idx ON public.viral_posts USING gin (hashtags);
