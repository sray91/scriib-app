import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// PUT - Create a new contact manually
export async function PUT(request) {
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
    if (!body.name || !body.profile_url) {
      return NextResponse.json(
        { error: 'Name and LinkedIn Profile URL are required' },
        { status: 400 }
      )
    }

    // Prepare contact data
    const contactData = {
      user_id: user.id,
      name: body.name,
      profile_url: body.profile_url,
      subtitle: body.subtitle || null,
      job_title: body.job_title || null,
      company: body.company || null,
      email: body.email || null,
      engagement_type: body.engagement_type || 'like',
      post_url: body.post_url || null,
      scraped_at: new Date().toISOString()
    }

    // Insert the contact
    const { data: contact, error: insertError } = await supabase
      .from('crm_contacts')
      .insert(contactData)
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting contact:', insertError)

      // Handle duplicate profile URL
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A contact with this LinkedIn profile already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create contact' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, contact })

  } catch (error) {
    console.error('Error in PUT /api/crm/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE a single contact by ID
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

    // Get contact ID from request
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('id')

    if (!contactId) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    // Delete the contact (RLS will ensure user can only delete their own contacts)
    const { error: deleteError } = await supabase
      .from('crm_contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', user.id) // Extra safety check

    if (deleteError) {
      console.error('Error deleting contact:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete contact' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in DELETE /api/crm/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE all contacts for the current user
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

    // Check if this is a "delete all" request
    if (body.action === 'delete_all') {
      const { error: deleteError } = await supabase
        .from('crm_contacts')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Error deleting all contacts:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete contacts' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, message: 'All contacts deleted' })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error in POST /api/crm/contacts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
