import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Helper function to get Supabase admin client
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
    const { id, archived = true } = await request.json();
    
    if (!id) {
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
    
    // Initialize the admin client
    const supabaseAdmin = getSupabaseAdmin();
    
    // Use admin client to get post (bypasses RLS)
    const { data: existingPost, error: getError } = await supabaseAdmin
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
    const isOwner = existingPost.user_id === user.id;
    const isApprover = existingPost.approver_id === user.id;
    
    if (!isOwner && !isApprover) {
      return NextResponse.json(
        { error: 'You do not have permission to archive this post' },
        { status: 403 }
      );
    }
    
    // Update the archived status
    const { data: updatedPost, error: updateError } = await supabaseAdmin
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
