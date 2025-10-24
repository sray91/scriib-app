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

    // Extract username from LinkedIn URL
    // Format: https://linkedin.com/in/swanaganray -> swanaganray
    const usernameMatch = linkedinUrl.match(/linkedin\.com\/in\/([^\/?\s]+)/)
    if (!usernameMatch) {
      return NextResponse.json(
        { error: 'Could not extract username from LinkedIn URL: ' + linkedinUrl },
        { status: 400 }
      )
    }
    const username = usernameMatch[1]

    console.log('==========================================')
    console.log('Step 1: Scraping LinkedIn profile posts...')
    console.log('Using actor ID:', 'LQQIXN9Othf8f7R5n')
    console.log('TARGET LinkedIn Profile URL:', linkedinUrl)
    console.log('Extracted username:', username)
    console.log('User ID:', user.id)
    console.log('User Email:', user.email)
    console.log('==========================================')

    // Step 1: Get last 5 post URLs using LinkedIn Profile Posts Scraper
    const postsActorId = 'LQQIXN9Othf8f7R5n'
    const postsInput = {
      username: username,
      page_number: 1,
      limit: 5
    }
    console.log('Actor input:', JSON.stringify(postsInput, null, 2))

    // Call the Apify actor
    const postsRunResponse = await fetch(
      `https://api.apify.com/v2/acts/${postsActorId}/runs?token=${apifyToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postsInput),
      }
    )

    console.log('Apify response status:', postsRunResponse.status)

    if (!postsRunResponse.ok) {
      const errorData = await postsRunResponse.json()
      console.error('Apify error response:', JSON.stringify(errorData, null, 2))
      throw new Error(`Failed to start LinkedIn posts scraper: ${errorData.error?.message || postsRunResponse.statusText}`)
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
    const postsDataRaw = await postsDataResponse.json()

    console.log('==========================================')
    console.log('RAW ACTOR RESPONSE:')
    console.log('Response type:', typeof postsDataRaw)
    console.log('Is array:', Array.isArray(postsDataRaw))
    console.log('Length:', postsDataRaw?.length)
    console.log('First item keys:', postsDataRaw?.[0] ? Object.keys(postsDataRaw[0]) : 'N/A')
    console.log('Full raw data (first 2000 chars):', JSON.stringify(postsDataRaw, null, 2).substring(0, 2000))
    console.log('==========================================')

    // The new actor (LQQIXN9Othf8f7R5n) returns an array of post objects directly
    let postsData = []
    if (Array.isArray(postsDataRaw) && postsDataRaw.length > 0) {
      postsData = postsDataRaw
      console.log('✓ Using postsDataRaw directly as array of posts')
    } else if (postsDataRaw.length > 0 && postsDataRaw[0].data?.posts) {
      // Fallback for old actor format
      postsData = postsDataRaw[0].data.posts
      console.log('✓ Extracted posts from postsDataRaw[0].data.posts')
    }

    console.log(`Found ${postsData.length} posts`)

    // Limit to 5 posts to avoid excessive processing
    if (postsData.length > 5) {
      console.log(`Limiting to first 5 posts (was ${postsData.length})`)
      postsData = postsData.slice(0, 5)
    }

    // Validate that posts belong to the user's profile
    if (postsData.length > 0) {
      const samplePost = postsData[0]
      console.log('==========================================')
      console.log('FIRST POST ANALYSIS:')
      console.log('Post URL:', samplePost.url)
      console.log('Post keys:', Object.keys(samplePost))
      console.log('Full first post:', JSON.stringify(samplePost, null, 2))
      console.log('==========================================')

      // Validate posts belong to the user by checking username in post URLs
      console.log('VALIDATION CHECK:')
      console.log('Expected username:', username)

      let mismatchCount = 0
      for (const post of postsData) { // Check all posts (max 5)
        // LinkedIn post URLs format: https://www.linkedin.com/posts/{username}_...
        const postUsernameMatch = post.url?.match(/\/posts\/([^_\-?\/]+)/)
        const postUsername = postUsernameMatch ? postUsernameMatch[1] : null

        console.log(`\nPost: ${post.url}`)
        console.log(`  Username from URL: ${postUsername}`)

        if (postUsername && postUsername.toLowerCase() === username.toLowerCase()) {
          console.log(`  ✓ Match confirmed`)
        } else {
          console.warn(`  ❌ MISMATCH: Expected '${username}', got '${postUsername || 'unknown'}'`)
          mismatchCount++
        }
      }

      console.log(`\nVALIDATION SUMMARY: ${mismatchCount}/${postsData.length} posts DO NOT match your profile`)
      console.log('==========================================')

      // Stop if more than 50% of posts don't match
      if (mismatchCount > postsData.length / 2) {
        return NextResponse.json(
          {
            error: 'Profile mismatch detected',
            details: `The Apify actor returned posts from other profiles instead of yours. ${mismatchCount}/${postsData.length} posts don't match username '${username}'. The actor may be malfunctioning.`,
            suggestedAction: 'Check if your LinkedIn username is correct and if your profile is public.',
            debug: {
              expectedUsername: username,
              postsReturned: postsData.length,
              mismatches: mismatchCount,
              samplePostUrl: postsData[0]?.url
            }
          },
          { status: 400 }
        )
      }
    }

    // Step 2: For each post URL, get engagement data (both likers and commenters)
    const allContacts = []
    const engagementsActorId = 'd5ib8ypLiKOuB8y8Q'

    for (const post of postsData) {
      if (!post.url) continue

      console.log(`\n==========================================`)
      console.log(`Step 2: Scraping engagements for post: ${post.url}`)

      // Scrape both likers and commenters
      for (const engagementType of ['likers', 'commenters']) {
        console.log(`\nScraping ${engagementType}...`)

        const engagementsInput = {
          url: post.url,
          start: 1,
          iterations: 2, // Get 2 pages of engagements
          type: engagementType
        }
        console.log('Engagements actor input:', JSON.stringify(engagementsInput, null, 2))

        // Call Apify actor
        const engagementsRunResponse = await fetch(
          `https://api.apify.com/v2/acts/${engagementsActorId}/runs?token=${apifyToken}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(engagementsInput),
          }
        )

        console.log(`${engagementType} response status:`, engagementsRunResponse.status)

        if (!engagementsRunResponse.ok) {
          const errorData = await engagementsRunResponse.json()
          console.error(`Failed to start ${engagementType} scraper:`, JSON.stringify(errorData, null, 2))
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
            console.error(`${engagementType} scraper failed for post ${post.url}`)
            break
          }

          engagementAttempts++
        }

        if (!engagementsDatasetId) {
          console.error(`Timeout waiting for ${engagementType} scraper`)
          continue
        }

        // Get the engagement data
        const engagementsDataResponse = await fetch(
          `https://api.apify.com/v2/datasets/${engagementsDatasetId}/items?token=${apifyToken}`
        )
        const engagementsData = await engagementsDataResponse.json()

        console.log(`Found ${engagementsData.length} ${engagementType} for post`)

        // Log first engagement structure for debugging
        if (engagementsData.length > 0) {
          console.log('Sample engagement data:', JSON.stringify(engagementsData[0], null, 2))
        }

        // Add contacts with post context
        for (const engagement of engagementsData) {
          // Use placeholder if profile_url is missing
          const profileUrl = engagement.url_profile || engagement.profileUrl || engagement.profile_url || `https://linkedin.com/unknown/${Date.now()}-${Math.random()}`

          allContacts.push({
            user_id: user.id,
            profile_url: profileUrl,
            name: engagement.name || engagement.fullName || 'Unknown',
            subtitle: engagement.headline || engagement.subtitle || null,
            job_title: engagement.jobTitle || engagement.occupation || null,
            company: engagement.company || null,
            engagement_type: engagementType === 'likers' ? 'like' : 'comment',
            post_url: post.url,
            scraped_at: new Date().toISOString(),
          })
        }
      }

      console.log(`==========================================`)
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
