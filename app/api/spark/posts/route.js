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
    console.log('📊 Posts API called with params:', {
      limit, offset, sortBy, timeframe, minViralScore, keywords, onlyViral
    });

    // First, let's test if there are ANY posts in the table at all
    const testQuery = await supabase
      .from('viral_posts')
      .select('id, published_at, scraped_at, viral_score, content')
      .limit(5);
    
    console.log('🧪 Test query - Raw posts in table:', testQuery.data?.length || 0);
    if (testQuery.data?.length > 0) {
      console.log('📝 Sample raw post:', {
        id: testQuery.data[0].id,
        published_at: testQuery.data[0].published_at,
        scraped_at: testQuery.data[0].scraped_at,
        viral_score: testQuery.data[0].viral_score,
        content_preview: testQuery.data[0].content?.substring(0, 50)
      });
    }

    // TEMP: Use a simplified select to debug the issue
    let query = supabase
      .from('viral_posts')
      .select('*');

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
      console.log(`⏰ Filtering posts newer than ${cutoffTime} (${hoursBack} hours back)`);
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
    const validSortFields = ['viral_score', 'engagement_rate', 'published_at', 'scraped_at', 'likes_count', 'comments_count'];
    if (validSortFields.includes(sortBy)) {
      query = query.order(sortBy, { ascending: false });
    } else {
      query = query.order('scraped_at', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    console.log('🔍 About to execute main query...');
    const { data: posts, error } = await query;

    // If we get 0 posts, let's try a super simple query to see what's wrong
    if (!posts || posts.length === 0) {
      console.log('❌ Main query returned 0 posts, testing simpler queries...');
      
      // Test 1: Simplest possible query
      const simpleTest = await supabase
        .from('viral_posts')
        .select('id, content, scraped_at')
        .limit(3);
      console.log('🧪 Simple query result:', simpleTest.data?.length || 0);
      
      // Test 2: Query with just sorting
      const sortTest = await supabase
        .from('viral_posts')
        .select('id, content, scraped_at')
        .order('scraped_at', { ascending: false })
        .limit(3);
      console.log('🧪 Sort test result:', sortTest.data?.length || 0);
      
      // Test 3: Query with range
      const rangeTest = await supabase
        .from('viral_posts')
        .select('id, content, scraped_at')
        .order('scraped_at', { ascending: false })
        .range(0, 2);
      console.log('🧪 Range test result:', rangeTest.data?.length || 0);
      
      if (simpleTest.error) console.log('❌ Simple test error:', simpleTest.error);
      if (sortTest.error) console.log('❌ Sort test error:', sortTest.error);
      if (rangeTest.error) console.log('❌ Range test error:', rangeTest.error);
    }

    console.log(`🔍 Query executed, found ${posts?.length || 0} posts`);
    if (posts?.length > 0) {
      console.log('📅 Sample post published_at:', posts[0].published_at);
      console.log('📊 Sample post data:', {
        id: posts[0].id,
        content: posts[0].content?.substring(0, 100),
        viral_score: posts[0].viral_score,
        is_viral: posts[0].is_viral
      });
    }

    if (error) {
      console.error('❌ Database query error:', error);
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
