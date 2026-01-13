import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export async function POST(req) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    // Parse request body
    const body = await req.json();
    const { posts, source } = body;

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { error: 'No posts provided' },
        { status: 400 }
      );
    }

    console.log(`Received ${posts.length} posts from ${source || 'unknown source'}`);

    // Store posts in the database
    const { data: storedPosts, error: storeError } = await supabase
      .from('linkedin_posts')
      .upsert(
        posts.map(post => ({
          user_id: userId,
          content: post.content,
          likes: post.engagement?.likes || 0,
          comments: post.engagement?.comments || 0,
          shares: post.engagement?.shares || 0,
          timestamp: post.timestamp || new Date().toISOString(),
          source: source || 'apify-scraper'
        })),
        { onConflict: 'user_id, content' }
      );
    
    if (storeError) {
      console.error('Error storing posts:', storeError);
      return NextResponse.json(
        { error: 'Failed to store posts' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully imported ${posts.length} posts`,
      count: posts.length
    });
    
  } catch (error) {
    console.error('Error in import-posts API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 