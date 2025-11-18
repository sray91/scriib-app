import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Unipile Webhook Handler
 * Receives events from Unipile about connection acceptances, messages, etc.
 * Events: connection.accepted, connection.rejected, message.received
 */
export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await request.json()

    console.log('Received Unipile webhook:', JSON.stringify(body, null, 2))

    const { event, data } = body

    switch (event) {
      case 'connection.accepted':
        await handleConnectionAccepted(supabase, data)
        break

      case 'connection.rejected':
        await handleConnectionRejected(supabase, data)
        break

      case 'message.received':
        await handleMessageReceived(supabase, data)
        break

      default:
        console.log('Unknown webhook event:', event)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error processing Unipile webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle connection accepted event
 */
async function handleConnectionAccepted(supabase, data) {
  const { account_id, profile_url, connection_id } = data

  // Find the campaign contact by profile URL and account
  const { data: account } = await supabase
    .from('linkedin_outreach_accounts')
    .select('id')
    .eq('unipile_account_id', account_id)
    .single()

  if (!account) {
    console.log('LinkedIn outreach account not found:', account_id)
    return
  }

  // Find contacts by profile URL
  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id')
    .eq('profile_url', profile_url)

  if (!contacts || contacts.length === 0) {
    console.log('Contact not found:', profile_url)
    return
  }

  // Update all campaign contacts with this profile that have connection_sent status
  for (const contact of contacts) {
    const { data: campaignContacts } = await supabase
      .from('campaign_contacts')
      .select('*, campaigns(*)')
      .eq('contact_id', contact.id)
      .eq('status', 'connection_sent')

    for (const campaignContact of campaignContacts || []) {
      // Verify this campaign is using the correct LinkedIn account
      if (campaignContact.campaigns.linkedin_outreach_account_id !== account.id) {
        continue
      }

      // Update status to connected
      await supabase
        .from('campaign_contacts')
        .update({
          status: 'connected',
          connection_accepted_at: new Date().toISOString(),
        })
        .eq('id', campaignContact.id)

      // Update campaign stats
      await supabase.rpc('increment', {
        table_name: 'campaigns',
        id: campaignContact.campaign_id,
        column_name: 'connections_accepted',
      })

      // Update daily stats
      const today = new Date().toISOString().split('T')[0]
      await supabase
        .from('campaign_daily_stats')
        .upsert({
          campaign_id: campaignContact.campaign_id,
          date: today,
          connections_accepted: 1,
        }, {
          onConflict: 'campaign_id,date',
        })

      // Log activity
      await supabase
        .from('campaign_activities')
        .insert({
          campaign_id: campaignContact.campaign_id,
          contact_id: contact.id,
          campaign_contact_id: campaignContact.id,
          activity_type: 'connection_accepted',
          message: `Connection accepted`,
        })

      // Move to pipeline stage if configured
      if (campaignContact.campaigns.pipeline_id) {
        await moveToPipelineStage(supabase, campaignContact, 'connected')
      }
    }
  }
}

/**
 * Handle connection rejected event
 */
async function handleConnectionRejected(supabase, data) {
  const { account_id, profile_url } = data

  // Find the campaign contact by profile URL and account
  const { data: account } = await supabase
    .from('linkedin_outreach_accounts')
    .select('id')
    .eq('unipile_account_id', account_id)
    .single()

  if (!account) return

  // Find contacts by profile URL
  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id')
    .eq('profile_url', profile_url)

  if (!contacts || contacts.length === 0) return

  for (const contact of contacts) {
    const { data: campaignContacts } = await supabase
      .from('campaign_contacts')
      .select('*, campaigns(*)')
      .eq('contact_id', contact.id)
      .eq('status', 'connection_sent')

    for (const campaignContact of campaignContacts || []) {
      if (campaignContact.campaigns.linkedin_outreach_account_id !== account.id) {
        continue
      }

      // Update status to rejected
      await supabase
        .from('campaign_contacts')
        .update({
          status: 'connection_rejected',
          connection_rejected_at: new Date().toISOString(),
        })
        .eq('id', campaignContact.id)

      // Update campaign stats
      await supabase.rpc('increment', {
        table_name: 'campaigns',
        id: campaignContact.campaign_id,
        column_name: 'connections_rejected',
      })

      // Update daily stats
      const today = new Date().toISOString().split('T')[0]
      await supabase
        .from('campaign_daily_stats')
        .upsert({
          campaign_id: campaignContact.campaign_id,
          date: today,
          connections_rejected: 1,
        }, {
          onConflict: 'campaign_id,date',
        })

      // Log activity
      await supabase
        .from('campaign_activities')
        .insert({
          campaign_id: campaignContact.campaign_id,
          contact_id: contact.id,
          campaign_contact_id: campaignContact.id,
          activity_type: 'connection_rejected',
          message: `Connection rejected`,
        })
    }
  }
}

/**
 * Handle message received event (reply from contact)
 */
async function handleMessageReceived(supabase, data) {
  const { account_id, chat_id, sender_profile_url, message_text } = data

  // Find the campaign contact by chat ID or profile URL
  const { data: account } = await supabase
    .from('linkedin_outreach_accounts')
    .select('id')
    .eq('unipile_account_id', account_id)
    .single()

  if (!account) return

  // Find contacts by profile URL
  const { data: contacts } = await supabase
    .from('crm_contacts')
    .select('id')
    .eq('profile_url', sender_profile_url)

  if (!contacts || contacts.length === 0) return

  for (const contact of contacts) {
    // Find campaign contacts that have sent follow-ups
    const { data: campaignContacts } = await supabase
      .from('campaign_contacts')
      .select('*, campaigns(*)')
      .eq('contact_id', contact.id)
      .in('status', ['connected', 'follow_up_sent'])

    for (const campaignContact of campaignContacts || []) {
      if (campaignContact.campaigns.linkedin_outreach_account_id !== account.id) {
        continue
      }

      // Only count as a reply if we've sent a follow-up
      if (campaignContact.status !== 'follow_up_sent') {
        continue
      }

      // Update status to replied
      await supabase
        .from('campaign_contacts')
        .update({
          status: 'replied',
          reply_received_at: new Date().toISOString(),
          unipile_chat_id: chat_id,
        })
        .eq('id', campaignContact.id)

      // Update campaign stats
      await supabase.rpc('increment', {
        table_name: 'campaigns',
        id: campaignContact.campaign_id,
        column_name: 'replies_received',
      })

      // Update daily stats
      const today = new Date().toISOString().split('T')[0]
      await supabase
        .from('campaign_daily_stats')
        .upsert({
          campaign_id: campaignContact.campaign_id,
          date: today,
          replies_received: 1,
        }, {
          onConflict: 'campaign_id,date',
        })

      // Log activity
      await supabase
        .from('campaign_activities')
        .insert({
          campaign_id: campaignContact.campaign_id,
          contact_id: contact.id,
          campaign_contact_id: campaignContact.id,
          activity_type: 'reply_received',
          message: `Reply received: ${message_text.substring(0, 100)}...`,
          metadata: { message_text },
        })

      // Move to pipeline stage if configured
      if (campaignContact.campaigns.pipeline_id) {
        await moveToPipelineStage(supabase, campaignContact, 'replied')
      }
    }
  }
}

/**
 * Move contact to appropriate pipeline stage based on campaign status
 */
async function moveToPipelineStage(supabase, campaignContact, contactStatus) {
  // Logic to determine which pipeline stage based on contact status
  // This is simplified - you may want more sophisticated pipeline logic

  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('pipeline_id', campaignContact.campaigns.pipeline_id)
    .order('order_index', { ascending: true })

  if (!stages || stages.length === 0) return

  let targetStage = null

  if (contactStatus === 'connected') {
    // Move to second stage (first is usually "new leads")
    targetStage = stages[1] || stages[0]
  } else if (contactStatus === 'replied') {
    // Move to third stage or later (qualified/engaged)
    targetStage = stages[2] || stages[1] || stages[0]
  }

  if (targetStage) {
    await supabase
      .from('campaign_contacts')
      .update({ pipeline_stage_id: targetStage.id })
      .eq('id', campaignContact.id)

    // Also add to pipeline_contacts if not already there
    await supabase
      .from('pipeline_contacts')
      .upsert({
        pipeline_id: campaignContact.campaigns.pipeline_id,
        contact_id: campaignContact.contact_id,
        stage_id: targetStage.id,
      }, {
        onConflict: 'pipeline_id,contact_id',
      })
  }
}
