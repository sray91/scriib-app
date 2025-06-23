-- User Style Presets Table for Model Ensemble
-- Stores reusable style presets created by Claude 4 Sonnet from user's past posts

drop table if exists public.user_style_presets cascade;

create table
  public.user_style_presets (
    id uuid not null default extensions.uuid_generate_v4 (),
    user_id uuid not null,
    preset_name text not null,
    style_data jsonb not null, -- stores the full style analysis from Claude
    source_model text not null default 'Claude 4 Sonnet',
    source_posts_count integer default 0, -- how many posts were analyzed
    is_active boolean not null default true,
    created_at timestamp with time zone not null default timezone ('utc'::text, now()),
    updated_at timestamp with time zone null,
    constraint user_style_presets_pkey primary key (id),
    constraint user_style_presets_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
    constraint user_style_presets_preset_name_user_unique unique (user_id, preset_name)
  ) tablespace pg_default;

-- Create indexes for better performance
create index if not exists user_style_presets_user_id_idx on public.user_style_presets using btree (user_id) tablespace pg_default;
create index if not exists user_style_presets_active_idx on public.user_style_presets using btree (is_active) where is_active = true tablespace pg_default;
create index if not exists user_style_presets_created_at_idx on public.user_style_presets using btree (created_at desc) tablespace pg_default;

-- Enable Row Level Security (RLS)
alter table public.user_style_presets enable row level security;

-- Create RLS policies
-- Users can only see their own style presets
create policy "Users can view their own style presets" on public.user_style_presets
  for select using (auth.uid() = user_id);

-- Users can insert their own style presets
create policy "Users can insert their own style presets" on public.user_style_presets
  for insert with check (auth.uid() = user_id);

-- Users can update their own style presets
create policy "Users can update their own style presets" on public.user_style_presets
  for update using (auth.uid() = user_id);

-- Users can delete their own style presets
create policy "Users can delete their own style presets" on public.user_style_presets
  for delete using (auth.uid() = user_id);

-- Create a function to update the updated_at timestamp
create or replace function public.update_user_style_presets_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
create trigger update_user_style_presets_updated_at_trigger
  before update on public.user_style_presets
  for each row
  execute function public.update_user_style_presets_updated_at();

-- Add comments to the table
comment on table public.user_style_presets is 'Stores reusable style presets created by the Model Ensemble for authentic voice generation';
comment on column public.user_style_presets.style_data is 'JSON object containing comprehensive style analysis from Claude 4 Sonnet';
comment on column public.user_style_presets.source_posts_count is 'Number of past posts analyzed to create this preset'; 