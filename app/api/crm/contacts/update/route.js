import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// PATCH - Update a contact's information
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
    const { contactId, ...updates } = body

    if (!contactId) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    // Prepare contact data - only include fields that are provided
    const contactData = {}
    const allowedFields = ['name', 'subtitle', 'job_title', 'company', 'email', 'profile_url', 'engagement_type', 'post_url']

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        // Convert empty strings to null
        contactData[field] = updates[field] === '' ? null : updates[field]
      }
    })

    // Update the contact (RLS will ensure user can only update their own contacts)
    const { data: contact, error: updateError } = await supabase
      .from('crm_contacts')
      .update(contactData)
      .eq('id', contactId)
      .eq('user_id', user.id) // Extra safety check
      .select()
      .single()

    if (updateError) {
      console.error('Error updating contact:', updateError)

      // Handle duplicate profile URL
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'A contact with this LinkedIn profile already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to update contact' },
        { status: 500 }
      )
    }

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found or you do not have permission to update it' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, contact })

  } catch (error) {
    console.error('Error in PATCH /api/crm/contacts/update:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
