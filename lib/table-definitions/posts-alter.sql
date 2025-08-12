-- Example of ALTER TABLE to add new columns or modify existing ones
-- Use this approach if you want to modify the structure without losing data

-- Add columns if they don't exist
DO $$ 
BEGIN
  -- Add approver_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'approver_id') THEN
    ALTER TABLE public.posts ADD COLUMN approver_id uuid NULL REFERENCES auth.users(id);
  END IF;

  -- Add ghostwriter_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'ghostwriter_id') THEN
    ALTER TABLE public.posts ADD COLUMN ghostwriter_id uuid NULL REFERENCES auth.users(id);
  END IF;

  -- Add scheduled flag if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'scheduled') THEN
    ALTER TABLE public.posts ADD COLUMN scheduled boolean NOT NULL DEFAULT false;
  END IF;

  -- Add approval_comment if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'approval_comment') THEN
    ALTER TABLE public.posts ADD COLUMN approval_comment text NULL;
  END IF;

  -- Add edited_at if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'edited_at') THEN
    ALTER TABLE public.posts ADD COLUMN edited_at timestamp with time zone NULL;
  END IF;
END $$;

-- Ensure check constraint for status exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'posts_status_check' AND table_name = 'posts') THEN
    ALTER TABLE public.posts ADD CONSTRAINT posts_status_check CHECK (
      status = ANY (ARRAY['draft'::character varying, 'pending_approval'::character varying, 'needs_edit'::character varying, 'approved'::character varying, 'scheduled'::character varying, 'rejected'::character varying])
    );
  END IF;
END $$;

-- Add phone_number and sms_opt_in to profiles if missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_number'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN phone_number text;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'sms_opt_in'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN sms_opt_in boolean NOT NULL DEFAULT false;
    END IF;
  END IF;
END $$;


-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON public.posts USING btree (user_id) tablespace pg_default;
CREATE INDEX IF NOT EXISTS posts_approver_id_idx ON public.posts USING btree (approver_id) tablespace pg_default;
CREATE INDEX IF NOT EXISTS posts_ghostwriter_id_idx ON public.posts USING btree (ghostwriter_id) tablespace pg_default; 