import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUnipileClient } from '@/lib/unipile-client'
import { generatePersonalizedMessage, generateFallbackMessage } from '@/lib/ai/personalize-message'

/**
 * Campaign Execution Endpoint
 * This should be called by a cron job or scheduled task (e.g., every hour)
 * It processes all active campaigns and sends connection requests/follow-ups
 * respecting daily limits and timing
 */
export async function POST(request) {
  try {
    // Verify cron secret if provided
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify required environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json(
        { error: 'Server configuration error: Missing Supabase credentials' },
        { status: 500 }
      )
    }

    // Use service role client to bypass RLS since this runs as a cron job without user context
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    const unipile = getUnipileClient()
    const today = new Date().toISOString().split('T')[0]

    // Get all active campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*, linkedin_outreach_accounts(*)')
      .eq('status', 'active')

    if (campaignsError) {
      console.error('Error fetching active campaigns:', campaignsError)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns' },
        { status: 500 }
      )
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active campaigns to process',
        processed: 0,
      })
    }

    const results = []

    console.log(`Processing ${campaigns.length} active campaign(s)`)

    for (const campaign of campaigns) {
      try {
        console.log(`Processing campaign: ${campaign.name} (${campaign.id})`)
        const result = await processCampaign(supabase, unipile, campaign, today)
        console.log(`Campaign result:`, result)
        results.push(result)
      } catch (error) {
        console.error(`Error processing campaign ${campaign.id}:`, error)
        results.push({
          campaign_id: campaign.id,
          success: false,
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })

  } catch (error) {
    console.error('Error in POST /api/outreach/campaigns/execute:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Process a single campaign
 */
async function processCampaign(supabase, unipile, campaign, today) {
  const result = {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    connections_sent: 0,
    follow_ups_sent: 0,
    errors: 0,
  }

  // Get today's stats for this campaign
  const { data: todayStats } = await supabase
    .from('campaign_daily_stats')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('date', today)
    .single()

  const connectionsSentToday = todayStats?.connections_sent || 0
  const dailyLimit = campaign.daily_connection_limit || 20

  console.log(`Campaign ${campaign.name}: ${connectionsSentToday}/${dailyLimit} connections sent today`)

  // Check if we've hit today's limit
  if (connectionsSentToday >= dailyLimit) {
    console.log(`Campaign ${campaign.name}: Daily limit reached, skipping`)
    return {
      ...result,
      skipped: true,
      reason: 'Daily limit reached',
    }
  }

  // Calculate how many more connections we can send today
  const remainingToday = dailyLimit - connectionsSentToday
  console.log(`Campaign ${campaign.name}: Can send ${remainingToday} more connections today`)

  // Get pending contacts (not yet contacted)
  const { data: pendingContacts, error: contactsError } = await supabase
    .from('campaign_contacts')
    .select('*, crm_contacts(*)')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .limit(remainingToday)

  console.log(`Campaign ${campaign.name}: Found ${pendingContacts?.length || 0} pending contacts`)
  if (contactsError) {
    console.error(`Error fetching pending contacts:`, contactsError)
  }

  if (contactsError || !pendingContacts || pendingContacts.length === 0) {
    console.log(`Campaign ${campaign.name}: No pending contacts, checking for follow-ups`)
    // Check for follow-ups
    const followUpResult = await processFollowUps(supabase, unipile, campaign)
    return {
      ...result,
      ...followUpResult,
    }
  }

  // Verify Unipile account is accessible
  try {
    const unipileAccountId = campaign.linkedin_outreach_accounts.unipile_account_id
    console.log(`Verifying Unipile account: ${unipileAccountId}`)
    const unipileAccount = await unipile.getAccount(unipileAccountId)
    console.log(`Unipile account verified:`, unipileAccount)
  } catch (verifyError) {
    console.error(`Failed to verify Unipile account:`, verifyError)
    return {
      ...result,
      error: `Invalid Unipile account: ${verifyError.message}`,
    }
  }

  // Send connection requests
  console.log(`Campaign ${campaign.name}: Sending ${pendingContacts.length} connection request(s)`)
  for (const campaignContact of pendingContacts) {
    try {
      console.log(`Sending connection request to ${campaignContact.crm_contacts?.name || 'Unknown'}`)
      await sendConnectionRequest(supabase, unipile, campaign, campaignContact)
      result.connections_sent++
      console.log(`Successfully sent connection request to ${campaignContact.crm_contacts?.name}`)
    } catch (error) {
      console.error(`Error sending connection request to ${campaignContact.crm_contacts?.name}:`, error)

      // FALLBACK: Check if error indicates user is already connected
      // Note: Most cases should be caught by the precheck in sendConnectionRequest()
      // This is a safety net for edge cases where the precheck didn't catch it
      const alreadyConnectedErrors = [
        'already connected',
        'already in your network',
        'connection already exists',
        'user is already a connection',
        'already sent',
      ]

      const isAlreadyConnected = alreadyConnectedErrors.some(msg =>
        error.message?.toLowerCase().includes(msg)
      )

      if (isAlreadyConnected) {
        console.log(`Contact ${campaignContact.crm_contacts?.name} is already connected (fallback detection) - marking as connected`)

        // Mark as already connected so they get follow-up messages
        await supabase
          .from('campaign_contacts')
          .update({
            status: 'connected',
            connection_accepted_at: new Date().toISOString(),
            error_message: 'Already connected on LinkedIn (fallback)',
          })
          .eq('id', campaignContact.id)

        // Log activity
        await supabase
          .from('campaign_activities')
          .insert({
            campaign_id: campaign.id,
            contact_id: campaignContact.crm_contacts.id,
            campaign_contact_id: campaignContact.id,
            activity_type: 'already_connected',
            message: `Contact was already connected on LinkedIn (detected via fallback error handling)`,
          })

        result.connections_sent++ // Count as success
      } else {
        // Different error - mark as failed
        result.errors++
        await supabase
          .from('campaign_contacts')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', campaignContact.id)
      }
    }
  }

  // Process follow-ups
  const followUpResult = await processFollowUps(supabase, unipile, campaign)
  result.follow_ups_sent = followUpResult.follow_ups_sent || 0
  result.errors += followUpResult.errors || 0

  // Update daily stats
  await updateDailyStats(supabase, campaign.id, today, {
    connections_sent: result.connections_sent,
    follow_ups_sent: result.follow_ups_sent,
    errors: result.errors,
  })

  // Update campaign totals
  await updateCampaignTotals(supabase, campaign.id)

  return result
}

/**
 * Send a connection request via Unipile
 */
async function sendConnectionRequest(supabase, unipile, campaign, campaignContact) {
  const contact = campaignContact.crm_contacts
  const unipileAccountId = campaign.linkedin_outreach_accounts.unipile_account_id

  console.log(`sendConnectionRequest - Contact: ${contact.name}, Profile URL: ${contact.profile_url}, Unipile Account ID: ${unipileAccountId}`)

  if (!unipileAccountId) {
    throw new Error(`LinkedIn outreach account is missing Unipile account ID`)
  }

  if (!contact.profile_url) {
    throw new Error(`Contact ${contact.name} is missing profile_url`)
  }

  // Extract the LinkedIn public identifier from the URL
  // e.g., "ryancahalane" from "https://www.linkedin.com/in/ryancahalane/"
  const linkedinUrlMatch = contact.profile_url.match(/linkedin\.com\/in\/([^/]+)/)
  if (!linkedinUrlMatch || !linkedinUrlMatch[1]) {
    throw new Error(`Invalid LinkedIn profile URL format: ${contact.profile_url}`)
  }

  const publicIdentifier = linkedinUrlMatch[1]
  console.log(`Extracted LinkedIn public identifier from URL: ${publicIdentifier}`)

  // Fetch the LinkedIn profile to get the internal provider_id
  // The provider_id is LinkedIn's internal ID (e.g., "ACoAAAcDMMQBODyLwZrRcgYhrkCafURGqva0U4E")
  // which is different from the public identifier
  let providerId
  let profileData
  try {
    console.log(`Fetching LinkedIn profile for: ${publicIdentifier}`)
    profileData = await unipile.getLinkedInProfile(unipileAccountId, publicIdentifier)
    providerId = profileData.provider_id
    console.log(`Successfully retrieved provider_id: ${providerId}`)
    console.log(`Connection status - network_distance: ${profileData.network_distance}, is_relationship: ${profileData.is_relationship}, pending_invitation: ${profileData.pending_invitation}`)

    if (!providerId) {
      throw new Error('Profile response did not include provider_id')
    }
  } catch (profileError) {
    console.error(`Failed to fetch LinkedIn profile:`, profileError)
    throw new Error(`Could not retrieve LinkedIn provider_id: ${profileError.message}`)
  }

  // PRECHECK: Check if already connected or invitation already sent
  // If already connected, mark as connected and skip sending request
  if (profileData.network_distance === 'FIRST_DEGREE' || profileData.is_relationship === true) {
    console.log(`Contact ${contact.name} is already a 1st degree connection - marking as connected`)

    // Mark as already connected so they get follow-up messages
    await supabase
      .from('campaign_contacts')
      .update({
        status: 'connected',
        connection_accepted_at: new Date().toISOString(),
        error_message: 'Already connected on LinkedIn (precheck)',
      })
      .eq('id', campaignContact.id)

    // Log activity
    await supabase
      .from('campaign_activities')
      .insert({
        campaign_id: campaign.id,
        contact_id: contact.id,
        campaign_contact_id: campaignContact.id,
        activity_type: 'already_connected',
        message: `Contact was already a 1st degree connection on LinkedIn (detected via precheck)`,
      })

    // Return early - don't send connection request
    return
  }

  // PRECHECK: Check if invitation already pending
  if (profileData.pending_invitation === true) {
    console.log(`Contact ${contact.name} already has a pending invitation - marking as connection_sent`)

    // Mark as connection already sent
    await supabase
      .from('campaign_contacts')
      .update({
        status: 'connection_sent',
        connection_sent_at: new Date().toISOString(),
        error_message: 'Connection request already pending (precheck)',
      })
      .eq('id', campaignContact.id)

    // Log activity
    await supabase
      .from('campaign_activities')
      .insert({
        campaign_id: campaign.id,
        contact_id: contact.id,
        campaign_contact_id: campaignContact.id,
        activity_type: 'connection_already_sent',
        message: `Connection request was already pending for ${contact.name} (detected via precheck)`,
      })

    // Return early - don't send duplicate request
    return
  }

  // Personalize message
  let message

  if (campaign.use_ai_personalization) {
    // Use AI to generate personalized message
    try {
      console.log(`Generating AI-personalized message for ${contact.name}`)

      // Prepare contact data for AI
      const contactData = {
        name: contact.name,
        first_name: contact.name?.split(' ')[0],
        company: contact.company,
        job_title: contact.job_title,
        profile_summary: profileData.description || profileData.summary,
        headline: profileData.headline,
        location: profileData.location,
        recent_posts: profileData.recent_posts || [],
      }

      message = await generatePersonalizedMessage({
        instructions: campaign.ai_instructions,
        tone: campaign.ai_tone || 'professional',
        maxLength: campaign.ai_max_length || 200,
        contactData,
        messageType: 'connection',
      })

      console.log(`AI-generated message: "${message}"`)

      // Log that AI was used
      await supabase
        .from('campaign_activities')
        .insert({
          campaign_id: campaign.id,
          contact_id: contact.id,
          campaign_contact_id: campaignContact.id,
          activity_type: 'ai_message_generated',
          message: `AI generated personalized message for ${contact.name}`,
        })

    } catch (aiError) {
      console.error(`AI personalization failed, falling back to template:`, aiError)

      // Fallback to template if AI fails
      message = generateFallbackMessage(campaign.connection_message, {
        name: contact.name,
        first_name: contact.name?.split(' ')[0],
        company: contact.company,
        job_title: contact.job_title,
      })

      // Log the AI failure
      await supabase
        .from('campaign_activities')
        .insert({
          campaign_id: campaign.id,
          contact_id: contact.id,
          campaign_contact_id: campaignContact.id,
          activity_type: 'ai_generation_failed',
          message: `AI personalization failed: ${aiError.message}. Used template fallback.`,
        })
    }
  } else {
    // Use template with simple variable replacement
    message = generateFallbackMessage(campaign.connection_message, {
      name: contact.name,
      first_name: contact.name?.split(' ')[0],
      company: contact.company,
      job_title: contact.job_title,
    })
  }

  console.log(`Sending connection request via Unipile with provider_id: ${providerId}`)

  // Send connection request via Unipile
  const response = await unipile.sendConnectionRequest(
    unipileAccountId,
    providerId,
    message
  )

  console.log(`Unipile response:`, response)

  // Update campaign contact status
  await supabase
    .from('campaign_contacts')
    .update({
      status: 'connection_sent',
      connection_sent_at: new Date().toISOString(),
      connection_request_id: response.id || null,
    })
    .eq('id', campaignContact.id)

  // Log activity
  await supabase
    .from('campaign_activities')
    .insert({
      campaign_id: campaign.id,
      contact_id: contact.id,
      campaign_contact_id: campaignContact.id,
      activity_type: 'connection_sent',
      message: `Connection request sent to ${contact.name}`,
      metadata: { profile_url: contact.profile_url },
    })
}

/**
 * Process follow-up messages for accepted connections
 */
async function processFollowUps(supabase, unipile, campaign) {
  const result = {
    follow_ups_sent: 0,
    errors: 0,
  }

  // Get contacts who accepted connection and are due for follow-up
  const followUpDate = new Date()
  const delay = campaign.follow_up_delay_days !== undefined && campaign.follow_up_delay_days !== null
    ? campaign.follow_up_delay_days
    : 3
  followUpDate.setDate(followUpDate.getDate() - delay)

  console.log(`processFollowUps: Checking for follow-ups`)
  console.log(`  Campaign: ${campaign.name}`)
  console.log(`  Follow-up delay: ${campaign.follow_up_delay_days} days`)
  console.log(`  Follow-up cutoff date: ${followUpDate.toISOString()}`)

  const { data: followUpContacts, error: followUpError } = await supabase
    .from('campaign_contacts')
    .select('*, crm_contacts(*)')
    .eq('campaign_id', campaign.id)
    .eq('status', 'connected')
    .lte('connection_accepted_at', followUpDate.toISOString())
    .is('follow_up_sent_at', null)

  console.log(`  Query returned ${followUpContacts?.length || 0} contacts`)
  if (followUpError) {
    console.error(`  Error fetching follow-up contacts:`, followUpError)
  }

  if (!followUpContacts || followUpContacts.length === 0) {
    console.log(`  No contacts eligible for follow-up`)
    return result
  }

  console.log(`  Found ${followUpContacts.length} contacts eligible for follow-up`)

  const unipileAccountId = campaign.linkedin_outreach_accounts.unipile_account_id

  for (const campaignContact of followUpContacts) {
    try {
      const contact = campaignContact.crm_contacts

      // Get provider ID from profile URL first (needed for AI context too)
      // Extract public identifier from LinkedIn URL (e.g., "ryancahalane" from linkedin.com/in/ryancahalane/)
      const linkedinUrlMatch = contact.profile_url.match(/linkedin\.com\/in\/([^/]+)/)
      let providerId = contact.profile_url // Default to profile_url
      let profileData = null

      if (linkedinUrlMatch && linkedinUrlMatch[1]) {
        const publicIdentifier = linkedinUrlMatch[1]
        // Fetch profile to get provider_id
        profileData = await unipile.getLinkedInProfile(unipileAccountId, publicIdentifier)
        providerId = profileData.provider_id
      }

      // Personalize follow-up message
      let message

      if (campaign.follow_up_use_ai && campaign.follow_up_ai_instructions) {
        // Use AI to generate personalized follow-up message
        try {
          console.log(`Generating AI-personalized follow-up for ${contact.name}`)

          // Prepare contact data for AI
          const contactData = {
            name: contact.name,
            first_name: contact.name?.split(' ')[0],
            company: contact.company,
            job_title: contact.job_title,
            profile_summary: profileData?.description || profileData?.summary,
            headline: profileData?.headline,
            location: profileData?.location,
            recent_posts: profileData?.recent_posts || [],
          }

          // Get the original connection message for context
          const connectionMessage = campaignContact.connection_request_id
            ? await getOriginalConnectionMessage(supabase, campaignContact)
            : null

          message = await generatePersonalizedMessage({
            instructions: campaign.follow_up_ai_instructions,
            tone: campaign.ai_tone || 'professional',
            maxLength: 1000, // Follow-up messages can be longer
            contactData,
            messageType: 'follow_up',
            previousMessage: connectionMessage,
          })

          console.log(`AI-generated follow-up: "${message}"`)

          // Log that AI was used
          await supabase
            .from('campaign_activities')
            .insert({
              campaign_id: campaign.id,
              contact_id: contact.id,
              campaign_contact_id: campaignContact.id,
              activity_type: 'ai_followup_generated',
              message: `AI generated personalized follow-up for ${contact.name}`,
            })

        } catch (aiError) {
          console.error(`AI follow-up generation failed, falling back to template:`, aiError)

          // Fallback to template
          message = generateFallbackMessage(campaign.follow_up_message, {
            name: contact.name,
            first_name: contact.name?.split(' ')[0],
            company: contact.company,
            job_title: contact.job_title,
          })

          // Log the AI failure
          await supabase
            .from('campaign_activities')
            .insert({
              campaign_id: campaign.id,
              contact_id: contact.id,
              campaign_contact_id: campaignContact.id,
              activity_type: 'ai_generation_failed',
              message: `AI follow-up generation failed: ${aiError.message}. Used template fallback.`,
            })
        }
      } else {
        // Use template with simple variable replacement
        message = generateFallbackMessage(campaign.follow_up_message, {
          name: contact.name,
          first_name: contact.name?.split(' ')[0],
          company: contact.company,
          job_title: contact.job_title,
        })
      }

      // Send direct message (creates chat if needed)
      const messageResponse = await unipile.sendDirectMessage(
        unipileAccountId,
        providerId,
        message
      )

      // Update campaign contact
      await supabase
        .from('campaign_contacts')
        .update({
          status: 'follow_up_sent',
          follow_up_sent_at: new Date().toISOString(),
          follow_up_message_id: messageResponse.id || null,
          unipile_chat_id: messageResponse.chat_id || messageResponse.id,
        })
        .eq('id', campaignContact.id)

      // Log activity
      await supabase
        .from('campaign_activities')
        .insert({
          campaign_id: campaign.id,
          contact_id: contact.id,
          campaign_contact_id: campaignContact.id,
          activity_type: 'follow_up_sent',
          message: `Follow-up message sent to ${contact.name}`,
        })

      result.follow_ups_sent++
    } catch (error) {
      console.error('Error sending follow-up:', error)
      result.errors++
    }
  }

  return result
}

/**
 * Update daily stats
 */
async function updateDailyStats(supabase, campaignId, date, stats) {
  await supabase
    .from('campaign_daily_stats')
    .upsert({
      campaign_id: campaignId,
      date: date,
      connections_sent: stats.connections_sent,
      follow_ups_sent: stats.follow_ups_sent,
      errors: stats.errors,
    }, {
      onConflict: 'campaign_id,date',
    })
}

/**
 * Update campaign total counts
 */
async function updateCampaignTotals(supabase, campaignId) {
  // Get counts from campaign_contacts
  const { data: counts } = await supabase
    .from('campaign_contacts')
    .select('status')
    .eq('campaign_id', campaignId)

  if (counts) {
    const totals = {
      total_contacts: counts.length,
      connections_sent: counts.filter(c => ['connection_sent', 'connected', 'follow_up_sent', 'replied'].includes(c.status)).length,
      connections_accepted: counts.filter(c => ['connected', 'follow_up_sent', 'replied'].includes(c.status)).length,
      messages_sent: counts.filter(c => ['follow_up_sent', 'replied'].includes(c.status)).length,
      replies_received: counts.filter(c => c.status === 'replied').length,
    }

    await supabase
      .from('campaigns')
      .update(totals)
      .eq('id', campaignId)
  }
}

/**
 * Get the original connection message sent to a contact (for follow-up context)
 */
async function getOriginalConnectionMessage(supabase, campaignContact) {
  try {
    // Try to get the original message from campaign activities
    const { data: activities } = await supabase
      .from('campaign_activities')
      .select('message, metadata')
      .eq('campaign_contact_id', campaignContact.id)
      .in('activity_type', ['connection_sent', 'ai_message_generated'])
      .order('created_at', { ascending: true })
      .limit(1)

    if (activities && activities.length > 0 && activities[0].metadata?.message) {
      return activities[0].metadata.message
    }

    // Fallback: Return null if we can't find the original message
    return null
  } catch (error) {
    console.error('Error fetching original connection message:', error)
    return null
  }
}
