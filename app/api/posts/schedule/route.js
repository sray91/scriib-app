import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { id, scheduledTime, dayOfWeek } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }
    
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // First try to get the post with relationships for better visibility
    let { data: existingPost, error: getError } = await supabase
      .rpc('get_post_with_relationships', { p_post_id: id });
      
    if (getError || !existingPost) {
      // Fallback to basic post fetch if relationship query fails
      const { data: basicPost, error: basicError } = await supabase
        .rpc('get_post_by_id', { p_post_id: id });
      
      if (basicError || !basicPost) {
        console.error('Error fetching post:', basicError || 'Not found');
        return NextResponse.json(
          { error: `Failed to find post: ${basicError?.message || 'Not found'}` },
          { status: 404 }
        );
      }
      
      existingPost = basicPost;
    }
    
    // Security validation: Check if user is authorized to update this post
    const isOwner = existingPost.user_id === user.id;
    const isApprover = existingPost.approver_id === user.id;
    const isGhostwriter = existingPost.ghostwriter_id === user.id;
    
    if (!isOwner && !isApprover && !isGhostwriter) {
      return NextResponse.json(
        { error: 'You do not have permission to schedule this post' },
        { status: 403 }
      );
    }
    
    // Log all the key relationships involved in this post for debugging
    console.log('Post relationships:', {
      user_id: existingPost.user_id,
      approver_id: existingPost.approver_id,
      ghostwriter_id: existingPost.ghostwriter_id,
      current_user: user.id,
      user_role: isOwner ? 'owner' : isApprover ? 'approver' : 'ghostwriter'
    });
    
    // Use the improved schedule_post function that preserves relationships
    const { data: updateResult, error: updateError } = await supabase
      .rpc('schedule_post', { 
        p_id: id,
        p_scheduled_time: scheduledTime,
        p_day_of_week: dayOfWeek
      });
      
    if (updateError) {
      console.error('Error scheduling post via RPC:', updateError);
      return NextResponse.json(
        { error: `Failed to schedule post: ${updateError.message}` },
        { status: 500 }
      );
    }
    
    // Fetch the updated post with relationship info to return
    const { data: updatedPost, error: fetchError } = await supabase
      .rpc('get_post_with_relationships', { p_post_id: id });
      
    if (fetchError || !updatedPost) {
      console.error('Error fetching post with relationships:', fetchError);
      
      // Fallback to basic post info
      const { data: basicUpdated, error: basicError } = await supabase
        .rpc('get_post_by_id', { p_post_id: id });
      
      if (basicError || !basicUpdated) {
        // Last resort - return minimal success info
        return NextResponse.json({
          id: id,
          scheduled_time: scheduledTime,
          day_of_week: dayOfWeek,
          status: 'scheduled',
          scheduled: true,
          user_id: existingPost.user_id,
          approver_id: existingPost.approver_id,
          ghostwriter_id: existingPost.ghostwriter_id,
          success: true,
          note: 'Post was scheduled but complete data could not be fetched'
        });
      }
      
      return NextResponse.json(basicUpdated);
    }
    
    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error('Unexpected error in post scheduling API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 