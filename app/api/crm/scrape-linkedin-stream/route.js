import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const supabase = createRouteHandlerClient({ cookies })

        // Verify user authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          sendEvent({ type: 'error', message: 'Unauthorized' })
          controller.close()
          return
        }

        // Get user's connected LinkedIn account
        const { data: linkedInAccount, error: accountError } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('platform', 'linkedin')
          .single()

        if (accountError || !linkedInAccount) {
          sendEvent({ type: 'error', message: 'LinkedIn account not connected. Please connect your LinkedIn account in Settings.' })
          controller.close()
          return
        }

        // Get LinkedIn profile URL
        let linkedinUrl = null

        const { data: profile } = await supabase
          .from('profiles')
          .select('linkedin_url')
          .eq('id', user.id)
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
          controller.close()
          return
        }

        const apifyToken = process.env.APIFY_API_TOKEN
        if (!apifyToken) {
          sendEvent({ type: 'error', message: 'Apify API token not configured' })
          controller.close()
          return
        }

        const usernameMatch = linkedinUrl.match(/linkedin\.com\/in\/([^\/?\s]+)/)
        if (!usernameMatch) {
          sendEvent({ type: 'error', message: 'Could not extract username from LinkedIn URL: ' + linkedinUrl })
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
          const errorData = await postsRunResponse.json()
          sendEvent({ type: 'error', message: 'Failed to start LinkedIn posts scraper' })
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
            controller.close()
            return
          }

          attempts++
        }

        if (!postsDatasetId) {
          sendEvent({ type: 'error', message: 'Timeout waiting for LinkedIn posts scraper' })
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

          sendEvent({
            type: 'post_complete',
            postIndex,
            totalContacts: allContacts.length
          })
        }

        // Insert contacts - deduplicate first to avoid conflicts within batch
        if (allContacts.length > 0) {
          // Deduplicate by profile_url, keeping the most recent engagement (last in array)
          const contactsMap = new Map()
          allContacts.forEach(contact => {
            const key = contact.profile_url
            // Keep the latest occurrence
            contactsMap.set(key, contact)
          })

          const uniqueContacts = Array.from(contactsMap.values())

          sendEvent({
            type: 'status',
            message: `Saving ${uniqueContacts.length} unique contacts...`
          })

          const { error: insertError } = await supabase
            .from('crm_contacts')
            .upsert(uniqueContacts, {
              onConflict: 'user_id,profile_url',
              ignoreDuplicates: false,
            })

          if (insertError) {
            console.error('Insert error details:', insertError)
            sendEvent({ type: 'error', message: 'Error inserting contacts: ' + insertError.message })
            controller.close()
            return
          }
        }

        sendEvent({
          type: 'enrichment_start',
          message: 'Enriching profile details...'
        })

        // Step 3: Enrich profiles
        const profileDetailsActorId = 'VhxlqQXRwhW8H5hNV'
        let profilesEnriched = 0

        const uniqueProfileUrls = [...new Set(allContacts.map(c => c.profile_url))]
          .filter(url => url && !url.includes('/unknown/'))

        const profilesToEnrich = uniqueProfileUrls.slice(0, 10)

        for (let i = 0; i < profilesToEnrich.length; i++) {
          const profileUrl = profilesToEnrich[i]

          sendEvent({
            type: 'enrichment_progress',
            current: i + 1,
            total: profilesToEnrich.length
          })

          try {
            const usernameMatch = profileUrl.match(/\/in\/([^\/?\s]+)/)
            if (!usernameMatch) continue
            const profileUsername = usernameMatch[1]

            const profileDetailsInput = {
              username: profileUsername,
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

            if (!profileDetailsRunResponse.ok) continue

            const profileDetailsRun = await profileDetailsRunResponse.json()
            const profileDetailsRunId = profileDetailsRun.data.id

            let profileDetailsCompleted = false
            let profileDetailsDatasetId = null
            let profileAttempts = 0
            const maxProfileAttempts = 30

            while (!profileDetailsCompleted && profileAttempts < maxProfileAttempts) {
              await new Promise(resolve => setTimeout(resolve, 5000))

              const statusResponse = await fetch(
                `https://api.apify.com/v2/actor-runs/${profileDetailsRunId}?token=${apifyToken}`
              )
              const statusData = await statusResponse.json()

              if (statusData.data.status === 'SUCCEEDED') {
                profileDetailsCompleted = true
                profileDetailsDatasetId = statusData.data.defaultDatasetId
              } else if (statusData.data.status === 'FAILED') {
                break
              }

              profileAttempts++
            }

            if (!profileDetailsDatasetId) continue

            const profileDetailsDataResponse = await fetch(
              `https://api.apify.com/v2/datasets/${profileDetailsDatasetId}/items?token=${apifyToken}`
            )
            const profileDetailsData = await profileDetailsDataResponse.json()

            if (profileDetailsData.length > 0) {
              const profileDetails = profileDetailsData[0]
              const currentPosition = profileDetails.experience?.[0] || {}
              const jobTitle = currentPosition.title || profileDetails.headline || null
              const company = currentPosition.companyName || null

              if (jobTitle || company) {
                const { error: updateError } = await supabase
                  .from('crm_contacts')
                  .update({
                    job_title: jobTitle,
                    company: company,
                    updated_at: new Date().toISOString()
                  })
                  .eq('user_id', user.id)
                  .eq('profile_url', profileUrl)

                if (!updateError) {
                  profilesEnriched++
                }
              }
            }
          } catch (error) {
            console.error('Error enriching profile:', error)
          }
        }

        sendEvent({
          type: 'complete',
          contactsAdded: allContacts.length,
          postsScraped: postsData.length,
          profilesEnriched
        })

        controller.close()

      } catch (error) {
        console.error('Error in LinkedIn scraping:', error)
        sendEvent({ type: 'error', message: error.message || 'Failed to scrape LinkedIn data' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
