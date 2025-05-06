-- Function to fetch a post by ID, bypassing RLS policies
CREATE OR REPLACE FUNCTION public.get_post_by_id(p_post_id UUID)
RETURNS SETOF public.posts
SECURITY DEFINER -- This makes the function run with the privileges of the owner
AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM public.posts WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

-- Add RLS bypass comment to clarify the purpose
COMMENT ON FUNCTION public.get_post_by_id(UUID) IS 'Gets a post by ID, bypassing RLS policies';

-- Function to update a post, bypassing RLS policies
CREATE OR REPLACE FUNCTION public.update_post(
  p_id UUID,
  p_content TEXT,
  p_status VARCHAR,
  p_scheduled_time TIMESTAMPTZ,
  p_day_of_week VARCHAR DEFAULT NULL,
  p_ghostwriter_id UUID DEFAULT NULL,
  p_approver_id UUID DEFAULT NULL,
  p_scheduled BOOLEAN DEFAULT FALSE,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER -- This makes the function run with the privileges of the owner
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Ensure post exists
  SELECT COUNT(*) INTO v_count FROM public.posts WHERE id = p_id;
  
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Post with ID % not found', p_id;
  END IF;

  -- Perform the update
  UPDATE public.posts
  SET 
    content = p_content,
    status = p_status,
    scheduled_time = p_scheduled_time,
    day_of_week = p_day_of_week,
    ghostwriter_id = p_ghostwriter_id,
    approver_id = p_approver_id,
    scheduled = p_scheduled,
    edited_at = NOW()
  WHERE id = p_id;
  
  -- If user_id is provided and valid, update it too (be careful with this!)
  IF p_user_id IS NOT NULL THEN
    -- Validate user exists in auth.users
    SELECT COUNT(*) INTO v_count FROM auth.users WHERE id = p_user_id;
    IF v_count > 0 THEN
      UPDATE public.posts SET user_id = p_user_id WHERE id = p_id;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add RLS bypass comment to clarify the purpose
COMMENT ON FUNCTION public.update_post(UUID, TEXT, VARCHAR, TIMESTAMPTZ, VARCHAR, UUID, UUID, BOOLEAN, UUID) 
IS 'Updates a post bypassing RLS policies - use with caution';

-- Function specifically to schedule a post
CREATE OR REPLACE FUNCTION public.schedule_post(
  p_id UUID,
  p_scheduled_time TIMESTAMPTZ,
  p_day_of_week VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER -- This makes the function run with the privileges of the owner
AS $$
DECLARE
  v_count INTEGER;
  v_post RECORD;
BEGIN
  -- Get the post to preserve all the important fields
  SELECT * INTO v_post FROM public.posts WHERE id = p_id;
  
  IF v_post IS NULL THEN
    RAISE EXCEPTION 'Post with ID % not found', p_id;
  END IF;

  -- Update only the scheduling fields while preserving relationships
  UPDATE public.posts
  SET 
    status = 'scheduled',
    scheduled_time = p_scheduled_time,
    day_of_week = p_day_of_week,
    scheduled = TRUE,
    edited_at = NOW(),
    -- Ensure we preserve the relationships - explicitly keep these fields
    ghostwriter_id = v_post.ghostwriter_id,
    approver_id = v_post.approver_id,
    user_id = v_post.user_id
  WHERE id = p_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add RLS bypass comment to clarify the purpose
COMMENT ON FUNCTION public.schedule_post(UUID, TIMESTAMPTZ, VARCHAR) 
IS 'Schedules a post by setting status and scheduled fields, bypassing RLS policies';

-- Function to get all posts for a user (owner, approver, or ghostwriter)
CREATE OR REPLACE FUNCTION public.get_user_related_posts(user_uuid UUID)
RETURNS SETOF public.posts
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.posts
  WHERE user_id = user_uuid 
     OR approver_id = user_uuid 
     OR ghostwriter_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Add RLS bypass comment to clarify the purpose
COMMENT ON FUNCTION public.get_user_related_posts(UUID) 
IS 'Gets all posts related to a user (as owner, approver, or ghostwriter), bypassing RLS';

-- Create a view for better post visibility across roles
CREATE OR REPLACE VIEW public.posts_with_relationships AS
SELECT 
  p.*,
  owner.email as owner_email,
  owner_meta.full_name as owner_name,
  approver.email as approver_email,
  approver_meta.full_name as approver_name,
  ghostwriter.email as ghostwriter_email,
  ghostwriter_meta.full_name as ghostwriter_name
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

-- Function to get detailed post info with relationships
CREATE OR REPLACE FUNCTION public.get_post_with_relationships(p_post_id UUID)
RETURNS SETOF public.posts_with_relationships
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.posts_with_relationships
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment for clarity
COMMENT ON FUNCTION public.get_post_with_relationships(UUID)
IS 'Gets a post with related user information, bypassing RLS policies';

-- Updated RLS policy helper function
CREATE OR REPLACE FUNCTION public.is_post_visible_to_user(post_row public.posts, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Post is visible if user is the owner, approver, or ghostwriter
  RETURN 
    post_row.user_id = user_id OR 
    post_row.approver_id = user_id OR 
    post_row.ghostwriter_id = user_id;
END;
$$;

-- Function to get post author information for UI display
CREATE OR REPLACE FUNCTION public.get_post_authors(p_post_id UUID)
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
    p.id = p_post_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get author information for all posts related to a user
CREATE OR REPLACE FUNCTION public.get_user_related_post_authors(user_uuid UUID)
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
    p.user_id = user_uuid OR
    p.approver_id = user_uuid OR
    p.ghostwriter_id = user_uuid;
END;
$$ LANGUAGE plpgsql; 