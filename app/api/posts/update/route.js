import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // Authenticate user and get UUID
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const { id, post } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }
    
    // Use supabase (service role) to get post (bypasses RLS)
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

    // Security validation: Check if user is authorized to update this post
    // Allowed if: user is the post owner, or user is the assigned approver, or user is the assigned ghostwriter
    const isOwner = existingPost.user_id === userId;
    const isApprover = existingPost.approver_id === userId;
    const isGhostwriter = existingPost.ghostwriter_id === userId;
    
    if (!isOwner && !isApprover && !isGhostwriter) {
      return NextResponse.json(
        { error: 'You do not have permission to update this post' },
        { status: 403 }
      );
    }
    
    // Make sure user_id is carried over from the existing post
    const updatedData = {
      ...post,
      user_id: existingPost.user_id // Ensure we keep the original owner
    };
    
    // Use admin client to update (bypasses RLS)
    const { data: updatedPost, error: updateError } = await supabase
      .from('posts')
      .update(updatedData)
      .eq('id', id)
      .select()
      .single();
      
    if (updateError) {
      console.error('Error updating post:', updateError);
      return NextResponse.json(
        { error: `Failed to update post: ${updateError.message}` },
        { status: 500 }
      );
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