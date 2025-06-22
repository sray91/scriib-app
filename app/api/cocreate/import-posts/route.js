import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
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
          user_id: user.id,
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