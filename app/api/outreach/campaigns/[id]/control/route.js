import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// POST - Control campaign (start, pause, stop)
export async function POST(request, { params }) {
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

    const campaignId = params.id
    const body = await request.json()
    const { action } = body // 'start', 'pause', 'stop'

    if (!['start', 'pause', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be start, pause, or stop' },
        { status: 400 }
      )
    }

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*, linkedin_outreach_accounts(*)')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Validate action based on current status
    if (action === 'start') {
      if (!['draft', 'paused'].includes(campaign.status)) {
        return NextResponse.json(
          { error: 'Campaign can only be started from draft or paused status' },
          { status: 400 }
        )
      }

      // Validate campaign has required data
      if (!campaign.connection_message || campaign.connection_message.trim() === '') {
        return NextResponse.json(
          { error: 'Campaign must have a connection message' },
          { status: 400 }
        )
      }

      if (!campaign.linkedin_outreach_account_id) {
        return NextResponse.json(
          { error: 'Campaign must have a LinkedIn account assigned' },
          { status: 400 }
        )
      }

      // Check if campaign has contacts
      const { data: contactsCount } = await supabase
        .from('campaign_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)

      if (!contactsCount || contactsCount.count === 0) {
        return NextResponse.json(
          { error: 'Campaign must have at least one contact' },
          { status: 400 }
        )
      }

      // Verify LinkedIn account is active
      if (!campaign.linkedin_outreach_accounts?.is_active) {
        return NextResponse.json(
          { error: 'LinkedIn account is not active' },
          { status: 400 }
        )
      }

      // Update campaign status to active
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          status: 'active',
          started_at: campaign.started_at || new Date().toISOString(),
        })
        .eq('id', campaignId)

      if (updateError) {
        console.error('Error starting campaign:', updateError)
        return NextResponse.json(
          { error: 'Failed to start campaign' },
          { status: 500 }
        )
      }

      // Log activity
      await supabase
        .from('campaign_activities')
        .insert({
          campaign_id: campaignId,
          activity_type: 'campaign_started',
          message: `Campaign "${campaign.name}" started`,
        })

      return NextResponse.json({
        success: true,
        message: 'Campaign started successfully',
        status: 'active',
      })
    }

    if (action === 'pause') {
      if (campaign.status !== 'active') {
        return NextResponse.json(
          { error: 'Only active campaigns can be paused' },
          { status: 400 }
        )
      }

      // Update campaign status to paused
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', campaignId)

      if (updateError) {
        console.error('Error pausing campaign:', updateError)
        return NextResponse.json(
          { error: 'Failed to pause campaign' },
          { status: 500 }
        )
      }

      // Log activity
      await supabase
        .from('campaign_activities')
        .insert({
          campaign_id: campaignId,
          activity_type: 'campaign_paused',
          message: `Campaign "${campaign.name}" paused`,
        })

      return NextResponse.json({
        success: true,
        message: 'Campaign paused successfully',
        status: 'paused',
      })
    }

    if (action === 'stop') {
      if (!['active', 'paused'].includes(campaign.status)) {
        return NextResponse.json(
          { error: 'Only active or paused campaigns can be stopped' },
          { status: 400 }
        )
      }

      // Update campaign status to stopped
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          status: 'stopped',
          completed_at: new Date().toISOString(),
        })
        .eq('id', campaignId)

      if (updateError) {
        console.error('Error stopping campaign:', updateError)
        return NextResponse.json(
          { error: 'Failed to stop campaign' },
          { status: 500 }
        )
      }

      // Log activity
      await supabase
        .from('campaign_activities')
        .insert({
          campaign_id: campaignId,
          activity_type: 'campaign_stopped',
          message: `Campaign "${campaign.name}" stopped`,
        })

      return NextResponse.json({
        success: true,
        message: 'Campaign stopped successfully',
        status: 'stopped',
      })
    }

  } catch (error) {
    console.error('Error in POST /api/outreach/campaigns/[id]/control:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
