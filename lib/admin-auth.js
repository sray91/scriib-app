import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.NEXT_SUPABASE_SERVICE_KEY

const ADMIN_EMAIL = 'swanagan@ghostletter.us'

/**
 * Check if a user is an admin based on email or publicMetadata
 * @param {Object} user - Clerk user object
 * @returns {boolean}
 */
export function isUserAdmin(user) {
  if (!user) return false

  const email = user.emailAddresses?.[0]?.emailAddress ||
                user.primaryEmailAddress?.emailAddress

  return email === ADMIN_EMAIL || user.publicMetadata?.is_admin === true
}

/**
 * Admin authentication guard for API routes
 * Use this at the beginning of every admin-only API route
 *
 * Returns an object with either:
 * - { userId (UUID), clerkUserId, clerkUser, supabase } on success
 * - { error (NextResponse) } on failure
 *
 * Usage:
 * ```javascript
 * export async function GET(request) {
 *   const adminAuth = await requireAdmin();
 *   if (adminAuth.error) return adminAuth.error;
 *
 *   const { userId, supabase } = adminAuth;
 *   // userId is the Supabase UUID for database operations
 * }
 * ```
 */
export async function requireAdmin() {
  const { userId: clerkUserId } = await auth()

  if (!clerkUserId) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }
  }

  // Get full user details from Clerk
  const clerk = await clerkClient()
  const clerkUser = await clerk.users.getUser(clerkUserId)

  // Check admin status
  if (!isUserAdmin(clerkUser)) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }
  }

  // Use service role key to bypass RLS for admin operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get the UUID mapping for the admin user
  const { data: mapping, error: mappingError } = await supabase
    .from('clerk_user_mapping')
    .select('supabase_user_id')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (mappingError || !mapping) {
    console.error('No mapping found for admin Clerk user:', clerkUserId, mappingError)
    return {
      error: NextResponse.json(
        { error: 'Admin user mapping not found.' },
        { status: 500 }
      )
    }
  }

  return {
    userId: mapping.supabase_user_id,
    clerkUserId,
    clerkUser,
    supabase,
  }
}
