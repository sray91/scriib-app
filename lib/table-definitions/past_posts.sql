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

create index if not exists past_posts_user_id_idx on public.past_posts using btree (user_id) tablespace pg_default;
create index if not exists past_posts_published_at_idx on public.past_posts using btree (published_at desc) tablespace pg_default;
create index if not exists past_posts_platform_idx on public.past_posts using btree (platform) tablespace pg_default;
create index if not exists past_posts_user_platform_idx on public.past_posts using btree (user_id, platform) tablespace pg_default; 