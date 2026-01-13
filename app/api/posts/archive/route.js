import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { id, archived = true } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    // Use service role client to get post (bypasses RLS)
    const { data: existingPost, error: getError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();
      
    if (getError) {
      console.error('Error fetching post:', getError);
      return NextResponse.json(
        { error: `Failed to find post: ${getError.message}` },
        { status: 404 }
      );
    }
    
    // Security validation: Check if user is authorized to archive this post
    // Allowed if: user is the post owner, or user is the assigned approver
    const isOwner = existingPost.user_id === userId;
    const isApprover = existingPost.approver_id === userId;
    
    if (!isOwner && !isApprover) {
      return NextResponse.json(
        { error: 'You do not have permission to archive this post' },
        { status: 403 }
      );
    }
    
    // Update the archived status
    const { data: updatedPost, error: updateError } = await supabase
      .from('posts')
      .update({ 
        archived: archived,
        edited_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
      
    if (updateError) {
      console.error('Error updating post archive status:', updateError);
      return NextResponse.json(
        { error: `Failed to archive post: ${updateError.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      post: updatedPost,
      message: archived ? 'Post archived successfully' : 'Post unarchived successfully'
    });
  } catch (error) {
    console.error('Unexpected error in post archive API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
