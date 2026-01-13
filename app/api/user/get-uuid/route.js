import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API endpoint to get the Supabase UUID for the current Clerk user
 * Used by client components to get their UUID for database operations
 */
export async function GET(request) {
  const { userId: clerkUserId } = auth()

  if (!clerkUserId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data, error } = await supabase
    .from('clerk_user_mapping')
    .select('supabase_user_id')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (error || !data) {
    console.error('Mapping not found for Clerk user:', clerkUserId, error)
    return NextResponse.json(
      { error: 'Mapping not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ uuid: data.supabase_user_id })
}
