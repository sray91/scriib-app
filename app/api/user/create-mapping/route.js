import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Emergency endpoint to create user mapping for logged-in users
 *
 * This endpoint manually creates the Supabase auth user and mapping
 * for users who signed up before the webhook was set up.
 *
 * Usage: Just visit /api/user/create-mapping while logged in
 *
 * This is idempotent - safe to call multiple times
 */
export async function POST(request) {
  const { userId: clerkUserId } = await auth()

  if (!clerkUserId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const user = await currentUser()

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_SUPABASE_SERVICE_KEY // Use service key for admin operations
  )

  try {
    // Check if mapping already exists
    const { data: existingMapping } = await supabase
      .from('clerk_user_mapping')
      .select('supabase_user_id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (existingMapping) {
      return NextResponse.json({
        success: true,
        message: 'Mapping already exists',
        uuid: existingMapping.supabase_user_id,
        alreadyExisted: true,
      })
    }

    // Get primary email address
    const primaryEmail = user.emailAddresses?.find(
      email => email.id === user.primaryEmailAddressId
    )

    if (!primaryEmail) {
      return NextResponse.json(
        { error: 'No primary email found' },
        { status: 400 }
      )
    }

    console.log(`📝 Creating Supabase user for Clerk user: ${clerkUserId}`)

    let supabaseUserId = null

    // First, check if a Supabase user with this email already exists
    // This handles users who existed before the Clerk migration
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()

    if (!listError && existingUsers?.users) {
      const existingUser = existingUsers.users.find(
        u => u.email?.toLowerCase() === primaryEmail.emailAddress.toLowerCase()
      )

      if (existingUser) {
        console.log(`✅ Found existing Supabase user for email ${primaryEmail.emailAddress}: ${existingUser.id}`)
        supabaseUserId = existingUser.id

        // Update the existing user's metadata to link with Clerk
        await supabase.auth.admin.updateUserById(existingUser.id, {
          user_metadata: {
            ...existingUser.user_metadata,
            clerk_user_id: clerkUserId,
            linked_to_clerk: true,
          }
        })
      }
    }

    // If no existing user found, create a new one
    if (!supabaseUserId) {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: primaryEmail.emailAddress,
        email_confirm: true,
        user_metadata: {
          full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          clerk_user_id: clerkUserId,
          created_via_clerk: true,
        }
      })

      if (authError) {
        console.error('Failed to create Supabase auth user:', authError)
        return NextResponse.json(
          { error: `Failed to create auth user: ${authError.message}` },
          { status: 500 }
        )
      }

      console.log(`✅ Created new Supabase auth user: ${authUser.user.id}`)
      supabaseUserId = authUser.user.id
    }

    // Create mapping in clerk_user_mapping table
    const { error: mappingError } = await supabase
      .from('clerk_user_mapping')
      .insert({
        clerk_user_id: clerkUserId,
        supabase_user_id: supabaseUserId,
      })

    if (mappingError) {
      console.error('Failed to create user mapping:', mappingError)
      return NextResponse.json(
        { error: `Failed to create mapping: ${mappingError.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ Created user mapping: ${clerkUserId} → ${supabaseUserId}`)

    // Initialize user profile in the profiles table if it doesn't exist
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: supabaseUserId,
        full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: primaryEmail.emailAddress,
      }, { onConflict: 'id' })
      .select()

    if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
      console.warn('⚠️  Failed to create/update profile:', profileError.message)
    }

    return NextResponse.json({
      success: true,
      message: 'User mapping created successfully',
      uuid: supabaseUserId,
      clerkUserId: clerkUserId,
    })
  } catch (error) {
    console.error('Error in create-mapping:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Also support GET for easier testing (just visit the URL)
export async function GET(request) {
  return POST(request)
}
