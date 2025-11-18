import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// GET - List all campaigns for the user
export async function GET(request) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // Optional filter by status

    let query = supabase
      .from('campaigns')
      .select(`
        *,
        linkedin_outreach_accounts (
          id,
          account_name,
          profile_name,
          email
        ),
        pipelines (
          id,
          name
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Apply status filter if provided
    if (status) {
      query = query.eq('status', status)
    }

    const { data: campaigns, error: dbError } = await query

    if (dbError) {
      console.error('Error fetching campaigns:', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch campaigns' },
        { status: 500 }
      )
    }

    return NextResponse.json({ campaigns: campaigns || [] })

  } catch (error) {
    console.error('Error in GET /api/outreach/campaigns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new campaign
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

    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.linkedin_outreach_account_id) {
      return NextResponse.json(
        { error: 'Campaign name and LinkedIn account are required' },
        { status: 400 }
      )
    }

    // Verify the LinkedIn account belongs to the user
    const { data: linkedinAccount, error: accountError } = await supabase
      .from('linkedin_outreach_accounts')
      .select('*')
      .eq('id', body.linkedin_outreach_account_id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !linkedinAccount) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn account' },
        { status: 400 }
      )
    }

    // Prepare campaign data
    const campaignData = {
      user_id: user.id,
      linkedin_outreach_account_id: body.linkedin_outreach_account_id,
      pipeline_id: body.pipeline_id || null,
      name: body.name,
      description: body.description || null,
      status: 'draft',
      daily_connection_limit: body.daily_connection_limit || linkedinAccount.daily_connection_limit || 20,
      connection_message: body.connection_message || '',
      follow_up_message: body.follow_up_message || '',
      follow_up_delay_days: body.follow_up_delay_days || 3,
    }

    // Insert the campaign
    const { data: campaign, error: insertError } = await supabase
      .from('campaigns')
      .insert(campaignData)
      .select(`
        *,
        linkedin_outreach_accounts (
          id,
          account_name,
          profile_name,
          email
        ),
        pipelines (
          id,
          name
        )
      `)
      .single()

    if (insertError) {
      console.error('Error creating campaign:', insertError)
      return NextResponse.json(
        { error: 'Failed to create campaign' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase
      .from('campaign_activities')
      .insert({
        campaign_id: campaign.id,
        activity_type: 'campaign_created',
        message: `Campaign "${campaign.name}" created`,
      })

    return NextResponse.json({ success: true, campaign })

  } catch (error) {
    console.error('Error in POST /api/outreach/campaigns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update a campaign
export async function PATCH(request) {
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

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    // Get existing campaign
    const { data: existingCampaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', body.id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingCampaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Prepare update data (only allow certain fields to be updated)
    const updateData = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.daily_connection_limit !== undefined) updateData.daily_connection_limit = body.daily_connection_limit
    if (body.connection_message !== undefined) updateData.connection_message = body.connection_message
    if (body.follow_up_message !== undefined) updateData.follow_up_message = body.follow_up_message
    if (body.follow_up_delay_days !== undefined) updateData.follow_up_delay_days = body.follow_up_delay_days
    if (body.pipeline_id !== undefined) updateData.pipeline_id = body.pipeline_id

    // Update the campaign
    const { data: campaign, error: updateError } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', body.id)
      .eq('user_id', user.id)
      .select(`
        *,
        linkedin_outreach_accounts (
          id,
          account_name,
          profile_name,
          email
        ),
        pipelines (
          id,
          name
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating campaign:', updateError)
      return NextResponse.json(
        { error: 'Failed to update campaign' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, campaign })

  } catch (error) {
    console.error('Error in PATCH /api/outreach/campaigns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a campaign
export async function DELETE(request) {
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

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('id')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      )
    }

    // Get campaign to check if it's active
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of active campaigns
    if (campaign.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot delete an active campaign. Please pause it first.' },
        { status: 400 }
      )
    }

    // Delete the campaign (cascade will delete related records)
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting campaign:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete campaign' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in DELETE /api/outreach/campaigns:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
