-- Migration: Create past_posts table for storing LinkedIn posts
-- Run this in your Supabase SQL editor or database client

-- Create the past_posts table
drop table if exists public.past_posts cascade;

create table
  public.past_posts (
    id uuid not null default extensions.uuid_generate_v4 (),
    user_id uuid not null,
    platform text not null default 'linkedin',
    platform_post_id text not null,
    content text not null,
    published_at timestamp with time zone not null,
    post_url text null,
    media_urls jsonb null,
    metrics jsonb null, -- stores likes, comments, shares, views, etc.
    post_type text null, -- article, image, video, text, etc.
    visibility text null, -- public, connections, private
    raw_data jsonb null, -- store the full API response for future reference
    created_at timestamp with time zone not null default timezone ('utc'::text, now()),
    updated_at timestamp with time zone null,
    constraint past_posts_pkey primary key (id),
    constraint past_posts_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
    constraint past_posts_platform_post_unique unique (platform_post_id, platform, user_id),
    constraint past_posts_platform_check check (
      platform = any (array['linkedin'::text, 'twitter'::text, 'facebook'::text, 'instagram'::text])
    )
  ) tablespace pg_default;

-- Create indexes for better performance
create index if not exists past_posts_user_id_idx on public.past_posts using btree (user_id) tablespace pg_default;
create index if not exists past_posts_published_at_idx on public.past_posts using btree (published_at desc) tablespace pg_default;
create index if not exists past_posts_platform_idx on public.past_posts using btree (platform) tablespace pg_default;
create index if not exists past_posts_user_platform_idx on public.past_posts using btree (user_id, platform) tablespace pg_default;

-- Enable Row Level Security (RLS)
alter table public.past_posts enable row level security;

-- Create RLS policies
-- Users can only see their own past posts
create policy "Users can view their own past posts" on public.past_posts
  for select using (auth.uid() = user_id);

-- Users can insert their own past posts
create policy "Users can insert their own past posts" on public.past_posts
  for insert with check (auth.uid() = user_id);

-- Users can update their own past posts
create policy "Users can update their own past posts" on public.past_posts
  for update using (auth.uid() = user_id);

-- Users can delete their own past posts
create policy "Users can delete their own past posts" on public.past_posts
  for delete using (auth.uid() = user_id);

-- Update the social_accounts table constraint to include linkedin_portability
alter table public.social_accounts drop constraint if exists social_accounts_platform_check;
alter table public.social_accounts add constraint social_accounts_platform_check check (
  platform = any (array['linkedin'::text, 'linkedin_portability'::text, 'twitter'::text])
);

-- Add a comment to the table
comment on table public.past_posts is 'Stores past posts imported from various social media platforms';
comment on column public.past_posts.metrics is 'JSON object containing engagement metrics like likes, comments, shares, views';
comment on column public.past_posts.raw_data is 'Full API response data for debugging and future feature development';

-- Create a function to update the updated_at timestamp
create or replace function public.update_past_posts_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
create trigger update_past_posts_updated_at_trigger
  before update on public.past_posts
  for each row
  execute function public.update_past_posts_updated_at(); 