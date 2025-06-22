drop table if exists public.trending_posts cascade;

create table
  public.trending_posts (
    id uuid not null default extensions.uuid_generate_v4 (),
    content text not null,
    likes integer not null default 0,
    comments integer not null default 0,
    shares integer not null default 0,
    views integer null,
    platform text not null default 'linkedin',
    author_name text null,
    author_title text null,
    post_url text null,
    post_type text null, -- text, image, video, article, etc.
    industry_tags text[] null, -- array of industry/topic tags
    engagement_rate numeric(5,2) null, -- calculated engagement rate
    source text null, -- where this trending post data came from
    raw_data jsonb null, -- store full data for future reference
    is_active boolean not null default true, -- to enable/disable posts
    created_at timestamp with time zone not null default timezone ('utc'::text, now()),
    updated_at timestamp with time zone null,
    constraint trending_posts_pkey primary key (id),
    constraint trending_posts_platform_check check (
      platform = any (array['linkedin'::text, 'twitter'::text, 'facebook'::text, 'instagram'::text])
    ),
    constraint trending_posts_engagement_rate_check check (
      engagement_rate >= 0 and engagement_rate <= 100
    )
  ) tablespace pg_default;

-- Create indexes for better query performance
create index if not exists trending_posts_platform_idx on public.trending_posts using btree (platform) tablespace pg_default;
create index if not exists trending_posts_created_at_idx on public.trending_posts using btree (created_at desc) tablespace pg_default;
create index if not exists trending_posts_likes_idx on public.trending_posts using btree (likes desc) tablespace pg_default;
create index if not exists trending_posts_engagement_rate_idx on public.trending_posts using btree (engagement_rate desc) tablespace pg_default;
create index if not exists trending_posts_active_idx on public.trending_posts using btree (is_active) tablespace pg_default;

-- Enable Row Level Security
alter table public.trending_posts enable row level security;

-- Create RLS policies
-- Note: Trending posts are generally public data, so we allow read access to authenticated users
drop policy if exists "Authenticated users can view trending posts" on public.trending_posts;
create policy "Authenticated users can view trending posts" 
on public.trending_posts
for select
to authenticated
using (is_active = true);

-- Only allow admins/system to insert/update trending posts
-- You might want to create a specific role for this
drop policy if exists "Service role can manage trending posts" on public.trending_posts;
create policy "Service role can manage trending posts" 
on public.trending_posts
for all
to service_role
using (true)
with check (true); 