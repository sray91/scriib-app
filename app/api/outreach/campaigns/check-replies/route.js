import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getUnipileClient } from '@/lib/unipile-client'

/**
 * Check for Replies
 * Checks LinkedIn messages for replies from contacts who have been sent follow-up messages
 * and updates their status to 'replied' if they've responded
 */
export async function POST(request) {
  try {
    const { campaignId } = await request.json()

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS
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

    // Get the campaign with LinkedIn account info
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, linkedin_outreach_accounts(*)')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get all contacts who have been sent follow-up messages but haven't replied yet
    const { data: contacts, error: contactsError } = await supabase
      .from('campaign_contacts')
      .select('*, crm_contacts(*)')
      .eq('campaign_id', campaignId)
      .eq('status', 'follow_up_sent')
      .not('unipile_chat_id', 'is', null)

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No contacts to check for replies',
        repliesFound: 0,
      })
    }

    const unipileAccountId = campaign.linkedin_outreach_accounts.unipile_account_id
    let repliesFound = 0
    const results = []

    console.log(`Checking ${contacts.length} contacts for replies`)

    for (const contact of contacts) {
      try {
        // Get messages from the chat
        const messages = await unipile.getMessages(
          unipileAccountId,
          contact.unipile_chat_id,
          { limit: 50 } // Get last 50 messages
        )

        // Check if there are any messages from the contact (not from us) after the follow-up was sent
        const followUpSentDate = new Date(contact.follow_up_sent_at)

        // Messages from Unipile come in the format { items: [...] }
        const messageItems = messages.items || messages || []

        console.log(`Contact ${contact.crm_contacts?.name}: Found ${messageItems.length} total messages`)
        console.log(`Our account ID: ${unipileAccountId}`)
        console.log(`Follow-up sent at: ${contact.follow_up_sent_at}`)

        // Look for messages from the contact (where sender_id !== our account)
        // A message is from the contact if the sender is NOT our account
        const contactReplies = messageItems.filter(msg => {
          // Parse message date - Unipile uses 'timestamp' field
          const messageDateStr = msg.timestamp || msg.date || msg.created_at
          if (!messageDateStr) {
            console.log(`Message has no timestamp, skipping`)
            return false
          }

          const messageDate = new Date(messageDateStr)

          // Check if date is valid
          if (isNaN(messageDate.getTime())) {
            console.log(`Invalid date for message: ${messageDateStr}`)
            return false
          }

          // Check if message is from the contact (not from us)
          // Unipile provides an 'is_sender' field: 1 = from us, 0 = from contact
          // We also check sender IDs as a fallback
          const senderId = msg.sender_id || msg.sender?.id || msg.from?.id
          const senderProviderId = msg.sender_provider_id || msg.sender?.provider_id || msg.from?.provider_id

          // Primary method: use Unipile's is_sender field
          // is_sender: 1 means message is from our account, 0 means from contact
          let isFromContact = false
          if (typeof msg.is_sender !== 'undefined') {
            isFromContact = msg.is_sender === 0
          } else {
            // Fallback: compare sender IDs
            const isFromUs = (senderId === unipileAccountId) || (senderProviderId === unipileAccountId)
            const hasSenderInfo = senderId || senderProviderId
            isFromContact = hasSenderInfo && !isFromUs
          }

          const isAfterFollowUp = messageDate > followUpSentDate

          if (msg.text) {
            console.log(`Message: "${msg.text?.substring(0, 50)}..." | is_sender: ${msg.is_sender} | Date: ${messageDate.toISOString()} | IsFromContact: ${isFromContact} | IsAfterFollowUp: ${isAfterFollowUp}`)
          }

          return isFromContact && isAfterFollowUp
        })

        if (contactReplies.length > 0) {
          console.log(`Found ${contactReplies.length} reply/replies from ${contact.crm_contacts?.name}`)

          // Update contact status to 'replied'
          await supabase
            .from('campaign_contacts')
            .update({
              status: 'replied',
              reply_received_at: contactReplies[0].timestamp || contactReplies[0].date || contactReplies[0].created_at,
            })
            .eq('id', contact.id)

          // Log activity
          await supabase
            .from('campaign_activities')
            .insert({
              campaign_id: campaignId,
              contact_id: contact.crm_contacts.id,
              campaign_contact_id: contact.id,
              activity_type: 'reply_received',
              message: `${contact.crm_contacts?.name} replied to follow-up message`,
            })

          repliesFound++
          results.push({
            contact_id: contact.id,
            contact_name: contact.crm_contacts?.name,
            status: 'replied',
            replies_count: contactReplies.length,
          })
        } else {
          results.push({
            contact_id: contact.id,
            contact_name: contact.crm_contacts?.name,
            status: 'no_reply',
          })
        }
      } catch (error) {
        console.error(`Error checking messages for contact ${contact.crm_contacts?.name}:`, error)
        results.push({
          contact_id: contact.id,
          contact_name: contact.crm_contacts?.name,
          status: 'error',
          error: error.message,
        })
      }
    }

    // Update campaign totals
    if (repliesFound > 0) {
      await updateCampaignTotals(supabase, campaignId)
    }

    return NextResponse.json({
      success: true,
      repliesFound,
      contactsChecked: contacts.length,
      results,
      message: repliesFound > 0
        ? `Found ${repliesFound} new ${repliesFound === 1 ? 'reply' : 'replies'}`
        : 'No new replies found',
    })

  } catch (error) {
    console.error('Error in POST /api/outreach/campaigns/check-replies:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Update campaign total counts
 */
async function updateCampaignTotals(supabase, campaignId) {
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
