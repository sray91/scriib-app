create table
  public.ghostwriter_approver_link (
    id uuid not null default extensions.uuid_generate_v4 (),
    ghostwriter_id uuid not null,
    approver_id uuid not null,
    active boolean not null default true,
    created_at timestamp with time zone not null default timezone ('utc'::text, now()),
    revoked_at timestamp with time zone null,
    constraint ghostwriter_approver_link_pkey primary key (id),
    constraint ghostwriter_approver_link_ghostwriter_id_fkey foreign key (ghostwriter_id) references auth.users (id) on delete cascade,
    constraint ghostwriter_approver_link_approver_id_fkey foreign key (approver_id) references auth.users (id) on delete cascade,
    constraint ghostwriter_approver_link_unique unique (ghostwriter_id, approver_id)
  ) tablespace pg_default;

create index if not exists ghostwriter_approver_link_ghostwriter_idx on public.ghostwriter_approver_link using btree (ghostwriter_id) tablespace pg_default;
create index if not exists ghostwriter_approver_link_approver_idx on public.ghostwriter_approver_link using btree (approver_id) tablespace pg_default; 