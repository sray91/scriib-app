-- One-time script to initialize user data for existing templates
DO $$ 
DECLARE
  default_user_id uuid;
  existing_count integer;
  post_count integer;
  has_user_id boolean;
BEGIN
  -- Check if user_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_time_blocks' AND column_name = 'user_id'
  ) INTO has_user_id;

  -- If user_id column doesn't exist, add it
  IF NOT has_user_id THEN
    ALTER TABLE public.user_time_blocks ADD COLUMN user_id uuid REFERENCES auth.users(id);
    RAISE NOTICE 'Added user_id column to user_time_blocks';
  END IF;

  -- Find the first user in the system
  SELECT id INTO default_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  
  IF default_user_id IS NULL THEN
    RAISE WARNING 'No users found in the system, cannot complete migration';
    RETURN;
  END IF;

  -- Count templates with NULL user_id
  SELECT COUNT(*) INTO existing_count FROM public.user_time_blocks WHERE user_id IS NULL;
  
  IF existing_count > 0 THEN
    RAISE NOTICE 'Found % templates with NULL user_id', existing_count;
    
    -- Update existing templates to this user
    UPDATE public.user_time_blocks SET user_id = default_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'Updated % templates to user %', existing_count, default_user_id;
  ELSE
    RAISE NOTICE 'No templates need updating';
  END IF;
  
  -- Also check for posts with NULL user_id
  SELECT COUNT(*) INTO post_count FROM public.posts WHERE user_id IS NULL;
  
  IF post_count > 0 THEN
    RAISE NOTICE 'Found % posts with NULL user_id', post_count;
    
    -- Update posts to the default user
    UPDATE public.posts SET user_id = default_user_id WHERE user_id IS NULL;
    RAISE NOTICE 'Updated % posts to user %', post_count, default_user_id;
  ELSE
    RAISE NOTICE 'No posts need updating';
  END IF;
  
  -- Now enable RLS on user_time_blocks
  ALTER TABLE public.user_time_blocks ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE 'Enabled RLS on user_time_blocks';
  
  -- Create RLS policies
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
  
  RAISE NOTICE 'Created RLS policies for user_time_blocks';

  -- Also enable RLS on user_tasks
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
  
  RAISE NOTICE 'Created RLS policies for user_tasks';
  
  -- Enable RLS for posts
  ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
  
  -- Create policies for posts
  DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;
  CREATE POLICY "Users can view their own posts" 
  ON public.posts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    approver_id = auth.uid() OR 
    ghostwriter_id = auth.uid()
  );
  
  DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
  CREATE POLICY "Users can insert their own posts" 
  ON public.posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(user_id, auth.uid()) = auth.uid()
  );
  
  DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
  CREATE POLICY "Users can update their own posts" 
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    approver_id = auth.uid() OR 
    ghostwriter_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid() OR 
    approver_id = auth.uid() OR 
    ghostwriter_id = auth.uid()
  );
  
  DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
  CREATE POLICY "Users can delete their own posts" 
  ON public.posts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
  
  RAISE NOTICE 'Created RLS policies for posts';
  
END $$; 