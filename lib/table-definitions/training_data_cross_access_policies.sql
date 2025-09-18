-- Add RLS policies to allow ghostwriters to access their approvers' training data and vice versa
-- This enables the feature where ghostwriters can manage approvers' training data

-- Helper function to check if current user can access another user's training data
CREATE OR REPLACE FUNCTION can_access_user_training_data(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Users can always access their own data
  IF auth.uid() = target_user_id THEN
    RETURN TRUE;
  END IF;

  -- Check if current user is linked to target user via ghostwriter_approver_link
  RETURN EXISTS (
    SELECT 1 FROM public.ghostwriter_approver_link
    WHERE active = true
    AND (
      (ghostwriter_id = auth.uid() AND approver_id = target_user_id) OR
      (ghostwriter_id = target_user_id AND approver_id = auth.uid())
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRAINING DOCUMENTS: Add cross-access policies
-- Allow linked users to view each other's training documents
CREATE POLICY "Linked users can view training documents"
    ON public.training_documents
    FOR SELECT
    USING (can_access_user_training_data(user_id));

-- Allow linked users to insert training documents for each other
CREATE POLICY "Linked users can insert training documents"
    ON public.training_documents
    FOR INSERT
    WITH CHECK (can_access_user_training_data(user_id));

-- Allow linked users to update each other's training documents
CREATE POLICY "Linked users can update training documents"
    ON public.training_documents
    FOR UPDATE
    USING (can_access_user_training_data(user_id))
    WITH CHECK (can_access_user_training_data(user_id));

-- Allow linked users to delete each other's training documents
CREATE POLICY "Linked users can delete training documents"
    ON public.training_documents
    FOR DELETE
    USING (can_access_user_training_data(user_id));

-- TRENDING POSTS: Add cross-access policies
-- First, we need to add a user_id column to trending_posts if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'trending_posts'
                 AND column_name = 'user_id') THEN
    ALTER TABLE public.trending_posts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS trending_posts_user_id_idx
        ON public.trending_posts USING btree (user_id) TABLESPACE pg_default;
  END IF;
END $$;

-- Update existing trending posts to have user_id (this might need manual data migration)
-- For now, we'll leave them as NULL for global trending posts

-- Allow linked users to view each other's trending posts
CREATE POLICY "Linked users can view trending posts"
    ON public.trending_posts
    FOR SELECT
    USING (user_id IS NULL OR can_access_user_training_data(user_id));

-- Allow linked users to insert trending posts for each other
CREATE POLICY "Linked users can insert trending posts"
    ON public.trending_posts
    FOR INSERT
    WITH CHECK (user_id IS NULL OR can_access_user_training_data(user_id));

-- Allow linked users to update each other's trending posts
CREATE POLICY "Linked users can update trending posts"
    ON public.trending_posts
    FOR UPDATE
    USING (user_id IS NULL OR can_access_user_training_data(user_id))
    WITH CHECK (user_id IS NULL OR can_access_user_training_data(user_id));

-- Allow linked users to delete each other's trending posts
CREATE POLICY "Linked users can delete trending posts"
    ON public.trending_posts
    FOR DELETE
    USING (user_id IS NULL OR can_access_user_training_data(user_id));

-- USER PREFERENCES: Add cross-access policies
-- Allow linked users to view each other's user preferences
CREATE POLICY "Linked users can view user preferences"
    ON public.user_preferences
    FOR SELECT
    USING (can_access_user_training_data(user_id));

-- Allow linked users to insert user preferences for each other
CREATE POLICY "Linked users can insert user preferences"
    ON public.user_preferences
    FOR INSERT
    WITH CHECK (can_access_user_training_data(user_id));

-- Allow linked users to update each other's user preferences
CREATE POLICY "Linked users can update user preferences"
    ON public.user_preferences
    FOR UPDATE
    USING (can_access_user_training_data(user_id))
    WITH CHECK (can_access_user_training_data(user_id));

-- Grant permissions to authenticated users to use the helper function
GRANT EXECUTE ON FUNCTION can_access_user_training_data(UUID) TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION can_access_user_training_data(UUID) IS 'Helper function to check if the current user can access another users training data based on ghostwriter_approver_link relationships';