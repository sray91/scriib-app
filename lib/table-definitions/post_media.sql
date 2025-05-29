create table if not exists
  public.post_media (
    id uuid not null default extensions.uuid_generate_v4 (),
    post_id uuid not null,
    media_urls text[] null,
    created_at timestamp with time zone not null default timezone ('utc'::text, now()),
    updated_at timestamp with time zone null,
    constraint post_media_pkey primary key (id),
    constraint post_media_post_id_fkey foreign key (post_id) references public.posts (id) on delete cascade
  ) tablespace pg_default;

create index if not exists post_media_post_id_idx on public.post_media using btree (post_id) tablespace pg_default;

-- RLS Policy for post_media
alter table public.post_media enable row level security;

-- Users can view media for posts they own or they are associated with as approver or ghostwriter
create policy "Users can view media for posts they own or are assigned to"
  on public.post_media
  for select
  to authenticated
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_media.post_id
      and (
        posts.user_id = auth.uid() or
        posts.approver_id = auth.uid() or
        posts.ghostwriter_id = auth.uid()
      )
    )
  );

-- Users can create media for posts they own
create policy "Users can create media for posts they own"
  on public.post_media
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.posts
      where posts.id = post_media.post_id
      and posts.user_id = auth.uid()
    )
  );

-- Users can update media for posts they own
create policy "Users can update media for posts they own"
  on public.post_media
  for update
  to authenticated
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_media.post_id
      and posts.user_id = auth.uid()
    )
  );

-- Users can delete media for posts they own
create policy "Users can delete media for posts they own"
  on public.post_media
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.posts
      where posts.id = post_media.post_id
      and posts.user_id = auth.uid()
    )
  ); 