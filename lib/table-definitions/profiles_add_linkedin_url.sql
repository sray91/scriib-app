-- Add linkedin_url column to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'linkedin_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN linkedin_url TEXT;
    RAISE NOTICE 'Added linkedin_url column to profiles table';
  ELSE
    RAISE NOTICE 'linkedin_url column already exists in profiles table';
  END IF;
END $$;
