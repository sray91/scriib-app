import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  
  // Parse query parameters
  const limit = parseInt(searchParams.get('limit')) || 20;
  const offset = parseInt(searchParams.get('offset')) || 0;
  const sortBy = searchParams.get('sortBy') || 'viral_score'; // viral_score, engagement_rate, published_at
  const timeframe = searchParams.get('timeframe') || 'week'; // day, week, month, all
  const minViralScore = parseFloat(searchParams.get('minViralScore')) || 0;
  const keywords = searchParams.get('keywords')?.split(',').map(k => k.trim()) || [];
  const onlyViral = searchParams.get('onlyViral') === 'true';

  try {
    let query = supabase
      .from('viral_posts')
      .select(`
        id,
        external_id,
        content,
        author_name,
        author_title,
        author_profile_url,
        author_image_url,
        post_url,
        published_at,
        scraped_at,
        likes_count,
        comments_count,
        shares_count,
        reactions_count,
        viral_score,
        engagement_rate,
        keywords,
        post_type,
        hashtags,
        mentions,
        is_viral
      `);

    // Apply time filter
    if (timeframe !== 'all') {
      let hoursBack;
      switch (timeframe) {
        case 'day':
          hoursBack = 24;
          break;
        case 'week':
          hoursBack = 168; // 7 days
          break;
        case 'month':
          hoursBack = 720; // 30 days
          break;
        default:
          hoursBack = 168;
      }
      
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      query = query.gte('published_at', cutoffTime);
    }

    // Apply viral score filter
    if (minViralScore > 0) {
      query = query.gte('viral_score', minViralScore);
    }

    // Apply viral flag filter
    if (onlyViral) {
      query = query.eq('is_viral', true);
    }

    // Apply keyword filter
    if (keywords.length > 0) {
      // Use contains operator for array overlap
      query = query.overlaps('keywords', keywords);
    }

    // Apply sorting
    const validSortFields = ['viral_score', 'engagement_rate', 'published_at', 'likes_count', 'comments_count'];
    if (validSortFields.includes(sortBy)) {
      query = query.order(sortBy, { ascending: false });
    } else {
      query = query.order('viral_score', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: posts, error } = await query;

    if (error) {
      throw error;
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('viral_posts')
      .select('*', { count: 'exact', head: true });

    // Apply same filters for count
    if (timeframe !== 'all') {
      let hoursBack;
      switch (timeframe) {
        case 'day':
          hoursBack = 24;
          break;
        case 'week':
          hoursBack = 168;
          break;
        case 'month':
          hoursBack = 720;
          break;
        default:
          hoursBack = 168;
      }
      
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      countQuery = countQuery.gte('published_at', cutoffTime);
    }

    if (minViralScore > 0) {
      countQuery = countQuery.gte('viral_score', minViralScore);
    }

    if (onlyViral) {
      countQuery = countQuery.eq('is_viral', true);
    }

    if (keywords.length > 0) {
      countQuery = countQuery.overlaps('keywords', keywords);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.warn('Could not get total count:', countError);
    }

    // Calculate pagination info
    const totalPages = count ? Math.ceil(count / limit) : 0;
    const currentPage = Math.floor(offset / limit) + 1;
    const hasNextPage = offset + limit < (count || 0);
    const hasPrevPage = offset > 0;

    return NextResponse.json({
      success: true,
      data: posts || [],
      pagination: {
        currentPage,
        totalPages,
        totalCount: count || 0,
        hasNextPage,
        hasPrevPage,
        limit,
        offset
      },
      filters: {
        sortBy,
        timeframe,
        minViralScore,
        keywords,
        onlyViral
      }
    });

  } catch (error) {
    console.error('Error fetching viral posts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch viral posts',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// POST endpoint to update viral scores manually
export async function POST(request) {
  const supabase = getSupabase();
  
  try {
    const { action } = await request.json();
    
    if (action === 'updateScores') {
      const { error } = await supabase.rpc('update_all_viral_scores');
      
      if (error) {
        throw error;
      }
      
      return NextResponse.json({
        success: true,
        message: 'Viral scores updated successfully'
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Error in posts POST:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
