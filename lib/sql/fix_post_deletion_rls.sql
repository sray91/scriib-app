-- Fix RLS policy to allow approvers and ghostwriters to delete posts they're assigned to
-- This fixes the issue where deleted posts reappear after page reload

-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

-- Create new policy that allows deletion by owner, approver, or ghostwriter
CREATE POLICY "Users can delete their own posts" 
ON public.posts
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() OR 
  approver_id = auth.uid() OR 
  ghostwriter_id = auth.uid()
);