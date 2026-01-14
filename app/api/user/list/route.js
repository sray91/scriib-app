import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

/**
 * API endpoint to get all users (for team management, etc.)
 * Returns list of users with their Clerk and Supabase UUIDs
 */
export async function GET(request) {
  try {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { userId, supabase } = auth

    // Get all user mappings with Clerk metadata
    const { data: mappings, error } = await supabase
      .from('clerk_user_mapping')
      .select('clerk_user_id, supabase_user_id')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user mappings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    // Return the mappings with supabase_user_id as the id field
    // Note: To get full user details (email, name, etc.), you would need to
    // fetch from Clerk's API using the clerk_user_id
    const users = (mappings || []).map(mapping => ({
      id: mapping.supabase_user_id,
      clerk_id: mapping.clerk_user_id,
      // Using clerk_id as display name for now - ideally fetch from Clerk API
      display_name: mapping.clerk_user_id,
      email: mapping.clerk_user_id // Placeholder until proper Clerk integration
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error in GET /api/user/list:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
