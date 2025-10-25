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

    // Check if this is a "merge duplicates" request
    if (body.action === 'merge_duplicates') {
      // Get all contacts for the user
      const { data: allContacts, error: fetchError } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('user_id', user.id)

      if (fetchError) {
        console.error('Error fetching contacts:', fetchError)
        return NextResponse.json(
          { error: 'Failed to fetch contacts' },
          { status: 500 }
        )
      }

      // Group contacts by profile_url
      const contactsByProfile = new Map()
      allContacts.forEach(contact => {
        if (!contactsByProfile.has(contact.profile_url)) {
          contactsByProfile.set(contact.profile_url, [])
        }
        contactsByProfile.get(contact.profile_url).push(contact)
      })

      // Find duplicates and merge them
      const contactsToKeep = []
      const idsToDelete = []

      contactsByProfile.forEach((contacts, profileUrl) => {
        if (contacts.length > 1) {
          // Multiple contacts for same profile - merge them
          const mergedContact = contacts[0] // Keep the first one
          const allEngagementTypes = new Set()

          contacts.forEach(contact => {
            // Collect all engagement types
            if (contact.engagement_type) {
              contact.engagement_type.split(',').forEach(type => {
                allEngagementTypes.add(type.trim())
              })
            }
            // Mark others for deletion
            if (contact.id !== mergedContact.id) {
              idsToDelete.push(contact.id)
            }
          })

          // Update the merged contact with combined engagement types
          mergedContact.engagement_type = Array.from(allEngagementTypes).sort().join(',')
          contactsToKeep.push(mergedContact)
        }
      })

      let mergedCount = 0

      // Update merged contacts
      if (contactsToKeep.length > 0) {
        for (const contact of contactsToKeep) {
          const { error: updateError } = await supabase
            .from('crm_contacts')
            .update({ engagement_type: contact.engagement_type })
            .eq('id', contact.id)

          if (updateError) {
            console.error('Error updating contact:', updateError)
          } else {
            mergedCount++
          }
        }
      }

      // Delete duplicate contacts
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('crm_contacts')
          .delete()
          .in('id', idsToDelete)

        if (deleteError) {
          console.error('Error deleting duplicates:', deleteError)
          return NextResponse.json(
            { error: 'Failed to delete duplicate contacts' },
            { status: 500 }
          )
        }
      }

      return NextResponse.json({
        success: true,
        message: `Merged ${mergedCount} contacts, removed ${idsToDelete.length} duplicates`
      })
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
