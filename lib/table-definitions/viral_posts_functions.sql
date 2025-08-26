-- Function to calculate viral score for a post
CREATE OR REPLACE FUNCTION calculate_viral_score(post_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  post_age_hours DECIMAL;
  engagement_score INTEGER;
  viral_score DECIMAL;
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
  viral_score := LOG(1 + base_score) * 10;

  -- Calculate engagement rate (engagement per hour of existence)
  DECLARE
    engagement_rate DECIMAL;
  BEGIN
    IF post_age_hours > 0 THEN
      engagement_rate := (total_engagement / post_age_hours) * 100;
    ELSE
      engagement_rate := total_engagement * 100;
    END IF;

    -- Update the post with calculated scores
    UPDATE viral_posts 
    SET 
      viral_score = viral_score,
      engagement_rate = LEAST(engagement_rate, 9999.99), -- Cap at 9999.99%
      is_viral = CASE 
        WHEN viral_score > 50 OR engagement_rate > 100 THEN true 
        ELSE false 
      END,
      updated_at = NOW()
    WHERE id = post_id;
  END;

  RETURN viral_score;
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

-- Function to get trending posts within a time period
CREATE OR REPLACE FUNCTION get_trending_posts(
  hours_back INTEGER DEFAULT 24,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  author_name TEXT,
  post_url TEXT,
  viral_score DECIMAL,
  engagement_rate DECIMAL,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  published_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vp.id,
    vp.content,
    vp.author_name,
    vp.post_url,
    vp.viral_score,
    vp.engagement_rate,
    vp.likes_count,
    vp.comments_count,
    vp.shares_count,
    vp.published_at
  FROM viral_posts vp
  WHERE vp.published_at >= NOW() - INTERVAL '1 hour' * hours_back
  ORDER BY vp.viral_score DESC, vp.engagement_rate DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update viral score when engagement metrics change
CREATE OR REPLACE FUNCTION trigger_update_viral_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate if engagement metrics changed
  IF (OLD.likes_count IS DISTINCT FROM NEW.likes_count) OR
     (OLD.comments_count IS DISTINCT FROM NEW.comments_count) OR
     (OLD.shares_count IS DISTINCT FROM NEW.shares_count) OR
     (OLD.reactions_count IS DISTINCT FROM NEW.reactions_count) THEN
    PERFORM calculate_viral_score(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_viral_score_trigger ON viral_posts;
CREATE TRIGGER update_viral_score_trigger
  AFTER UPDATE ON viral_posts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_viral_score();
