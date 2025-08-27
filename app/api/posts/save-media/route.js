import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Create a Supabase client with the service role key to bypass RLS
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.NEXT_SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for admin client');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

export async function POST(request) {
  try {
    const { postId, mediaUrls } = await request.json();
    
    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }
    
    // Use regular client to get the current user
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Initialize the admin client only when needed
    const supabaseAdmin = getSupabaseAdmin();
    
    // Use admin client to get post (bypasses RLS)
    const { data: existingPost, error: getError } = await supabaseAdmin
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
    const isOwner = existingPost.user_id === user.id;
    const isApprover = existingPost.approver_id === user.id;
    const isGhostwriter = existingPost.ghostwriter_id === user.id;
    
    if (!isOwner && !isApprover && !isGhostwriter) {
      return NextResponse.json(
        { error: 'You do not have permission to update media for this post' },
        { status: 403 }
      );
    }
    
    // First, delete existing media for this post (using admin client to bypass RLS)
    const { error: deleteError } = await supabaseAdmin
      .from('post_media')
      .delete()
      .eq('post_id', postId);
    
    // Don't fail if there was no existing media to delete
    if (deleteError && deleteError.code !== 'PGRST116') {
      console.error('Error deleting existing media:', deleteError);
    }
    
    // If we have new media URLs, insert them
    if (mediaUrls && mediaUrls.length > 0) {
      const { data: mediaData, error: mediaError } = await supabaseAdmin
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