import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Refresh Campaign Totals
 * Manually recalculates and updates campaign statistics from campaign_contacts
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

    // Get counts from campaign_contacts
    const { data: counts, error: countsError } = await supabase
      .from('campaign_contacts')
      .select('status')
      .eq('campaign_id', campaignId)

    if (countsError) {
      console.error('Error fetching campaign contacts:', countsError)
      return NextResponse.json(
        { error: 'Failed to fetch campaign contacts' },
        { status: 500 }
      )
    }

    if (!counts) {
      return NextResponse.json(
        { error: 'No contacts found for this campaign' },
        { status: 404 }
      )
    }

    // Calculate totals
    const totals = {
      total_contacts: counts.length,
      connections_sent: counts.filter(c => ['connection_sent', 'connected', 'follow_up_sent', 'replied'].includes(c.status)).length,
      connections_accepted: counts.filter(c => ['connected', 'follow_up_sent', 'replied'].includes(c.status)).length,
      messages_sent: counts.filter(c => ['follow_up_sent', 'replied'].includes(c.status)).length,
      replies_received: counts.filter(c => c.status === 'replied').length,
    }

    // Update campaign
    const { error: updateError } = await supabase
      .from('campaigns')
      .update(totals)
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating campaign totals:', updateError)
      return NextResponse.json(
        { error: 'Failed to update campaign totals' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      totals,
      message: 'Campaign totals refreshed successfully'
    })

  } catch (error) {
    console.error('Error in POST /api/outreach/campaigns/refresh-totals:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
