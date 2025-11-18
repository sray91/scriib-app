import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// GET - Get contacts for a campaign
export async function GET(request, { params }) {
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

    // Verify campaign ownership
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Fetch campaign contacts with contact details
    const { data: campaignContacts, error: dbError } = await supabase
      .from('campaign_contacts')
      .select(`
        *,
        crm_contacts (
          id,
          name,
          subtitle,
          job_title,
          company,
          email,
          profile_url
        ),
        pipeline_stages (
          id,
          name,
          order_index
        )
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('Error fetching campaign contacts:', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch campaign contacts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ contacts: campaignContacts || [] })

  } catch (error) {
    console.error('Error in GET /api/outreach/campaigns/[id]/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add contacts to a campaign
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

    // Validate request
    if (!body.contact_ids || !Array.isArray(body.contact_ids) || body.contact_ids.length === 0) {
      return NextResponse.json(
        { error: 'contact_ids array is required' },
        { status: 400 }
      )
    }

    // Verify campaign ownership and status
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Verify all contacts belong to the user
    const { data: contacts, error: contactsError } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('user_id', user.id)
      .in('id', body.contact_ids)

    if (contactsError || !contacts || contacts.length !== body.contact_ids.length) {
      return NextResponse.json(
        { error: 'Invalid contacts provided' },
        { status: 400 }
      )
    }

    // Prepare campaign contact records
    const campaignContactData = body.contact_ids.map(contactId => ({
      campaign_id: campaignId,
      contact_id: contactId,
      status: 'pending',
    }))

    // Insert campaign contacts (upsert to handle duplicates)
    const { data: insertedContacts, error: insertError } = await supabase
      .from('campaign_contacts')
      .upsert(campaignContactData, {
        onConflict: 'campaign_id,contact_id',
        ignoreDuplicates: false,
      })
      .select()

    if (insertError) {
      console.error('Error adding contacts to campaign:', insertError)
      return NextResponse.json(
        { error: 'Failed to add contacts to campaign' },
        { status: 500 }
      )
    }

    // Update campaign total_contacts count
    const { data: countData } = await supabase
      .from('campaign_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)

    await supabase
      .from('campaigns')
      .update({ total_contacts: countData?.count || 0 })
      .eq('id', campaignId)

    // Log activity
    await supabase
      .from('campaign_activities')
      .insert({
        campaign_id: campaignId,
        activity_type: 'contacts_added',
        message: `Added ${insertedContacts.length} contacts to campaign`,
        metadata: { count: insertedContacts.length },
      })

    return NextResponse.json({
      success: true,
      added_count: insertedContacts.length,
      contacts: insertedContacts,
    })

  } catch (error) {
    console.error('Error in POST /api/outreach/campaigns/[id]/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a contact from a campaign
export async function DELETE(request, { params }) {
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
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contact_id')

    if (!contactId) {
      return NextResponse.json(
        { error: 'contact_id is required' },
        { status: 400 }
      )
    }

    // Verify campaign ownership
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get the campaign contact to check status
    const { data: campaignContact } = await supabase
      .from('campaign_contacts')
      .select('status')
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId)
      .single()

    // Prevent removal if connection already sent (unless campaign is stopped)
    if (campaignContact && campaignContact.status !== 'pending' && campaign.status !== 'stopped') {
      return NextResponse.json(
        { error: 'Cannot remove contact with active outreach. Please stop the campaign first.' },
        { status: 400 }
      )
    }

    // Delete the campaign contact
    const { error: deleteError } = await supabase
      .from('campaign_contacts')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('contact_id', contactId)

    if (deleteError) {
      console.error('Error removing contact from campaign:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove contact from campaign' },
        { status: 500 }
      )
    }

    // Update campaign total_contacts count
    const { data: countData } = await supabase
      .from('campaign_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)

    await supabase
      .from('campaigns')
      .update({ total_contacts: countData?.count || 0 })
      .eq('id', campaignId)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in DELETE /api/outreach/campaigns/[id]/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
