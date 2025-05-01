-- Add user_id column to user_time_blocks if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_time_blocks' AND column_name = 'user_id') THEN
    -- Add the column as nullable initially
    ALTER TABLE public.user_time_blocks ADD COLUMN user_id uuid REFERENCES auth.users(id);

    -- Find the first user in the system to use as a fallback owner
    DECLARE
      default_user_id uuid;
    BEGIN
      -- Get the first user from auth.users
      SELECT id INTO default_user_id FROM auth.users ORDER BY created_at LIMIT 1;
      
      IF default_user_id IS NOT NULL THEN
        -- Update existing rows to assign to the default user
        UPDATE public.user_time_blocks SET user_id = default_user_id WHERE user_id IS NULL;
        RAISE NOTICE 'Associated all time blocks with user ID: %', default_user_id;
      ELSE
        RAISE WARNING 'No users found in auth.users table';
      END IF;
    END;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.user_time_blocks ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own time blocks" ON public.user_time_blocks;
CREATE POLICY "Users can view their own time blocks" 
ON public.user_time_blocks
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can insert their own time blocks" ON public.user_time_blocks;
CREATE POLICY "Users can insert their own time blocks" 
ON public.user_time_blocks
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update their own time blocks" ON public.user_time_blocks;
CREATE POLICY "Users can update their own time blocks" 
ON public.user_time_blocks
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL)
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can delete their own time blocks" ON public.user_time_blocks;
CREATE POLICY "Users can delete their own time blocks" 
ON public.user_time_blocks
FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

-- Create linkage from user_tasks to user_id through user_time_blocks
-- Enable Row Level Security on user_tasks
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for user_tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.user_tasks;
CREATE POLICY "Users can view their own tasks" 
ON public.user_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_time_blocks
    WHERE user_time_blocks.id = user_tasks.time_block_id
    AND (user_time_blocks.user_id = auth.uid() OR user_time_blocks.user_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.user_tasks;
CREATE POLICY "Users can insert their own tasks" 
ON public.user_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_time_blocks
    WHERE user_time_blocks.id = user_tasks.time_block_id
    AND (user_time_blocks.user_id = auth.uid() OR user_time_blocks.user_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can update their own tasks" ON public.user_tasks;
CREATE POLICY "Users can update their own tasks" 
ON public.user_tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_time_blocks
    WHERE user_time_blocks.id = user_tasks.time_block_id
    AND (user_time_blocks.user_id = auth.uid() OR user_time_blocks.user_id IS NULL)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_time_blocks
    WHERE user_time_blocks.id = user_tasks.time_block_id
    AND (user_time_blocks.user_id = auth.uid() OR user_time_blocks.user_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.user_tasks;
CREATE POLICY "Users can delete their own tasks" 
ON public.user_tasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_time_blocks
    WHERE user_time_blocks.id = user_tasks.time_block_id
    AND (user_time_blocks.user_id = auth.uid() OR user_time_blocks.user_id IS NULL)
  )
);

-- Create RLS policy for posts table if not already exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'posts' 
    AND policyname = 'Users can view their own posts'
  ) THEN
    -- Enable RLS on posts if not already enabled
    ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
    
    -- Create basic policies
    CREATE POLICY "Users can view their own posts" 
    ON public.posts
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
    
    CREATE POLICY "Users can insert their own posts" 
    ON public.posts
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Users can update their own posts" 
    ON public.posts
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());
    
    CREATE POLICY "Users can delete their own posts" 
    ON public.posts
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$; 