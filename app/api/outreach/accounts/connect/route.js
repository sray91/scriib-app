import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getUnipileClient } from '@/lib/unipile-client'

// POST - Generate a hosted auth link for connecting a LinkedIn account
export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the site URL from environment variables
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    try {
      const unipile = getUnipileClient()

      // Create hosted auth link
      const result = await unipile.createHostedAuthLink({
        type: 'create',
        providers: ['LINKEDIN'],
        success_redirect_url: `${siteUrl}/outreach/accounts?status=success`,
        failure_redirect_url: `${siteUrl}/outreach/accounts?status=error`,
        notify_url: `${siteUrl}/api/webhooks/unipile`,
        name: user.id, // Use Supabase user ID for matching
      })

      return NextResponse.json({
        success: true,
        url: result.url,
      })

    } catch (unipileError) {
      console.error('Unipile hosted auth error:', unipileError)
      return NextResponse.json(
        { error: 'Failed to create auth link: ' + unipileError.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error in POST /api/outreach/accounts/connect:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
