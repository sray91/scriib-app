import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 100); // Max 100 posts per request
    const platform = searchParams.get('platform') || 'linkedin';
    const sortBy = searchParams.get('sortBy') || 'published_at';
    const order = searchParams.get('order') || 'desc';
    const targetUserId = searchParams.get('userId'); // Allow filtering by specific user
    
    const offset = (page - 1) * limit;

    // Determine which user's posts to fetch
    let userIdToQuery = user.id; // Default to current user
    
    if (targetUserId && targetUserId !== user.id) {
      // Check if current user has permission to access target user's posts
      const hasPermission = await checkUserPermission(supabase, user.id, targetUserId);
      if (!hasPermission) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
      userIdToQuery = targetUserId;
    }

    // Build query
    let query = supabase
      .from('past_posts')
      .select(`
        id,
        platform,
        platform_post_id,
        content,
        published_at,
        post_url,
        media_urls,
        metrics,
        post_type,
        visibility,
        created_at
      `)
      .eq('user_id', userIdToQuery)
      .eq('platform', platform)
      .order(sortBy, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: posts, error: postsError } = await query;

    if (postsError) {
      throw postsError;
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('past_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('platform', platform);

    if (countError) {
      throw countError;
    }

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      data: {
        posts: posts.map(post => ({
          ...post,
          content_preview: post.content.length > 200 
            ? post.content.substring(0, 200) + '...'
            : post.content
        })),
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_count: count,
          has_next_page: hasNextPage,
          has_prev_page: hasPrevPage,
          limit
        }
      }
    });

  } catch (error) {
    console.error('Failed to fetch past posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch past posts', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const deleteAll = searchParams.get('deleteAll') === 'true';

    if (deleteAll) {
      // Delete all past posts for the user
      const { error } = await supabase
        .from('past_posts')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: 'All past posts deleted successfully'
      });
    } else if (postId) {
      // Delete specific post
      const { error } = await supabase
        .from('past_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: 'Post deleted successfully'
      });
    } else {
      return NextResponse.json(
        { error: 'Either postId or deleteAll parameter is required' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Failed to delete past posts:', error);
    return NextResponse.json(
      { error: 'Failed to delete past posts', details: error.message },
      { status: 500 }
    );
  }
}

async function checkUserPermission(supabase, currentUserId, targetUserId) {
  try {
    // If user is accessing their own data, allow it
    if (currentUserId === targetUserId) {
      return true;
    }

    // Check if current user is linked to target user through ghostwriter_approver_link
    const { data, error } = await supabase
      .from('ghostwriter_approver_link')
      .select('*')
      .or(`and(ghostwriter_id.eq.${currentUserId},approver_id.eq.${targetUserId}),and(ghostwriter_id.eq.${targetUserId},approver_id.eq.${currentUserId})`)
      .eq('active', true);

    if (error) throw error;

    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
} 