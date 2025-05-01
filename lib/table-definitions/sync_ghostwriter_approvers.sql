-- This script helps fix foreign key constraint issues
-- It copies users from auth.users to ensure they exist for the ghostwriter_approver_link table

-- First create a trigger to automatically add users from auth.users to ghostwriter_approver_link
CREATE OR REPLACE FUNCTION public.sync_auth_users_for_ghostwriter_links()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the ghostwriter exists in the users_view or auth.users
  -- If not, find it in auth.users and ensure there's a corresponding profile
  IF NOT EXISTS (
    SELECT 1 FROM public.users_view WHERE id = NEW.ghostwriter_id
  ) THEN
    -- Insert might fail if the user doesn't exist in auth.users at all
    -- But we try anyway
    BEGIN
      INSERT INTO public.profiles (id, created_at)
      SELECT id, created_at
      FROM auth.users
      WHERE id = NEW.ghostwriter_id
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Just log and continue - the trigger shouldn't prevent the INSERT/UPDATE
      RAISE NOTICE 'Could not sync ghostwriter ID: %', NEW.ghostwriter_id;
    END;
  END IF;

  -- Same for approver
  IF NOT EXISTS (
    SELECT 1 FROM public.users_view WHERE id = NEW.approver_id
  ) THEN
    BEGIN
      INSERT INTO public.profiles (id, created_at)
      SELECT id, created_at
      FROM auth.users
      WHERE id = NEW.approver_id
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not sync approver ID: %', NEW.approver_id;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS sync_users_for_links ON public.ghostwriter_approver_link;
CREATE TRIGGER sync_users_for_links
BEFORE INSERT OR UPDATE ON public.ghostwriter_approver_link
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_users_for_ghostwriter_links();

-- Run this once to fix existing issues
-- This will ensure all users referenced in ghostwriter_approver_link exist in profiles
INSERT INTO public.profiles (id, created_at)
SELECT DISTINCT u.id, u.created_at
FROM auth.users u
JOIN (
  SELECT ghostwriter_id AS user_id FROM public.ghostwriter_approver_link
  UNION
  SELECT approver_id FROM public.ghostwriter_approver_link
) links ON u.id = links.user_id
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING; 