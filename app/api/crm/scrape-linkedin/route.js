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

    // Get user's connected LinkedIn account
    const { data: linkedInAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin')
      .single()

    if (accountError || !linkedInAccount) {
      return NextResponse.json(
        { error: 'LinkedIn account not connected. Please connect your LinkedIn account in Settings.' },
        { status: 400 }
      )
    }

    // Get LinkedIn profile URL - try multiple sources
    let linkedinUrl = null

    // 1. First, check if user manually entered their LinkedIn URL in their profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('linkedin_url')
      .eq('id', user.id)
      .single()

    if (profile?.linkedin_url) {
      linkedinUrl = profile.linkedin_url
      console.log('Using LinkedIn URL from profile:', linkedinUrl)
    }

    // 2. If not in profile, try to get from OAuth profile_data (vanityName)
    if (!linkedinUrl && linkedInAccount.profile_data?.vanityName) {
      linkedinUrl = `https://www.linkedin.com/in/${linkedInAccount.profile_data.vanityName}`
      console.log('Using LinkedIn URL from OAuth vanityName:', linkedinUrl)
    }

    // 3. If still not found, try to fetch it from LinkedIn API
    if (!linkedinUrl) {
      try {
        const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
          headers: {
            'Authorization': `Bearer ${linkedInAccount.access_token}`,
          },
        })

        if (profileResponse.ok) {
          const profileData = await profileResponse.json()
          if (profileData.vanityName) {
            linkedinUrl = `https://www.linkedin.com/in/${profileData.vanityName}`
            console.log('Using LinkedIn URL from API:', linkedinUrl)
          }
        }
      } catch (error) {
        console.error('Error fetching LinkedIn profile:', error)
      }
    }

    if (!linkedinUrl) {
      return NextResponse.json(
        { error: 'Unable to determine LinkedIn profile URL. Please add your LinkedIn profile URL in Settings → Profile, or reconnect your LinkedIn account.' },
        { status: 400 }
      )
    }

    // Get Apify API token from environment
    const apifyToken = process.env.APIFY_API_TOKEN
    if (!apifyToken) {
      return NextResponse.json(
        { error: 'Apify API token not configured' },
        { status: 500 }
      )
    }

    console.log('Step 1: Scraping LinkedIn profile posts...')

    // Step 1: Get last 5 post URLs using LinkedIn Profile Posts Scraper
    const postsActorId = 'curious_coder/linkedin-post-search-scraper'
    const postsRunResponse = await fetch(
      `https://api.apify.com/v2/acts/${postsActorId}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileUrl: linkedinUrl,
          maxPosts: 5,
        }),
      }
    )

    if (!postsRunResponse.ok) {
      throw new Error('Failed to start LinkedIn posts scraper')
    }

    const postsRun = await postsRunResponse.json()
    const postsRunId = postsRun.data.id

    // Wait for the posts scraper to complete
    let postsCompleted = false
    let postsDatasetId = null
    let attempts = 0
    const maxAttempts = 60 // 5 minutes max wait time

    while (!postsCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${postsRunId}?token=${apifyToken}`
      )
      const statusData = await statusResponse.json()

      if (statusData.data.status === 'SUCCEEDED') {
        postsCompleted = true
        postsDatasetId = statusData.data.defaultDatasetId
      } else if (statusData.data.status === 'FAILED') {
        throw new Error('LinkedIn posts scraper failed')
      }

      attempts++
    }

    if (!postsDatasetId) {
      throw new Error('Timeout waiting for LinkedIn posts scraper')
    }

    // Get the posts data
    const postsDataResponse = await fetch(
      `https://api.apify.com/v2/datasets/${postsDatasetId}/items?token=${apifyToken}`
    )
    const postsData = await postsDataResponse.json()

    console.log(`Found ${postsData.length} posts`)

    // Step 2: For each post URL, get engagement data
    const allContacts = []

    for (const post of postsData) {
      if (!post.url) continue

      console.log(`Step 2: Scraping engagements for post: ${post.url}`)

      const engagementsActorId = 'scraping_solutions/linkedin-posts-engagers-likers-and-commenters-no-cookies'
      const engagementsRunResponse = await fetch(
        `https://api.apify.com/v2/acts/${engagementsActorId}/runs?token=${apifyToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            postUrl: post.url,
          }),
        }
      )

      if (!engagementsRunResponse.ok) {
        console.error(`Failed to start engagements scraper for post ${post.url}`)
        continue
      }

      const engagementsRun = await engagementsRunResponse.json()
      const engagementsRunId = engagementsRun.data.id

      // Wait for engagements scraper to complete
      let engagementsCompleted = false
      let engagementsDatasetId = null
      let engagementAttempts = 0

      while (!engagementsCompleted && engagementAttempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000))

        const statusResponse = await fetch(
          `https://api.apify.com/v2/actor-runs/${engagementsRunId}?token=${apifyToken}`
        )
        const statusData = await statusResponse.json()

        if (statusData.data.status === 'SUCCEEDED') {
          engagementsCompleted = true
          engagementsDatasetId = statusData.data.defaultDatasetId
        } else if (statusData.data.status === 'FAILED') {
          console.error(`Engagements scraper failed for post ${post.url}`)
          break
        }

        engagementAttempts++
      }

      if (!engagementsDatasetId) {
        console.error(`Timeout waiting for engagements scraper for post ${post.url}`)
        continue
      }

      // Get the engagement data
      const engagementsDataResponse = await fetch(
        `https://api.apify.com/v2/datasets/${engagementsDatasetId}/items?token=${apifyToken}`
      )
      const engagementsData = await engagementsDataResponse.json()

      console.log(`Found ${engagementsData.length} engagements for post`)

      // Add contacts with post context
      for (const engagement of engagementsData) {
        allContacts.push({
          user_id: user.id,
          profile_url: engagement.profileUrl,
          name: engagement.name,
          job_title: engagement.jobTitle,
          company: engagement.company,
          engagement_type: engagement.type, // 'like' or 'comment'
          post_url: post.url,
          scraped_at: new Date().toISOString(),
        })
      }
    }

    console.log(`Total contacts collected: ${allContacts.length}`)

    // Insert contacts into database (with upsert to avoid duplicates)
    let contactsAdded = 0

    if (allContacts.length > 0) {
      // Upsert contacts - update if profile_url + user_id exists, insert if not
      const { error: insertError } = await supabase
        .from('crm_contacts')
        .upsert(allContacts, {
          onConflict: 'user_id,profile_url',
          ignoreDuplicates: false,
        })

      if (insertError) {
        console.error('Error inserting contacts:', insertError)
        throw insertError
      }

      contactsAdded = allContacts.length
    }

    return NextResponse.json({
      success: true,
      contactsAdded,
      postsScraped: postsData.length,
    })

  } catch (error) {
    console.error('Error in LinkedIn scraping:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to scrape LinkedIn data' },
      { status: 500 }
    )
  }
}
