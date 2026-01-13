-- Clerk Authentication Migration
-- This migration creates the infrastructure needed to use Clerk authentication
-- while maintaining compatibility with existing UUID-based database schema

-- Create mapping table: Clerk user ID → Supabase UUID
CREATE TABLE IF NOT EXISTS public.clerk_user_mapping (
  clerk_user_id text PRIMARY KEY,
  supabase_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on clerk_user_mapping
ALTER TABLE public.clerk_user_mapping ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own mapping
CREATE POLICY "Users can view their own mapping"
ON public.clerk_user_mapping
FOR SELECT
TO authenticated
USING (supabase_user_id = auth.uid());

-- Helper function: Clerk ID → UUID
-- This function is used throughout the application to convert Clerk user IDs to UUIDs
CREATE OR REPLACE FUNCTION public.get_uuid_from_clerk_id(clerk_id text)
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT supabase_user_id
    FROM public.clerk_user_mapping
    WHERE clerk_user_id = clerk_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: UUID → Clerk ID
-- This function is used to get Clerk user ID from UUID if needed
CREATE OR REPLACE FUNCTION public.get_clerk_id_from_uuid(user_uuid uuid)
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT clerk_user_id
    FROM public.clerk_user_mapping
    WHERE supabase_user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_clerk_user_mapping_supabase_id
ON public.clerk_user_mapping(supabase_user_id);

CREATE INDEX IF NOT EXISTS idx_clerk_user_mapping_clerk_id
ON public.clerk_user_mapping(clerk_user_id);

-- Grant permissions
GRANT SELECT ON public.clerk_user_mapping TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_uuid_from_clerk_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clerk_id_from_uuid(uuid) TO authenticated;

-- Verification queries (run these after migration to verify)
-- SELECT COUNT(*) FROM clerk_user_mapping;
-- SELECT * FROM clerk_user_mapping WHERE supabase_user_id NOT IN (SELECT id FROM auth.users);
