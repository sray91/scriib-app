-- Drop existing RLS policies for posts table
DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

-- Drop relationship-based policies if they exist
DROP POLICY IF EXISTS "Approvers can view assigned posts" ON public.posts;
DROP POLICY IF EXISTS "Ghostwriters can view assigned posts" ON public.posts;
DROP POLICY IF EXISTS "Approvers can update assigned posts" ON public.posts;
DROP POLICY IF EXISTS "Ghostwriters can update assigned posts" ON public.posts;

-- Enable RLS on posts table if not already enabled
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Policy for owners to view their own posts
CREATE POLICY "Users can view their own posts"
ON public.posts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy for owners to insert their own posts
CREATE POLICY "Users can insert their own posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy for owners to update their own posts
CREATE POLICY "Users can update their own posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for owners to delete their own posts
CREATE POLICY "Users can delete their own posts"
ON public.posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy for approvers to view posts they are assigned to
CREATE POLICY "Approvers can view assigned posts"
ON public.posts
FOR SELECT
TO authenticated
USING (auth.uid() = approver_id);

-- Policy for ghostwriters to view posts they are assigned to
CREATE POLICY "Ghostwriters can view assigned posts"
ON public.posts
FOR SELECT
TO authenticated
USING (auth.uid() = ghostwriter_id);

-- Policy for approvers to update posts they are assigned to
CREATE POLICY "Approvers can update assigned posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (auth.uid() = approver_id);

-- Policy for ghostwriters to update posts they are assigned to
CREATE POLICY "Ghostwriters can update assigned posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (auth.uid() = ghostwriter_id);

-- Create a helper view for UI to show post authors
-- This view will automatically inherit RLS permissions from the posts table
CREATE OR REPLACE VIEW public.post_authors AS
SELECT 
  p.id as post_id,
  p.user_id as owner_id,
  owner.email as owner_email,
  owner_meta.full_name as owner_name,
  p.approver_id,
  approver.email as approver_email,
  approver_meta.full_name as approver_name,
  p.ghostwriter_id,
  ghostwriter.email as ghostwriter_email,
  ghostwriter_meta.full_name as ghostwriter_name,
  p.status,
  p.scheduled,
  p.scheduled_time
FROM 
  public.posts p
LEFT JOIN 
  auth.users owner ON p.user_id = owner.id
LEFT JOIN 
  (SELECT id, raw_user_meta_data->>'full_name' as full_name FROM auth.users) owner_meta 
  ON p.user_id = owner_meta.id
LEFT JOIN 
  auth.users approver ON p.approver_id = approver.id
LEFT JOIN 
  (SELECT id, raw_user_meta_data->>'full_name' as full_name FROM auth.users) approver_meta 
  ON p.approver_id = approver_meta.id
LEFT JOIN 
  auth.users ghostwriter ON p.ghostwriter_id = ghostwriter.id
LEFT JOIN 
  (SELECT id, raw_user_meta_data->>'full_name' as full_name FROM auth.users) ghostwriter_meta 
  ON p.ghostwriter_id = ghostwriter_meta.id; 