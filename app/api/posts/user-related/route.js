import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Use the enhanced function to get posts with relationship data
    let { data, error } = await supabase
      .rpc('get_user_related_post_authors', { user_uuid: user.id });
    
    if (error) {
      console.error('Error fetching user related post authors:', error);
      
      // Fallback to the basic function if the new one fails
      const { data: basicData, error: basicError } = await supabase
        .rpc('get_user_related_posts', { user_uuid: user.id });
      
      if (basicError) {
        console.error('Error fetching basic post data:', basicError);
        return NextResponse.json(
          { error: `Failed to fetch posts: ${basicError.message}` },
          { status: 500 }
        );
      }
      
      data = basicData;
    }
    
    // Filter by status if provided
    let filteredData = data;
    if (status && data) {
      filteredData = data.filter(post => post.status === status);
    }
    
    // Sort the posts by scheduled time (nearest first)
    if (filteredData) {
      filteredData.sort((a, b) => {
        const timeA = a.scheduled_time ? new Date(a.scheduled_time).getTime() : Infinity;
        const timeB = b.scheduled_time ? new Date(b.scheduled_time).getTime() : Infinity;
        return timeA - timeB;
      });
    }
    
    // Apply pagination after filtering and sorting
    const paginatedData = filteredData?.slice(offset, offset + limit) || [];
    
    // Get a count of each post status for this user
    const statusCounts = {};
    if (data) {
      for (const post of data) {
        statusCounts[post.status] = (statusCounts[post.status] || 0) + 1;
      }
    }
    
    // Prepare response with role information
    const postsWithRoles = paginatedData.map(post => {
      const userRole = post.owner_id === user.id 
        ? 'owner' 
        : post.approver_id === user.id 
          ? 'approver' 
          : 'ghostwriter';
      
      return {
        ...post,
        current_user_role: userRole
      };
    });
    
    return NextResponse.json({
      posts: postsWithRoles,
      totalCount: filteredData?.length || 0,
      statusCounts: statusCounts,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error in user related posts API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 