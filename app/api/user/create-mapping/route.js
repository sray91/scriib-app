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

    // Create user in Supabase auth.users table
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

    console.log(`✅ Created Supabase auth user: ${authUser.user.id}`)

    // Create mapping in clerk_user_mapping table
    const { error: mappingError } = await supabase
      .from('clerk_user_mapping')
      .insert({
        clerk_user_id: clerkUserId,
        supabase_user_id: authUser.user.id,
      })

    if (mappingError) {
      console.error('Failed to create user mapping:', mappingError)
      // Try to clean up the auth user if mapping fails
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json(
        { error: `Failed to create mapping: ${mappingError.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ Created user mapping: ${clerkUserId} → ${authUser.user.id}`)

    // Initialize user profile in the profiles table if it exists
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.user.id,
        full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: primaryEmail.emailAddress,
      })
      .select()

    if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
      console.warn('⚠️  Failed to create profile:', profileError.message)
    }

    return NextResponse.json({
      success: true,
      message: 'User mapping created successfully',
      uuid: authUser.user.id,
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
