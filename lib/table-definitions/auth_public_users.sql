-- Create a public view of auth.users with limited information
-- This allows accessing user email and ID without admin permissions
CREATE OR REPLACE VIEW public.auth_public_users AS
SELECT 
  id,
  email,
  raw_user_meta_data->>'full_name' as full_name,
  raw_user_meta_data->>'name' as name,
  created_at
FROM auth.users;

-- Grant appropriate permissions
ALTER VIEW public.auth_public_users OWNER TO authenticated;
GRANT SELECT ON public.auth_public_users TO authenticated;
GRANT SELECT ON public.auth_public_users TO anon;

-- Row level security - only allow users to see themselves and users they're connected to
DROP POLICY IF EXISTS "Users can view themselves and connected users" ON public.auth_public_users;
CREATE POLICY "Users can view themselves and connected users"
ON public.auth_public_users
FOR SELECT
TO authenticated
USING (
  -- Allow users to see their own data
  id = auth.uid() 
  OR 
  -- Allow users to see data of ghostwriters they're connected to as approvers
  EXISTS (
    SELECT 1 FROM public.ghostwriter_approver_link
    WHERE approver_id = auth.uid() AND ghostwriter_id = auth_public_users.id
  )
  OR
  -- Allow users to see data of approvers they're connected to as ghostwriters
  EXISTS (
    SELECT 1 FROM public.ghostwriter_approver_link
    WHERE ghostwriter_id = auth.uid() AND approver_id = auth_public_users.id
  )
); 