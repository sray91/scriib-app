import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Clerk Webhook Handler
 *
 * This endpoint handles webhook events from Clerk, specifically:
 * - user.created: When a new user signs up
 * - user.deleted: When a user is deleted (optional cleanup)
 *
 * It creates the necessary Supabase records and mappings to maintain
 * compatibility with the existing UUID-based database schema.
 *
 * Setup Instructions:
 * 1. Go to Clerk Dashboard → Webhooks
 * 2. Add endpoint: https://your-domain.com/api/webhooks/clerk
 * 3. Subscribe to: user.created, user.deleted
 * 4. Copy the signing secret and add as CLERK_WEBHOOK_SECRET in .env.local
 */

export async function POST(req) {
  // Get the webhook secret from environment
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('❌ CLERK_WEBHOOK_SECRET is not set')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    )
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    })
  } catch (err) {
    console.error('❌ Webhook verification failed:', err.message)
    return NextResponse.json(
      { error: 'Webhook verification failed' },
      { status: 400 }
    )
  }

  // Handle the webhook event
  const eventType = evt.type
  console.log(`📥 Webhook received: ${eventType}`)

  try {
    if (eventType === 'user.created') {
      await handleUserCreated(evt.data)
    } else if (eventType === 'user.deleted') {
      await handleUserDeleted(evt.data)
    } else {
      console.log(`⚠️  Unhandled event type: ${eventType}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`❌ Error handling ${eventType}:`, error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Handle user.created event
 * Creates a Supabase auth user and mapping entry
 */
async function handleUserCreated(clerkUser) {
  console.log(`👤 Creating Supabase user for Clerk user: ${clerkUser.id}`)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_SUPABASE_SERVICE_KEY // Use service key for admin operations
  )

  // Get primary email address
  const primaryEmail = clerkUser.email_addresses?.find(
    email => email.id === clerkUser.primary_email_address_id
  )

  if (!primaryEmail) {
    throw new Error('No primary email found for user')
  }

  // Create user in Supabase auth.users table
  // Note: This creates a minimal auth user entry for compatibility
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: primaryEmail.email_address,
    email_confirm: true, // Auto-confirm since Clerk handles verification
    user_metadata: {
      full_name: `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim(),
      clerk_user_id: clerkUser.id,
      created_via_clerk: true,
    }
  })

  if (authError) {
    console.error('Failed to create Supabase auth user:', authError)
    throw authError
  }

  console.log(`✅ Created Supabase auth user: ${authUser.user.id}`)

  // Create mapping in clerk_user_mapping table
  const { error: mappingError } = await supabase
    .from('clerk_user_mapping')
    .insert({
      clerk_user_id: clerkUser.id,
      supabase_user_id: authUser.user.id,
    })

  if (mappingError) {
    console.error('Failed to create user mapping:', mappingError)
    // Try to clean up the auth user if mapping fails
    await supabase.auth.admin.deleteUser(authUser.user.id)
    throw mappingError
  }

  console.log(`✅ Created user mapping: ${clerkUser.id} → ${authUser.user.id}`)

  // Initialize user profile in the profiles table if it exists
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authUser.user.id,
      full_name: `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim(),
      email: primaryEmail.email_address,
    })
    .select()

  if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
    console.warn('⚠️  Failed to create profile (table may not exist):', profileError.message)
  } else if (!profileError) {
    console.log(`✅ Created user profile`)
  }
}

/**
 * Handle user.deleted event
 * Removes the user mapping (cascade delete will handle auth.users)
 */
async function handleUserDeleted(clerkUser) {
  console.log(`🗑️  Deleting Supabase user for Clerk user: ${clerkUser.id}`)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_SUPABASE_SERVICE_KEY
  )

  // Get the mapping first to find the Supabase UUID
  const { data: mapping, error: fetchError } = await supabase
    .from('clerk_user_mapping')
    .select('supabase_user_id')
    .eq('clerk_user_id', clerkUser.id)
    .single()

  if (fetchError || !mapping) {
    console.warn('⚠️  No mapping found for deleted user:', clerkUser.id)
    return
  }

  // Delete the Supabase auth user (this will cascade to other tables)
  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(
    mapping.supabase_user_id
  )

  if (deleteAuthError) {
    console.error('Failed to delete Supabase auth user:', deleteAuthError)
    throw deleteAuthError
  }

  // Delete the mapping (may already be cascade deleted)
  await supabase
    .from('clerk_user_mapping')
    .delete()
    .eq('clerk_user_id', clerkUser.id)

  console.log(`✅ Deleted user and mapping`)
}
