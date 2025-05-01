-- Update posts table to incorporate new approval flow

DO $$ 
BEGIN
  -- Add ghostwriter_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'ghostwriter_id') THEN
    ALTER TABLE public.posts ADD COLUMN ghostwriter_id uuid NULL REFERENCES auth.users(id);
    RAISE NOTICE 'Added ghostwriter_id column';
  END IF;

  -- Add scheduled flag if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'scheduled') THEN
    ALTER TABLE public.posts ADD COLUMN scheduled boolean NOT NULL DEFAULT false;
    RAISE NOTICE 'Added scheduled column';
  END IF;

  -- Add edited_at if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'edited_at') THEN
    ALTER TABLE public.posts ADD COLUMN edited_at timestamp with time zone NULL;
    RAISE NOTICE 'Added edited_at column';
  END IF;

  -- Convert existing approval_status field values to new status values (if applicable)
  -- Only run this if we haven't done the migration yet
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'approval_status') THEN
    -- Create backup of existing status values
    ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS old_status character varying;
    UPDATE public.posts SET old_status = status;
    RAISE NOTICE 'Backed up status values';

    -- Update posts with 'approved' approval_status
    UPDATE public.posts 
    SET status = 'approved'
    WHERE approval_status = 'approved' AND status = 'draft';
    RAISE NOTICE 'Updated approved posts';

    -- Update posts with 'rejected' approval_status
    UPDATE public.posts 
    SET status = 'rejected'
    WHERE approval_status = 'rejected' AND status = 'draft';
    RAISE NOTICE 'Updated rejected posts';

    -- Update posts with 'pending' approval_status and requires_approval is true
    UPDATE public.posts 
    SET status = 'pending_approval'
    WHERE approval_status = 'pending' AND requires_approval = true AND status = 'draft';
    RAISE NOTICE 'Updated pending approval posts';

    -- Set scheduled=true for all approved posts
    UPDATE public.posts
    SET scheduled = true
    WHERE status = 'approved';
    RAISE NOTICE 'Updated scheduled flag for approved posts';
  END IF;
END $$;

-- Ensure check constraint for status exists with all the new statuses
DO $$ 
BEGIN
  -- First, try to drop the existing status constraint if it exists
  BEGIN
    -- This may fail if constraint doesn't exist, so we wrap it in a sub-transaction
    ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check;
    RAISE NOTICE 'Dropped existing status constraint if present';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing status constraint to drop';
  END;

  -- Add the new constraint with all required statuses
  BEGIN
    ALTER TABLE public.posts ADD CONSTRAINT posts_status_check CHECK (
      status = ANY (ARRAY[
        'draft'::character varying, 
        'pending_approval'::character varying, 
        'needs_edit'::character varying, 
        'approved'::character varying, 
        'scheduled'::character varying, 
        'rejected'::character varying
      ])
    );
    RAISE NOTICE 'Added new status constraint';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add status constraint: %', SQLERRM;
  END;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON public.posts USING btree (user_id);
CREATE INDEX IF NOT EXISTS posts_approver_id_idx ON public.posts USING btree (approver_id);
CREATE INDEX IF NOT EXISTS posts_ghostwriter_id_idx ON public.posts USING btree (ghostwriter_id);

-- Update status column constraints
DO $$
BEGIN
  -- Make status NOT NULL if it's currently nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posts' AND column_name = 'status' AND is_nullable = 'YES'
  ) THEN
    -- Update any NULL values to 'draft' before making NOT NULL
    UPDATE public.posts SET status = 'draft' WHERE status IS NULL;
    ALTER TABLE public.posts ALTER COLUMN status SET NOT NULL;
    RAISE NOTICE 'Made status column NOT NULL';
  END IF;

  -- Set the default value to 'draft' if not already set
  ALTER TABLE public.posts ALTER COLUMN status SET DEFAULT 'draft';
  RAISE NOTICE 'Set status default to draft';
END $$;

-- Optional: You can uncomment this section if you want to drop legacy columns after migration
/*
DO $$
BEGIN
  -- Only run if migration is complete (check if we have at least some data using new status values)
  IF EXISTS (SELECT 1 FROM public.posts WHERE status IN ('pending_approval', 'needs_edit', 'scheduled')) THEN
    -- Drop legacy columns that are no longer needed
    ALTER TABLE public.posts DROP COLUMN IF EXISTS requires_approval;
    ALTER TABLE public.posts DROP COLUMN IF EXISTS approval_status;
    ALTER TABLE public.posts DROP COLUMN IF EXISTS old_status;
    ALTER TABLE public.posts DROP COLUMN IF EXISTS approved_at;
    ALTER TABLE public.posts DROP COLUMN IF EXISTS approved_by;
    RAISE NOTICE 'Dropped legacy approval columns';
  END IF;
END $$;
*/ 