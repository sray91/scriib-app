-- Training Documents table for storing uploaded context files for voice analysis
drop table if exists public.training_documents cascade;

create table
  public.training_documents (
    id uuid not null default extensions.uuid_generate_v4 (),
    user_id uuid not null,
    file_name text not null,
    file_type text not null,
    file_size integer not null,
    file_url text not null, -- Supabase storage URL
    description text null,
    extracted_text text null, -- extracted content from the document
    word_count integer not null default 0,
    processing_status text not null default 'pending',
    is_active boolean not null default true,
    metadata jsonb null, -- store additional file metadata
    created_at timestamp with time zone not null default timezone ('utc'::text, now()),
    updated_at timestamp with time zone null,
    constraint training_documents_pkey primary key (id),
    constraint training_documents_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
    constraint training_documents_file_type_check check (
      file_type = any (array['pdf'::text, 'doc'::text, 'docx'::text, 'txt'::text, 'md'::text])
    ),
    constraint training_documents_processing_status_check check (
      processing_status = any (array['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])
    )
  ) tablespace pg_default;

-- Create indexes for better performance
create index if not exists training_documents_user_id_idx on public.training_documents using btree (user_id) tablespace pg_default;
create index if not exists training_documents_created_at_idx on public.training_documents using btree (created_at desc) tablespace pg_default;
create index if not exists training_documents_processing_status_idx on public.training_documents using btree (processing_status) tablespace pg_default;
create index if not exists training_documents_active_idx on public.training_documents using btree (is_active) tablespace pg_default;
create index if not exists training_documents_user_active_idx on public.training_documents using btree (user_id, is_active) tablespace pg_default;

-- Enable Row Level Security (RLS)
alter table public.training_documents enable row level security;

-- Create RLS policies
-- Users can only see their own training documents
create policy "Users can view their own training documents" on public.training_documents
  for select using (auth.uid() = user_id);

-- Users can insert their own training documents
create policy "Users can insert their own training documents" on public.training_documents
  for insert with check (auth.uid() = user_id);

-- Users can update their own training documents
create policy "Users can update their own training documents" on public.training_documents
  for update using (auth.uid() = user_id);

-- Users can delete their own training documents
create policy "Users can delete their own training documents" on public.training_documents
  for delete using (auth.uid() = user_id);

-- Create a function to update the updated_at timestamp
create or replace function public.update_training_documents_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
create trigger update_training_documents_updated_at_trigger
  before update on public.training_documents
  for each row
  execute function public.update_training_documents_updated_at();

-- Add a comment to the table
comment on table public.training_documents is 'Stores uploaded context documents for AI voice analysis and training';
comment on column public.training_documents.extracted_text is 'Text content extracted from the uploaded document';
comment on column public.training_documents.processing_status is 'Status of document processing: pending, processing, completed, failed';
comment on column public.training_documents.metadata is 'Additional metadata about the file (author, creation date, etc.)'; 