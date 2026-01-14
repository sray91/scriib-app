import { requireAuth } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

/**
 * GET /api/posts/list
 * Fetches all posts for the current user (as creator, approver, or ghostwriter)
 */
export async function GET(request) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  const { userId, supabase } = auth

  try {
    // Fetch posts related to the current user in any capacity
    // Always exclude archived posts from the dashboard
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .or(`user_id.eq.${userId},approver_id.eq.${userId},ghostwriter_id.eq.${userId}`)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching posts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch posts' },
        { status: 500 }
      )
    }

    // Fetch user data for display names
    const userIds = new Set()
    posts.forEach(post => {
      if (post.user_id) userIds.add(post.user_id)
      if (post.approver_id) userIds.add(post.approver_id)
      if (post.ghostwriter_id) userIds.add(post.ghostwriter_id)
    })

    let users = {}
    if (userIds.size > 0) {
      const { data: userData, error: userError } = await supabase
        .from('users_view')
        .select('id, email, raw_user_meta_data')
        .in('id', Array.from(userIds))

      if (!userError && userData) {
        userData.forEach(user => {
          users[user.id] = user
        })
      }
    }

    // Transform the data for display
    const formattedPosts = posts.map(post => {
      const creator = users[post.user_id]
      const approver = users[post.approver_id]
      const ghostwriter = users[post.ghostwriter_id]

      return {
        ...post,
        creator_name: creator?.raw_user_meta_data?.full_name || creator?.raw_user_meta_data?.name || creator?.email?.split('@')[0] || 'Unknown',
        approver_name: approver?.raw_user_meta_data?.full_name || approver?.raw_user_meta_data?.name || approver?.email?.split('@')[0] || null,
        ghostwriter_name: ghostwriter?.raw_user_meta_data?.full_name || ghostwriter?.raw_user_meta_data?.name || ghostwriter?.email?.split('@')[0] || null
      }
    })

    return NextResponse.json({ posts: formattedPosts, userId })
  } catch (error) {
    console.error('Error in posts/list:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
