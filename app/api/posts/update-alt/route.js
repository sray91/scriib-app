import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export async function POST(request) {
  try {
    const { id, post } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;
    
    // First try to get the post as the current user
    let { data: existingPost, error: getError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();
      
    // If we can't access it directly (RLS restriction), use RPC function call as fallback
    if (getError) {
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('get_post_by_id', { p_post_id: id });
      
      if (rpcError || !rpcResult) {
        console.error('Error fetching post via RPC:', rpcError);
        return NextResponse.json(
          { error: `Failed to find post: ${getError?.message || 'Not found'}` },
          { status: 404 }
        );
      }
      
      existingPost = rpcResult;
    }
    
    // Security validation: Check if user is authorized to update this post
    const isOwner = existingPost.user_id === userId;
    const isApprover = existingPost.approver_id === userId;
    const isGhostwriter = existingPost.ghostwriter_id === userId;
    
    if (!isOwner && !isApprover && !isGhostwriter) {
      return NextResponse.json(
        { error: 'You do not have permission to update this post' },
        { status: 403 }
      );
    }
    
    // Keep the original user_id
    const updatedData = {
      ...post,
      user_id: existingPost.user_id
    };
    
    // Try to update using an RPC call that can bypass RLS
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_post', { 
        p_id: id,
        p_content: updatedData.content,
        p_status: updatedData.status,
        p_scheduled_time: updatedData.scheduled_time,
        p_day_of_week: updatedData.day_of_week,
        p_ghostwriter_id: updatedData.ghostwriter_id,
        p_approver_id: updatedData.approver_id,
        p_scheduled: updatedData.scheduled,
        p_user_id: updatedData.user_id
      });
      
    if (updateError) {
      console.error('Error updating post via RPC:', updateError);
      return NextResponse.json(
        { error: `Failed to update post: ${updateError.message}` },
        { status: 500 }
      );
    }
    
    // Fetch the updated post to return it
    const { data: updatedPost, error: fetchError } = await supabase
      .rpc('get_post_by_id', { p_post_id: id });
      
    if (fetchError) {
      console.error('Error fetching updated post:', fetchError);
      
      // Return partial success, update worked but couldn't fetch
      return NextResponse.json({
        id: id,
        ...updatedData,
        success: true,
        note: 'Post was updated but complete data could not be fetched'
      });
    }
    
    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error('Unexpected error in post update API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 