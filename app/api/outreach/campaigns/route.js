import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth';

// GET - List all campaigns for the user
export async function GET(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

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
      .eq('user_id', userId)
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
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

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
      .eq('user_id', userId)
      .single()

    if (accountError || !linkedinAccount) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn account' },
        { status: 400 }
      )
    }

    // Prepare campaign data
    const campaignData = {
      user_id: userId,
      linkedin_outreach_account_id: body.linkedin_outreach_account_id,
      pipeline_id: body.pipeline_id || null,
      name: body.name,
      description: body.description || null,
      status: 'draft',
      daily_connection_limit: body.daily_connection_limit || linkedinAccount.daily_connection_limit || 20,
      connection_message: body.connection_message || '',
      follow_up_message: body.follow_up_message || '',
      follow_up_delay_days: body.follow_up_delay_days || 3,
      use_ai_personalization: body.use_ai_personalization || false,
      ai_instructions: body.ai_instructions || null,
      ai_tone: body.ai_tone || 'professional',
      ai_max_length: body.ai_max_length || 200,
      follow_up_use_ai: body.follow_up_use_ai || false,
      follow_up_ai_instructions: body.follow_up_ai_instructions || null,
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
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

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
      .eq('user_id', userId)
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
    if (body.use_ai_personalization !== undefined) updateData.use_ai_personalization = body.use_ai_personalization
    if (body.ai_instructions !== undefined) updateData.ai_instructions = body.ai_instructions
    if (body.ai_tone !== undefined) updateData.ai_tone = body.ai_tone
    if (body.ai_max_length !== undefined) updateData.ai_max_length = body.ai_max_length
    if (body.follow_up_use_ai !== undefined) updateData.follow_up_use_ai = body.follow_up_use_ai
    if (body.follow_up_ai_instructions !== undefined) updateData.follow_up_ai_instructions = body.follow_up_ai_instructions

    // Update the campaign
    const { data: campaign, error: updateError } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', body.id)
      .eq('user_id', userId)
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
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

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
      .eq('user_id', userId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Only allow deletion of draft or stopped campaigns
    if (!['draft', 'stopped'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Only draft or stopped campaigns can be deleted. Please stop the campaign first.' },
        { status: 400 }
      )
    }

    // Delete the campaign (cascade will delete related records)
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('user_id', userId)

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
