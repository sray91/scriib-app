-- Fix for viral score calculation function
-- Run this in your Supabase SQL Editor to fix the ambiguous column reference issue

-- Function to calculate viral score for a post
CREATE OR REPLACE FUNCTION calculate_viral_score(post_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  post_age_hours DECIMAL;
  engagement_score INTEGER;
  calculated_viral_score DECIMAL;
  total_engagement INTEGER;
  base_score DECIMAL;
BEGIN
  -- Get post data
  SELECT 
    EXTRACT(EPOCH FROM (NOW() - published_at))/3600,
    (COALESCE(likes_count, 0) * 1) + (COALESCE(comments_count, 0) * 2) + (COALESCE(shares_count, 0) * 3) + (COALESCE(reactions_count, 0) * 1),
    COALESCE(likes_count, 0) + COALESCE(comments_count, 0) + COALESCE(shares_count, 0) + COALESCE(reactions_count, 0)
  INTO post_age_hours, engagement_score, total_engagement
  FROM viral_posts 
  WHERE id = post_id;

  -- Calculate base viral score
  IF post_age_hours > 0 THEN
    base_score := engagement_score / post_age_hours;
  ELSE
    base_score := engagement_score;
  END IF;

  -- Apply logarithmic scaling to normalize scores
  calculated_viral_score := LOG(1 + base_score) * 10;

  -- Calculate engagement rate (engagement per hour of existence)
  DECLARE
    calculated_engagement_rate DECIMAL;
  BEGIN
    IF post_age_hours > 0 THEN
      calculated_engagement_rate := (total_engagement / post_age_hours);
    ELSE
      calculated_engagement_rate := total_engagement;
    END IF;

    -- Cap engagement rate to fit in DECIMAL(5,2) - max 999.99
    calculated_engagement_rate := LEAST(calculated_engagement_rate, 999.99);

    -- Update the post with calculated scores
    UPDATE viral_posts 
    SET 
      viral_score = calculated_viral_score,
      engagement_rate = calculated_engagement_rate,
      is_viral = CASE 
        WHEN calculated_viral_score > 50 OR calculated_engagement_rate > 100 THEN true 
        ELSE false 
      END,
      updated_at = NOW()
    WHERE id = post_id;
  END;

  RETURN calculated_viral_score;
END;
$$ LANGUAGE plpgsql;

-- Function to update viral scores for all posts
CREATE OR REPLACE FUNCTION update_all_viral_scores()
RETURNS void AS $$
DECLARE
  post_record RECORD;
BEGIN
  FOR post_record IN SELECT id FROM viral_posts LOOP
    PERFORM calculate_viral_score(post_record.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the function to calculate scores for existing posts
SELECT update_all_viral_scores();
