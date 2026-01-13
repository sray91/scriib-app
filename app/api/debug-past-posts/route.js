import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;
    
    console.log(`🔍 Debug: Checking past posts for user ${userId}`);
    
    // Fetch user's past posts from database
    const { data: posts, error, count } = await supabase
      .from('past_posts')
      .select(`
        id,
        content,
        published_at,
        metrics,
        post_type,
        post_url,
        platform
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('published_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching past posts:', error);
      return NextResponse.json({
        error: 'Database error',
        details: error.message
      }, { status: 500 });
    }

    // Also check for any posts regardless of platform
    const { data: allPosts, error: allError, count: allCount } = await supabase
      .from('past_posts')
      .select('id, platform, published_at', { count: 'exact' })
      .eq('user_id', userId);

    return NextResponse.json({
      success: true,
      user_id: userId,
      linkedin_posts: {
        count: posts?.length || 0,
        total_count: count,
        sample_posts: posts?.slice(0, 3).map(post => ({
          id: post.id,
          content_preview: post.content?.substring(0, 200) + (post.content?.length > 200 ? '...' : ''),
          content_length: post.content?.length,
          published_at: post.published_at,
          post_type: post.post_type,
          platform: post.platform
        })) || []
      },
      all_posts: {
        total_count: allCount,
        platforms: allPosts?.reduce((acc, post) => {
          acc[post.platform] = (acc[post.platform] || 0) + 1;
          return acc;
        }, {}) || {}
      }
    });
    
  } catch (error) {
    console.error('Error in debug past posts API:', error);
    return NextResponse.json(
      { 
        error: "Failed to fetch debug info",
        details: error.message
      }, 
      { status: 500 }
    );
  }
} 