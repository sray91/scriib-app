create table
  public.posts (
    id uuid not null default extensions.uuid_generate_v4 (),
    user_id uuid null,
    content text not null,
    scheduled_time timestamp with time zone null,
    platforms jsonb null,
    status character varying null default 'draft'::character varying,
    approver_id uuid null,
    created_at timestamp with time zone null default timezone ('utc'::text, now()),
    constraint posts_pkey primary key (id),
    constraint posts_approver_id_fkey foreign key (approver_id) references auth.users (id),
    constraint posts_user_id_fkey foreign key (user_id) references auth.users (id)
  ) tablespace pg_default;