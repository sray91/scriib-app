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

    // First, fetch campaign contacts without join to debug
    const { data: basicContacts, error: basicError } = await supabase
      .from('campaign_contacts')
      .select('*')
      .eq('campaign_id', campaignId)

    console.log('Basic query result:', {
      count: basicContacts?.length || 0,
      error: basicError,
      contacts: basicContacts
    })

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
        { error: 'Failed to fetch campaign contacts', details: dbError.message },
        { status: 500 }
      )
    }

    console.log(`Fetched ${campaignContacts?.length || 0} contacts for campaign ${campaignId}`)
    console.log('Contacts with join:', campaignContacts)

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
        { error: 'Failed to add contacts to campaign', details: insertError.message },
        { status: 500 }
      )
    }

    console.log(`Successfully inserted ${insertedContacts?.length || 0} contacts into campaign ${campaignId}`)

    // Update campaign total_contacts count
    const { count, error: countError } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)

    if (countError) {
      console.error('Error counting campaign contacts:', countError)
    }

    console.log(`Total contacts in campaign ${campaignId}: ${count}`)

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ total_contacts: count || 0 })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating campaign total_contacts:', updateError)
    }

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
    const { count, error: countError } = await supabase
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)

    if (countError) {
      console.error('Error counting campaign contacts:', countError)
    }

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ total_contacts: count || 0 })
      .eq('id', campaignId)

    if (updateError) {
      console.error('Error updating campaign total_contacts:', updateError)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in DELETE /api/outreach/campaigns/[id]/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
