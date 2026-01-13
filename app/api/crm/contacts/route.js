import { requireAuth } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

// PUT - Create a new contact manually
export async function PUT(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Prepare contact data
    const contactData = {
      user_id: userId,
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
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

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
      .eq('user_id', userId) // Extra safety check

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
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const body = await request.json()

    // Check if this is a "delete all" request
    if (body.action === 'delete_all') {
      const { error: deleteError } = await supabase
        .from('crm_contacts')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        console.error('Error deleting all contacts:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete contacts' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, message: 'All contacts deleted' })
    }

    // Check if this is an "import CSV" request
    if (body.action === 'import_csv') {
      const { contacts: csvContacts } = body

      if (!csvContacts || !Array.isArray(csvContacts) || csvContacts.length === 0) {
        return NextResponse.json(
          { error: 'No contacts provided' },
          { status: 400 }
        )
      }

      // Validate and prepare contacts for insertion
      const contactsToInsert = csvContacts.map(contact => ({
        user_id: userId,
        name: contact.name || null,
        profile_url: contact.profile_url || null,
        subtitle: contact.subtitle || null,
        job_title: contact.job_title || null,
        company: contact.company || null,
        email: contact.email || null,
        engagement_type: contact.engagement_type || null,
        post_url: contact.post_url || null,
        scraped_at: new Date().toISOString()
      })).filter(contact => contact.name) // Only require name

      if (contactsToInsert.length === 0) {
        return NextResponse.json(
          { error: 'No valid contacts found in CSV. Each contact must have a name. Please check that your CSV columns are mapped correctly and contain data.' },
          { status: 400 }
        )
      }

      // Insert contacts - use insert instead of upsert for contacts without profile_url
      // Separate contacts with and without profile_url for proper duplicate handling
      const contactsWithProfile = contactsToInsert.filter(c => c.profile_url)
      const contactsWithoutProfile = contactsToInsert.filter(c => !c.profile_url)

      let insertedCount = 0
      let insertError = null

      // Upsert contacts with profile_url (can dedupe on user_id, profile_url)
      if (contactsWithProfile.length > 0) {
        const { data, error } = await supabase
          .from('crm_contacts')
          .upsert(contactsWithProfile, {
            onConflict: 'user_id,profile_url',
            ignoreDuplicates: false
          })
          .select()

        if (error) {
          insertError = error
        } else {
          insertedCount += data?.length || contactsWithProfile.length
        }
      }

      // Insert contacts without profile_url (no deduplication possible)
      if (!insertError && contactsWithoutProfile.length > 0) {
        const { data, error } = await supabase
          .from('crm_contacts')
          .insert(contactsWithoutProfile)
          .select()

        if (error) {
          insertError = error
        } else {
          insertedCount += data?.length || contactsWithoutProfile.length
        }
      }

      if (insertError) {
        console.error('Error importing contacts:', insertError)
        return NextResponse.json(
          { error: 'Failed to import contacts' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${insertedCount} contacts`,
        imported: insertedCount
      })
    }

    // Check if this is a "merge duplicates" request
    if (body.action === 'merge_duplicates') {
      // Get all contacts for the user
      const { data: allContacts, error: fetchError } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('user_id', userId)

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

      contactsByProfile.forEach((contacts, _profileUrl) => {
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
