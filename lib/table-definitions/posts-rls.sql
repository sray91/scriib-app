-- Enable Row Level Security on posts table
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Explicit policy for users to see only their own posts
DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;
CREATE POLICY "Users can view their own posts" 
ON public.posts
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  approver_id = auth.uid() OR 
  ghostwriter_id = auth.uid()
);

-- Allow users to insert only their own posts
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
CREATE POLICY "Users can insert their own posts" 
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(user_id, auth.uid()) = auth.uid()
);

-- Allow users to update posts they own or are assigned to
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" 
ON public.posts
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR 
  approver_id = auth.uid() OR 
  ghostwriter_id = auth.uid()
)
WITH CHECK (
  -- Can still update if they are associated with the post
  user_id = auth.uid() OR 
  approver_id = auth.uid() OR 
  ghostwriter_id = auth.uid()
);

-- Allow users to delete only their own posts
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts" 
ON public.posts
FOR DELETE
TO authenticated
USING (user_id = auth.uid()); 