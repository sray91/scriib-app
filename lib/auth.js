import { auth, currentUser } from '@clerk/nextjs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Get the Supabase UUID for the currently authenticated Clerk user
 * This is the KEY bridge between Clerk and your existing UUID-based database
 *
 * @returns {Promise<string|null>} The Supabase UUID or null if not found/authenticated
 */
export async function getCurrentUserUUID() {
  const { userId: clerkUserId } = auth()

  if (!clerkUserId) {
    return null
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Look up the mapping from Clerk ID to Supabase UUID
  const { data, error } = await supabase
    .from('clerk_user_mapping')
    .select('supabase_user_id')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (error || !data) {
    console.error('Error getting UUID for Clerk user:', clerkUserId, error)
    return null
  }

  return data.supabase_user_id
}

/**
 * Get full Clerk user object + UUID mapping
 *
 * @returns {Promise<Object|null>} User object with uuid property, or null
 */
export async function getCurrentUserWithUUID() {
  const user = await currentUser()

  if (!user) {
    return null
  }

  const uuid = await getCurrentUserUUID()

  return {
    ...user,
    uuid, // Add the Supabase UUID to the user object
  }
}
