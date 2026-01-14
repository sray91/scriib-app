//lib/supabase.js
// Using Clerk for authentication - Supabase is used for data only (not auth)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Singleton instance for browser - auth disabled since we use Clerk
let browserClient = null

export const getSupabase = () => {
  if (typeof window === 'undefined') {
    // Server-side: create fresh client each time (no singleton)
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  // Browser: use singleton to avoid multiple GoTrueClient instances
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return browserClient
}

// Alias for backward compatibility
export const createBrowserClient = getSupabase

export const createServerSupabaseClient = (context) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        cookie: context?.req?.headers?.cookie,
      },
    },
  })
}