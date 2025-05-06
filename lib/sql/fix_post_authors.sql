-- Drop the problematic function first
DROP FUNCTION IF EXISTS public.get_post_authors(uuid);

-- Create the function with a different parameter name to avoid conflict
CREATE OR REPLACE FUNCTION public.get_post_authors(p_id UUID)
RETURNS TABLE (
  post_id UUID,
  owner_id UUID,
  owner_email TEXT,
  owner_name TEXT,
  approver_id UUID,
  approver_email TEXT,
  approver_name TEXT,
  ghostwriter_id UUID,
  ghostwriter_email TEXT,
  ghostwriter_name TEXT,
  status TEXT,
  scheduled BOOLEAN,
  scheduled_time TIMESTAMPTZ
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    owner.email,
    owner_meta.full_name,
    p.approver_id,
    approver.email,
    approver_meta.full_name,
    p.ghostwriter_id,
    ghostwriter.email,
    ghostwriter_meta.full_name,
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
    ON p.ghostwriter_id = ghostwriter_meta.id
  WHERE
    p.id = p_id;
END;
$$ LANGUAGE plpgsql; 