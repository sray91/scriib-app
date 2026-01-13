import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;
    
    // In a production app, you would fetch trending posts from a service or database
    // For now, we'll return an empty array with an error message
    
    // Check if we have trending posts stored in the database
    const { data: trendingPosts, error: postsError } = await supabase
      .from('trending_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (!postsError && trendingPosts && trendingPosts.length > 0) {
      // Return trending posts from database
      return NextResponse.json({
        posts: trendingPosts.map(post => ({
          id: post.id,
          content: post.content,
          engagement: { 
            likes: post.likes || 0,
            comments: post.comments || 0,
            shares: post.shares || 0
          }
        }))
      });
    }
    
    // If no posts in database, return empty array with error
    return NextResponse.json({
      posts: [],
      error: 'No trending posts available. This feature requires a data source for trending content.'
    });
    
  } catch (error) {
    console.error('Error in trending-posts API:', error);
    return NextResponse.json(
      { error: 'Internal server error', posts: [] },
      { status: 500 }
    );
  }
} 