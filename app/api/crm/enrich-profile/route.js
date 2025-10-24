import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

    const body = await request.json()
    const { contactId, profileUrl } = body

    if (!contactId || !profileUrl) {
      return NextResponse.json(
        { error: 'Contact ID and profile URL are required' },
        { status: 400 }
      )
    }

    const apifyToken = process.env.APIFY_API_TOKEN
    if (!apifyToken) {
      return NextResponse.json(
        { error: 'Apify API token not configured' },
        { status: 500 }
      )
    }

    // Extract username from LinkedIn URL
    const usernameMatch = profileUrl.match(/\/in\/([^\/?\s]+)/)
    if (!usernameMatch) {
      return NextResponse.json(
        { error: 'Could not extract username from LinkedIn URL' },
        { status: 400 }
      )
    }
    const username = usernameMatch[1]

    // Call Apify profile scraper
    const profileDetailsActorId = 'VhxlqQXRwhW8H5hNV'
    const profileDetailsInput = {
      username: username,
      includeEmail: false
    }

    const profileDetailsRunResponse = await fetch(
      `https://api.apify.com/v2/acts/${profileDetailsActorId}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileDetailsInput),
      }
    )

    if (!profileDetailsRunResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to start profile scraper' },
        { status: 500 }
      )
    }

    const profileDetailsRun = await profileDetailsRunResponse.json()
    const profileDetailsRunId = profileDetailsRun.data.id

    // Wait for profile scraper to complete
    let profileDetailsCompleted = false
    let profileDetailsDatasetId = null
    let attempts = 0
    const maxAttempts = 60 // 60 attempts * 5 seconds = 5 minutes max

    while (!profileDetailsCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000))

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${profileDetailsRunId}?token=${apifyToken}`
      )
      const statusData = await statusResponse.json()

      if (statusData.data.status === 'SUCCEEDED') {
        profileDetailsCompleted = true
        profileDetailsDatasetId = statusData.data.defaultDatasetId
      } else if (statusData.data.status === 'FAILED') {
        return NextResponse.json(
          { error: 'Profile scraper failed' },
          { status: 500 }
        )
      }

      attempts++
    }

    if (!profileDetailsDatasetId) {
      return NextResponse.json(
        { error: 'Timeout waiting for profile scraper' },
        { status: 500 }
      )
    }

    // Fetch profile data
    const profileDetailsDataResponse = await fetch(
      `https://api.apify.com/v2/datasets/${profileDetailsDatasetId}/items?token=${apifyToken}`
    )
    const profileDetailsData = await profileDetailsDataResponse.json()

    if (profileDetailsData.length === 0) {
      return NextResponse.json(
        { error: 'No profile data found' },
        { status: 404 }
      )
    }

    const profileDetails = profileDetailsData[0]
    const currentPosition = profileDetails.experience?.[0] || {}
    const jobTitle = currentPosition.title || profileDetails.headline || null
    const company = currentPosition.companyName || null

    // Update contact in database
    const { data: updatedContact, error: updateError } = await supabase
      .from('crm_contacts')
      .update({
        job_title: jobTitle,
        company: company,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating contact:', updateError)
      return NextResponse.json(
        { error: 'Failed to update contact' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      contact: updatedContact
    })

  } catch (error) {
    console.error('Error in POST /api/crm/enrich-profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
