import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { postId, mediaUrls } = await request.json();

    if (!postId) {
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
      .eq('id', postId)
      .single();
      
    if (getError) {
      console.error('Error fetching post:', getError);
      return NextResponse.json(
        { error: `Failed to find post: ${getError.message}` },
        { status: 404 }
      );
    }
    
    // Security validation: Check if user is authorized to update this post's media
    // Allowed if: user is the post owner, or user is the assigned approver, or user is the assigned ghostwriter
    const isOwner = existingPost.user_id === userId;
    const isApprover = existingPost.approver_id === userId;
    const isGhostwriter = existingPost.ghostwriter_id === userId;
    
    if (!isOwner && !isApprover && !isGhostwriter) {
      return NextResponse.json(
        { error: 'You do not have permission to update media for this post' },
        { status: 403 }
      );
    }
    
    // First, delete existing media for this post (using service role client to bypass RLS)
    const { error: deleteError } = await supabase
      .from('post_media')
      .delete()
      .eq('post_id', postId);

    // Don't fail if there was no existing media to delete
    if (deleteError && deleteError.code !== 'PGRST116') {
      console.error('Error deleting existing media:', deleteError);
    }

    // If we have new media URLs, insert them
    if (mediaUrls && mediaUrls.length > 0) {
      const { data: mediaData, error: mediaError } = await supabase
        .from('post_media')
        .insert({
          post_id: postId,
          media_urls: mediaUrls,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (mediaError) {
        console.error('Error saving media:', mediaError);
        return NextResponse.json(
          { error: `Failed to save media: ${mediaError.message}` },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Media saved successfully',
        data: mediaData
      });
    } else {
      // No media to save, just return success
      return NextResponse.json({
        success: true,
        message: 'Media cleared successfully'
      });
    }
    
  } catch (error) {
    console.error('Unexpected error in save media API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}