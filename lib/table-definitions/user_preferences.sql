-- User Preferences table to store per-user settings in a JSON document

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_preferences'
  ) THEN
    CREATE TABLE public.user_preferences (
      user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      settings jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
      updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
    );

    -- Enable RLS and add policies so users can only access their own preferences
    ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view their own preferences" ON public.user_preferences
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert their own preferences" ON public.user_preferences
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own preferences" ON public.user_preferences
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- Trigger function to update updated_at on change
    CREATE OR REPLACE FUNCTION public.set_user_preferences_updated_at()
    RETURNS trigger AS $f$
    BEGIN
      NEW.updated_at = timezone('utc'::text, now());
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
    CREATE TRIGGER trg_user_preferences_updated_at
      BEFORE UPDATE ON public.user_preferences
      FOR EACH ROW
      EXECUTE FUNCTION public.set_user_preferences_updated_at();
  END IF;
END $$;


