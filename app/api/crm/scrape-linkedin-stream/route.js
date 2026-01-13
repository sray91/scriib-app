import { requireAuth } from '@/lib/api-auth';

// Configure longer timeout for this route (in seconds)
// Vercel Hobby: max 10s, Pro: max 300s (5 min)
export const maxDuration = 300
// Use Node.js runtime for better timeout support
export const runtime = 'nodejs'

export async function GET(request) {
  const encoder = new TextEncoder()
  let keepaliveInterval = null

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Send keepalive comment every 15 seconds to prevent timeout
      keepaliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch (err) {
          // Controller may be closed, clear interval
          if (keepaliveInterval) {
            clearInterval(keepaliveInterval)
          }
        }
      }, 15000)

      try {
        const supabase = createRouteHandlerClient({ cookies })

        // Verify user authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          sendEvent({ type: 'error', message: 'Unauthorized' })
          clearInterval(keepaliveInterval)
          controller.close()
          return
        }

        // Get user's connected LinkedIn account
        const { data: linkedInAccount, error: accountError } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('user_id', userId)
          .eq('platform', 'linkedin')
          .single()

        if (accountError || !linkedInAccount) {
          sendEvent({ type: 'error', message: 'LinkedIn account not connected. Please connect your LinkedIn account in Settings.' })
          clearInterval(keepaliveInterval)
          controller.close()
          return
        }

        // Get LinkedIn profile URL
        let linkedinUrl = null

        const { data: profile } = await supabase
          .from('profiles')
          .select('linkedin_url')
          .eq('id', userId)
          .single()

        if (profile?.linkedin_url) {
          linkedinUrl = profile.linkedin_url
        } else if (linkedInAccount.profile_data?.vanityName) {
          linkedinUrl = `https://www.linkedin.com/in/${linkedInAccount.profile_data.vanityName}`
        }

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
              }
            }
          } catch (error) {
            console.error('Error fetching LinkedIn profile:', error)
          }
        }

        if (!linkedinUrl) {
          sendEvent({ type: 'error', message: 'Unable to determine LinkedIn profile URL. Please add your LinkedIn profile URL in Settings.' })
          clearInterval(keepaliveInterval)
          controller.close()
          return
        }

        const apifyToken = process.env.APIFY_API_TOKEN
        if (!apifyToken) {
          sendEvent({ type: 'error', message: 'Apify API token not configured' })
          clearInterval(keepaliveInterval)
          controller.close()
          return
        }

        const usernameMatch = linkedinUrl.match(/linkedin\.com\/in\/([^\/?\s]+)/)
        if (!usernameMatch) {
          sendEvent({ type: 'error', message: 'Could not extract username from LinkedIn URL: ' + linkedinUrl })
          clearInterval(keepaliveInterval)
          controller.close()
          return
        }
        const username = usernameMatch[1]

        sendEvent({ type: 'status', message: 'Fetching your recent posts...', step: 'posts' })

        // Step 1: Get last 5 post URLs
        const postsActorId = 'LQQIXN9Othf8f7R5n'
        const postsInput = {
          username: username,
          page_number: 1,
          limit: 5
        }

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

        if (!postsRunResponse.ok) {
          sendEvent({ type: 'error', message: 'Failed to start LinkedIn posts scraper' })
          clearInterval(keepaliveInterval)
          controller.close()
          return
        }

        const postsRun = await postsRunResponse.json()
        const postsRunId = postsRun.data.id

        // Wait for posts scraper to complete
        let postsCompleted = false
        let postsDatasetId = null
        let attempts = 0
        const maxAttempts = 60

        while (!postsCompleted && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000))

          const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${postsRunId}?token=${apifyToken}`
          )
          const statusData = await statusResponse.json()

          if (statusData.data.status === 'SUCCEEDED') {
            postsCompleted = true
            postsDatasetId = statusData.data.defaultDatasetId
          } else if (statusData.data.status === 'FAILED') {
            sendEvent({ type: 'error', message: 'LinkedIn posts scraper failed' })
            clearInterval(keepaliveInterval)
            controller.close()
            return
          }

          attempts++
        }

        if (!postsDatasetId) {
          sendEvent({ type: 'error', message: 'Timeout waiting for LinkedIn posts scraper' })
          clearInterval(keepaliveInterval)
          controller.close()
          return
        }

        const postsDataResponse = await fetch(
          `https://api.apify.com/v2/datasets/${postsDatasetId}/items?token=${apifyToken}`
        )
        const postsDataRaw = await postsDataResponse.json()

        let postsData = []
        if (Array.isArray(postsDataRaw) && postsDataRaw.length > 0) {
          postsData = postsDataRaw
        } else if (postsDataRaw.length > 0 && postsDataRaw[0].data?.posts) {
          postsData = postsDataRaw[0].data.posts
        }

        if (postsData.length > 5) {
          postsData = postsData.slice(0, 5)
        }

        sendEvent({ type: 'posts_found', count: postsData.length, posts: postsData })

        // Step 2: Process each post
        const allContacts = []
        const engagementsActorId = 'd5ib8ypLiKOuB8y8Q'

        for (let postIndex = 0; postIndex < postsData.length; postIndex++) {
          const post = postsData[postIndex]
          if (!post.url) continue

          sendEvent({
            type: 'post_start',
            postIndex,
            postUrl: post.url,
            total: postsData.length
          })

          // Scrape both likers and commenters
          for (const engagementType of ['likers', 'commenters']) {
            sendEvent({
              type: 'engagement_start',
              postIndex,
              engagementType
            })

            const engagementsInput = {
              url: post.url,
              start: 1,
              iterations: 2,
              type: engagementType
            }

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

            if (!engagementsRunResponse.ok) {
              sendEvent({
                type: 'engagement_error',
                postIndex,
                engagementType
              })
              continue
            }

            const engagementsRun = await engagementsRunResponse.json()
            const engagementsRunId = engagementsRun.data.id

            // Wait for engagements scraper
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
                sendEvent({
                  type: 'engagement_error',
                  postIndex,
                  engagementType
                })
                break
              }

              engagementAttempts++
            }

            if (!engagementsDatasetId) {
              sendEvent({
                type: 'engagement_error',
                postIndex,
                engagementType
              })
              continue
            }

            const engagementsDataResponse = await fetch(
              `https://api.apify.com/v2/datasets/${engagementsDatasetId}/items?token=${apifyToken}`
            )
            const engagementsData = await engagementsDataResponse.json()

            sendEvent({
              type: 'engagement_complete',
              postIndex,
              engagementType,
              count: engagementsData.length
            })

            // Add contacts
            for (const engagement of engagementsData) {
              const profileUrl = engagement.url_profile || engagement.profileUrl || engagement.profile_url || `https://linkedin.com/unknown/${Date.now()}-${Math.random()}`

              allContacts.push({
                user_id: userId,
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

          sendEvent({
            type: 'post_complete',
            postIndex,
            totalContacts: allContacts.length
          })
        }

        // Insert contacts - deduplicate first to avoid conflicts within batch
        if (allContacts.length > 0) {
          // Deduplicate by profile_url, combining engagement types
          const contactsMap = new Map()
          allContacts.forEach(contact => {
            const key = contact.profile_url
            if (contactsMap.has(key)) {
              // Person already exists - combine engagement types
              const existing = contactsMap.get(key)
              const existingTypes = existing.engagement_type.split(',')
              if (!existingTypes.includes(contact.engagement_type)) {
                existing.engagement_type = [...existingTypes, contact.engagement_type].sort().join(',')
              }
            } else {
              // New person - add to map
              contactsMap.set(key, contact)
            }
          })

          const uniqueContacts = Array.from(contactsMap.values())

          sendEvent({
            type: 'status',
            message: `Saving ${uniqueContacts.length} unique contacts...`
          })

          // Fetch existing contacts to merge engagement types
          const profileUrls = uniqueContacts.map(c => c.profile_url)
          const { data: existingContacts } = await supabase
            .from('crm_contacts')
            .select('profile_url, engagement_type')
            .eq('user_id', userId)
            .in('profile_url', profileUrls)

          // Create a map of existing engagement types
          const existingEngagementMap = new Map()
          if (existingContacts) {
            existingContacts.forEach(contact => {
              existingEngagementMap.set(contact.profile_url, contact.engagement_type)
            })
          }

          // Merge engagement types with existing records
          const contactsToUpsert = uniqueContacts.map(contact => {
            if (existingEngagementMap.has(contact.profile_url)) {
              const existingType = existingEngagementMap.get(contact.profile_url)
              const existingTypes = existingType.split(',')
              const newTypes = contact.engagement_type.split(',')

              // Combine and deduplicate types
              const allTypes = [...new Set([...existingTypes, ...newTypes])].sort()
              return {
                ...contact,
                engagement_type: allTypes.join(',')
              }
            }
            return contact
          })

          const { error: insertError } = await supabase
            .from('crm_contacts')
            .upsert(contactsToUpsert, {
              onConflict: 'user_id,profile_url',
              ignoreDuplicates: false,
            })

          if (insertError) {
            console.error('Insert error details:', insertError)
            sendEvent({ type: 'error', message: 'Error inserting contacts: ' + insertError.message })
            clearInterval(keepaliveInterval)
            controller.close()
            return
          }
        }

        sendEvent({
          type: 'complete',
          contactsAdded: allContacts.length,
          postsScraped: postsData.length
        })

        clearInterval(keepaliveInterval)
        controller.close()

      } catch (error) {
        console.error('Error in LinkedIn scraping:', error)
        sendEvent({ type: 'error', message: error.message || 'Failed to scrape LinkedIn data' })
        clearInterval(keepaliveInterval)
        controller.close()
      }
    },
    cancel() {
      // Clean up when client disconnects
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
