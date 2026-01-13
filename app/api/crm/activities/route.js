import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth';

// GET - Fetch all activities for a contact
export async function GET(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')

    if (!contactId) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
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

    // Fetch activities for the contact
    const { data: activities, error: activitiesError } = await supabase
      .from('crm_contact_activities')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      )
    }

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('Error in GET /api/crm/activities:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new activity (for manual activity logging)
export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await request.json()
    const { contactId, activityType, description, metadata } = body

    if (!contactId || !activityType || !description) {
      return NextResponse.json(
        { error: 'Contact ID, activity type, and description are required' },
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

    // Create the activity
    const { data: newActivity, error: createError } = await supabase
      .from('crm_contact_activities')
      .insert({
        user_id: userId,
        contact_id: contactId,
        activity_type: activityType,
        description: description,
        metadata: metadata || {}
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating activity:', createError)
      return NextResponse.json(
        { error: 'Failed to create activity' },
        { status: 500 }
      )
    }

    return NextResponse.json({ activity: newActivity })
  } catch (error) {
    console.error('Error in POST /api/crm/activities:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
