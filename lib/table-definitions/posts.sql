drop table if exists public.posts cascade;

create table
  public.posts (
    id uuid not null default extensions.uuid_generate_v4 (),
    user_id uuid not null,
    content text not null,
    scheduled_time timestamp with time zone null,
    platforms jsonb null,
    status character varying not null default 'draft'::character varying,
    approver_id uuid null,
    ghostwriter_id uuid null,
    created_at timestamp with time zone not null default timezone ('utc'::text, now()),
    scheduled boolean not null default false,
    approval_comment text null,
    edited_at timestamp with time zone null,
    constraint posts_pkey primary key (id),
    constraint posts_approver_id_fkey foreign key (approver_id) references auth.users (id),
    constraint posts_user_id_fkey foreign key (user_id) references auth.users (id),
    constraint posts_ghostwriter_id_fkey foreign key (ghostwriter_id) references auth.users (id),
    constraint posts_status_check check (
      (
        status = ANY (ARRAY['draft'::character varying, 'pending_approval'::character varying, 'needs_edit'::character varying, 'approved'::character varying, 'scheduled'::character varying, 'rejected'::character varying])
      )
    )
  ) tablespace pg_default;

create index if not exists posts_user_id_idx on public.posts using btree (user_id) tablespace pg_default;
create index if not exists posts_approver_id_idx on public.posts using btree (approver_id) tablespace pg_default;
create index if not exists posts_ghostwriter_id_idx on public.posts using btree (ghostwriter_id) tablespace pg_default;