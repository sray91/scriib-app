-- Function to safely get user details from auth.users
CREATE OR REPLACE FUNCTION public.get_user_details(user_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT
) 
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(
      (u.raw_user_meta_data->>'full_name')::TEXT,
      (u.raw_user_meta_data->>'name')::TEXT,
      u.email
    ) AS full_name
  FROM
    auth.users u
  WHERE
    u.id = user_id;
END;
$$;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_details(UUID) TO authenticated; 