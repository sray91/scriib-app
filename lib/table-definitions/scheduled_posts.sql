create table
  public.scheduled_posts (
    id uuid not null default extensions.uuid_generate_v4 (),
    user_id uuid null,
    profile_id uuid null,
    content text not null,
    media_urls text[] null,
    scheduled_for timestamp with time zone not null,
    status text null default 'queued'::text,
    post_id text null,
    created_at timestamp with time zone null default now(),
    updated_at timestamp with time zone null default now(),
    constraint scheduled_posts_pkey primary key (id),
    constraint scheduled_posts_user_id_fkey foreign key (user_id) references auth.users (id)
  ) tablespace pg_default;