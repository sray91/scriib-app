-- Fix RLS policies for trending_posts table to allow authenticated users to add training data

-- Drop existing policies
drop policy if exists "Authenticated users can view trending posts" on public.trending_posts;
drop policy if exists "Service role can manage trending posts" on public.trending_posts;

-- Allow authenticated users to view active trending posts
create policy "Authenticated users can view trending posts" 
on public.trending_posts
for select
to authenticated
using (is_active = true);

-- Allow authenticated users to insert trending posts (for training data feature)
create policy "Authenticated users can add trending posts" 
on public.trending_posts
for insert
to authenticated
with check (true);

-- Allow authenticated users to update trending posts they can see
create policy "Authenticated users can update trending posts" 
on public.trending_posts
for update
to authenticated
using (is_active = true)
with check (true);

-- Allow authenticated users to delete trending posts they can see
create policy "Authenticated users can delete trending posts" 
on public.trending_posts
for delete
to authenticated
using (is_active = true);

-- Still allow service role full access for admin operations
create policy "Service role can manage all trending posts" 
on public.trending_posts
for all
to service_role
using (true)
with check (true); 