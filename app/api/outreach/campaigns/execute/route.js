import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUnipileClient } from '@/lib/unipile-client'

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
      result.errors++

      // Log the error
      await supabase
        .from('campaign_contacts')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', campaignContact.id)
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
  try {
    console.log(`Fetching LinkedIn profile for: ${publicIdentifier}`)
    const profileData = await unipile.getLinkedInProfile(unipileAccountId, publicIdentifier)
    providerId = profileData.provider_id
    console.log(`Successfully retrieved provider_id: ${providerId}`)

    if (!providerId) {
      throw new Error('Profile response did not include provider_id')
    }
  } catch (profileError) {
    console.error(`Failed to fetch LinkedIn profile:`, profileError)
    throw new Error(`Could not retrieve LinkedIn provider_id: ${profileError.message}`)
  }

  // Personalize message if needed (simple variable replacement)
  let message = campaign.connection_message
  message = message.replace(/\{name\}/gi, contact.name || '')
  message = message.replace(/\{first_name\}/gi, contact.name?.split(' ')[0] || '')
  message = message.replace(/\{company\}/gi, contact.company || '')
  message = message.replace(/\{job_title\}/gi, contact.job_title || '')

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
  followUpDate.setDate(followUpDate.getDate() - (campaign.follow_up_delay_days || 3))

  const { data: followUpContacts } = await supabase
    .from('campaign_contacts')
    .select('*, crm_contacts(*)')
    .eq('campaign_id', campaign.id)
    .eq('status', 'connected')
    .lte('connection_accepted_at', followUpDate.toISOString())
    .is('follow_up_sent_at', null)

  if (!followUpContacts || followUpContacts.length === 0) {
    return result
  }

  const unipileAccountId = campaign.linkedin_outreach_accounts.unipile_account_id

  for (const campaignContact of followUpContacts) {
    try {
      const contact = campaignContact.crm_contacts

      // Personalize follow-up message
      let message = campaign.follow_up_message
      message = message.replace(/\{name\}/gi, contact.name || '')
      message = message.replace(/\{first_name\}/gi, contact.name?.split(' ')[0] || '')
      message = message.replace(/\{company\}/gi, contact.company || '')
      message = message.replace(/\{job_title\}/gi, contact.job_title || '')

      // Get or create chat with the contact
      let chatId = campaignContact.unipile_chat_id
      if (!chatId) {
        const chatResponse = await unipile.startChat(unipileAccountId, contact.profile_url)
        chatId = chatResponse.id
      }

      // Send follow-up message
      const messageResponse = await unipile.sendMessage(unipileAccountId, chatId, message)

      // Update campaign contact
      await supabase
        .from('campaign_contacts')
        .update({
          status: 'follow_up_sent',
          follow_up_sent_at: new Date().toISOString(),
          follow_up_message_id: messageResponse.id || null,
          unipile_chat_id: chatId,
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
