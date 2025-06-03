create table
  public.social_accounts (
    id uuid not null default extensions.uuid_generate_v4 (),
    user_id uuid not null,
    platform text not null,
    platform_user_id text not null,
    access_token text not null,
    refresh_token text null,
    profile_data jsonb null,
    screen_name text null,
    expires_at timestamp with time zone null,
    last_used_at timestamp with time zone null,
    created_at timestamp with time zone null default now(),
    expires_in integer null,
    constraint social_accounts_pkey primary key (id),
    constraint social_accounts_platform_user_unique unique (platform_user_id, platform),
    constraint social_accounts_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
    constraint social_accounts_platform_check check (
      (
        platform = any (array['linkedin'::text, 'linkedin_portability'::text, 'twitter'::text])
      )
    )
  ) tablespace pg_default;

create index if not exists social_accounts_user_platform_idx on public.social_accounts using btree (user_id, platform) tablespace pg_default;