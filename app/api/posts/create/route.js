import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const postData = await request.json();
    
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in to save posts' },
        { status: 401 }
      );
    }
    
    // Prepare the post data for insertion - only include fields that exist in the table
    const insertData = {
      content: postData.content,
      scheduled_time: postData.scheduled_time,
      status: postData.status || 'draft',
      platforms: postData.platforms || { linkedin: true },
      scheduled: postData.scheduled || false,
      approver_id: postData.approver_id || null,
      ghostwriter_id: postData.ghostwriter_id || null,
      created_at: postData.created_at || new Date().toISOString(),
      user_id: user.id // Always use the authenticated user's ID
    };
    
    // Add optional fields if they exist in the schema (graceful degradation)
    if (postData.day_of_week) {
      insertData.day_of_week = postData.day_of_week;
    }
    if (postData.canvas_session_id) {
      insertData.canvas_session_id = postData.canvas_session_id;
    }
    if (postData.compiled_from_blocks) {
      insertData.compiled_from_blocks = postData.compiled_from_blocks;
    }
    
    // Insert the post into the database
    const { data: savedPost, error: insertError } = await supabase
      .from('posts')
      .insert(insertData)
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating post:', insertError);
      return NextResponse.json(
        { error: `Failed to create post: ${insertError.message}` },
        { status: 500 }
      );
    }
    
    // Handle media files if provided
    if (postData.visuals && postData.visuals.length > 0) {
      const latestVisual = postData.visuals[postData.visuals.length - 1];
      if (latestVisual && latestVisual.url) {
        try {
          await supabase
            .from('post_media')
            .insert({
              post_id: savedPost.id,
              media_urls: [latestVisual.url],
              created_at: new Date().toISOString()
            });
        } catch (mediaError) {
          console.warn('Failed to save media:', mediaError);
          // Don't fail the whole request for media issues
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      post: savedPost,
      message: 'Post created successfully',
      postForgeUrl: `/post-forge?highlight=${savedPost.id}`,
      postId: savedPost.id
    });
    
  } catch (error) {
    console.error('Error in posts/create API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
