import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;
    
    // Use the enhanced function to get posts with relationship data
    let { data, error } = await supabase
      .rpc('get_user_related_post_authors', { user_uuid: userId });
    
    if (error) {
      console.error('Error fetching user related post authors:', error);
      
      // Fallback to the basic function if the new one fails
      const { data: basicData, error: basicError } = await supabase
        .rpc('get_user_related_posts', { user_uuid: userId });
      
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
      const userRole = post.owner_id === userId
        ? 'owner'
        : post.approver_id === userId
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
        id: userId
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