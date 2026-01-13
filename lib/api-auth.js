import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.NEXT_SUPABASE_SERVICE_KEY

/**
 * Standard authentication guard for API routes
 * Use this at the beginning of every protected API route
 *
 * Returns an object with either:
 * - { userId (UUID), clerkUserId, supabase } on success
 * - { error (NextResponse) } on failure
 *
 * Usage:
 * ```javascript
 * export async function POST(request) {
 *   const auth = await requireAuth();
 *   if (auth.error) return auth.error;
 *
 *   const { userId, supabase } = auth;
 *   // userId is the Supabase UUID for database operations
 * }
 * ```
 */
export async function requireAuth() {
  const { userId: clerkUserId } = auth()

  if (!clerkUserId) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }
  }

  // Use service role key to bypass RLS
  // IMPORTANT: We manually check permissions in application code
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get the UUID mapping
  const { data: mapping, error: mappingError } = await supabase
    .from('clerk_user_mapping')
    .select('supabase_user_id')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (mappingError || !mapping) {
    console.error('No mapping found for Clerk user:', clerkUserId, mappingError)
    return {
      error: NextResponse.json(
        { error: 'User mapping not found. Please contact support.' },
        { status: 500 }
      )
    }
  }

  return {
    userId: mapping.supabase_user_id, // This is the UUID for database operations
    clerkUserId,
    supabase,
  }
}
