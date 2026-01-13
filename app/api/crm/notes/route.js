import { requireAuth } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

// GET - Fetch all notes for a contact
export async function GET(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')

    if (!contactId) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    // Fetch notes for the contact
    const { data: notes, error: notesError } = await supabase
      .from('crm_contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (notesError) {
      console.error('Error fetching notes:', notesError)
      return NextResponse.json(
        { error: 'Failed to fetch notes' },
        { status: 500 }
      )
    }

    return NextResponse.json({ notes })
  } catch (error) {
    console.error('Error in GET /api/crm/notes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new note
export async function POST(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const body = await request.json()
    const { contactId, note } = body

    if (!contactId || !note) {
      return NextResponse.json(
        { error: 'Contact ID and note text are required' },
        { status: 400 }
      )
    }

    // Create the note
    const { data: newNote, error: createError } = await supabase
      .from('crm_contact_notes')
      .insert({
        user_id: userId,
        contact_id: contactId,
        note: note
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating note:', createError)
      return NextResponse.json(
        { error: 'Failed to create note' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase
      .from('crm_contact_activities')
      .insert({
        user_id: userId,
        contact_id: contactId,
        activity_type: 'note_added',
        description: 'Added a note',
        metadata: {
          note_id: newNote.id,
          note_preview: note.substring(0, 100)
        }
      })

    return NextResponse.json({ note: newNote })
  } catch (error) {
    console.error('Error in POST /api/crm/notes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update an existing note
export async function PUT(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await request.json()
    const { noteId, note } = body

    if (!noteId || !note) {
      return NextResponse.json(
        { error: 'Note ID and note text are required' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Update the note
    const { data: updatedNote, error: updateError } = await supabase
      .from('crm_contact_notes')
      .update({ note })
      .eq('id', noteId)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating note:', updateError)
      return NextResponse.json(
        { error: 'Failed to update note' },
        { status: 500 }
      )
    }

    return NextResponse.json({ note: updatedNote })
  } catch (error) {
    console.error('Error in PUT /api/crm/notes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a note
export async function DELETE(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('noteId')

    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID is required' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete the note
    const { error: deleteError } = await supabase
      .from('crm_contact_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting note:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete note' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/crm/notes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
