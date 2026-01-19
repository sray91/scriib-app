import { requireAdmin } from '@/lib/admin-auth'
import { clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/users
 * Fetch all users with details from Clerk API, joined with Supabase UUID mapping
 */
export async function GET(request) {
  const adminAuth = await requireAdmin()
  if (adminAuth.error) return adminAuth.error

  const { supabase } = adminAuth

  try {
    // Get query params for pagination
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search') || ''

    // Fetch all users from Clerk
    const clerk = await clerkClient()
    const clerkUsers = await clerk.users.getUserList({
      limit,
      offset,
      ...(search && { query: search }),
    })

    // Get all UUID mappings from Supabase
    const { data: mappings, error: mappingError } = await supabase
      .from('clerk_user_mapping')
      .select('clerk_user_id, supabase_user_id')

    if (mappingError) {
      console.error('Error fetching mappings:', mappingError)
    }

    // Create a lookup map for clerk_id -> supabase_uuid
    const mappingLookup = {}
    if (mappings) {
      mappings.forEach(m => {
        mappingLookup[m.clerk_user_id] = m.supabase_user_id
      })
    }

    // Format user data
    const users = clerkUsers.data.map(user => ({
      id: user.id,
      supabaseId: mappingLookup[user.id] || null,
      email: user.emailAddresses[0]?.emailAddress || 'No email',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown',
      imageUrl: user.imageUrl,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
      publicMetadata: user.publicMetadata,
      isAdmin: user.emailAddresses[0]?.emailAddress === 'swanagan@ghostletter.us' ||
               user.publicMetadata?.is_admin === true,
    }))

    return NextResponse.json({
      success: true,
      data: users,
      totalCount: clerkUsers.totalCount,
      hasMore: offset + users.length < clerkUsers.totalCount,
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
