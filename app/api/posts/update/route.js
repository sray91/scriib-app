import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Create a Supabase client with the service role key to bypass RLS
// Initialize lazily to avoid build-time errors
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
    const { id, post } = await request.json();
    
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
    
    // Initialize the admin client only when needed
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
    
    // Security validation: Check if user is authorized to update this post
    // Allowed if: user is the post owner, or user is the assigned approver, or user is the assigned ghostwriter
    const isOwner = existingPost.user_id === user.id;
    const isApprover = existingPost.approver_id === user.id;
    const isGhostwriter = existingPost.ghostwriter_id === user.id;
    
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
    const { data: updatedPost, error: updateError } = await supabaseAdmin
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