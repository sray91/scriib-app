import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('post_id');
    
    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required via ?post_id=<uuid>' },
        { status: 400 }
      );
    }
    
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;
    
    // Test our functions with the correct parameter names
    const results = {};
    
    // Test get_post_by_id
    try {
      const { data, error } = await supabase
        .rpc('get_post_by_id', { p_post_id: postId });
      
      results.get_post_by_id = {
        success: !error,
        error: error?.message,
        data: data ? 'Has data' : 'No data',
        sample: data ? { id: data.id, status: data.status } : null
      };
    } catch (e) {
      results.get_post_by_id = { success: false, error: e.message };
    }
    
    // Test get_post_with_relationships
    try {
      const { data, error } = await supabase
        .rpc('get_post_with_relationships', { p_post_id: postId });
      
      results.get_post_with_relationships = {
        success: !error,
        error: error?.message,
        data: data ? 'Has data' : 'No data',
        sample: data ? { 
          id: data.id, 
          owner_email: data.owner_email,
          approver_email: data.approver_email,
          ghostwriter_email: data.ghostwriter_email
        } : null
      };
    } catch (e) {
      results.get_post_with_relationships = { success: false, error: e.message };
    }
    
    // Test get_post_authors
    try {
      const { data, error } = await supabase
        .rpc('get_post_authors', { p_id: postId });
      
      results.get_post_authors = {
        success: !error,
        error: error?.message,
        data: data ? 'Has data' : 'No data',
        sample: data ? { 
          post_id: data.post_id, 
          owner_name: data.owner_name,
          approver_name: data.approver_name,
          ghostwriter_name: data.ghostwriter_name
        } : null
      };
    } catch (e) {
      results.get_post_authors = { success: false, error: e.message };
    }
    
    return NextResponse.json({
      message: 'Function test results',
      results,
      user_id: userId
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 