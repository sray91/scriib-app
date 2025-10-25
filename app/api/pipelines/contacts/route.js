import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// GET pipeline contacts for a specific pipeline or contact
export async function GET(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pipelineId = searchParams.get('pipeline_id')
    const contactId = searchParams.get('contact_id')

    let query = supabase
      .from('pipeline_contacts')
      .select(`
        *,
        pipelines (
          id,
          name
        ),
        pipeline_stages (
          id,
          name,
          order,
          color
        ),
        crm_contacts (
          id,
          name,
          profile_url,
          job_title,
          company
        )
      `)
      .eq('user_id', user.id)

    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId)
    }

    if (contactId) {
      query = query.eq('contact_id', contactId)
    }

    const { data: pipelineContacts, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching pipeline contacts:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch pipeline contacts' }, { status: 500 })
    }

    return NextResponse.json({ pipeline_contacts: pipelineContacts })
  } catch (error) {
    console.error('Error in GET /api/pipelines/contacts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST add a contact to a pipeline stage
export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pipeline_id, stage_id, contact_id, notes } = body

    if (!pipeline_id || !stage_id || !contact_id) {
      return NextResponse.json(
        { error: 'Pipeline ID, stage ID, and contact ID are required' },
        { status: 400 }
      )
    }

    // Verify the pipeline belongs to the user
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('id')
      .eq('id', pipeline_id)
      .eq('user_id', user.id)
      .single()

    if (pipelineError || !pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // Verify the contact belongs to the user
    const { data: contact, error: contactError } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('id', contact_id)
      .eq('user_id', user.id)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Check if contact is already in this pipeline
    const { data: existing } = await supabase
      .from('pipeline_contacts')
      .select('id, stage_id')
      .eq('pipeline_id', pipeline_id)
      .eq('contact_id', contact_id)
      .single()

    if (existing) {
      // Get old and new stage info for activity logging
      const { data: oldStage } = await supabase
        .from('pipeline_stages')
        .select('name')
        .eq('id', existing.stage_id)
        .single()

      const { data: newStage } = await supabase
        .from('pipeline_stages')
        .select('name')
        .eq('id', stage_id)
        .single()

      // Update the existing record to move to new stage
      const { data: updated, error: updateError } = await supabase
        .from('pipeline_contacts')
        .update({
          stage_id,
          notes: notes || existing.notes
        })
        .eq('id', existing.id)
        .select(`
          *,
          pipelines (
            id,
            name
          ),
          pipeline_stages (
            id,
            name,
            order,
            color
          ),
          crm_contacts (
            id,
            name,
            profile_url,
            job_title,
            company
          )
        `)
        .single()

      if (updateError) {
        console.error('Error updating pipeline contact:', updateError)
        return NextResponse.json({ error: 'Failed to update contact in pipeline' }, { status: 500 })
      }

      // Log stage change activity
      if (existing.stage_id !== stage_id) {
        await supabase
          .from('crm_contact_activities')
          .insert({
            user_id: user.id,
            contact_id,
            activity_type: 'stage_changed',
            description: `Moved to ${newStage?.name || 'new stage'} in ${updated.pipelines.name}`,
            metadata: {
              pipeline_id,
              pipeline_name: updated.pipelines.name,
              old_stage: oldStage?.name || 'unknown',
              new_stage: newStage?.name || 'unknown',
              stage_id
            }
          })
      }

      return NextResponse.json({ pipeline_contact: updated, updated: true })
    }

    // Create new pipeline contact entry
    const { data: pipelineContact, error: createError } = await supabase
      .from('pipeline_contacts')
      .insert({
        pipeline_id,
        stage_id,
        contact_id,
        user_id: user.id,
        notes: notes || null
      })
      .select(`
        *,
        pipelines (
          id,
          name
        ),
        pipeline_stages (
          id,
          name,
          order,
          color
        ),
        crm_contacts (
          id,
          name,
          profile_url,
          job_title,
          company
        )
      `)
      .single()

    if (createError) {
      console.error('Error creating pipeline contact:', createError)
      return NextResponse.json({ error: 'Failed to add contact to pipeline' }, { status: 500 })
    }

    // Log activity for adding contact to pipeline
    await supabase
      .from('crm_contact_activities')
      .insert({
        user_id: user.id,
        contact_id,
        activity_type: 'added_to_pipeline',
        description: `Added to ${pipelineContact.pipelines.name} pipeline (${pipelineContact.pipeline_stages.name})`,
        metadata: {
          pipeline_id,
          pipeline_name: pipelineContact.pipelines.name,
          stage_id,
          stage_name: pipelineContact.pipeline_stages.name
        }
      })

    return NextResponse.json({ pipeline_contact: pipelineContact }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/pipelines/contacts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT update a pipeline contact (move to different stage or update notes)
export async function PUT(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, stage_id, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'Pipeline contact ID is required' }, { status: 400 })
    }

    // Get the current pipeline contact to check for stage changes
    const { data: currentContact } = await supabase
      .from('pipeline_contacts')
      .select(`
        stage_id,
        contact_id,
        pipeline_stages!inner(name)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    const updateData = {}
    if (stage_id !== undefined) updateData.stage_id = stage_id
    if (notes !== undefined) updateData.notes = notes

    // Update the pipeline contact
    const { data: pipelineContact, error: updateError } = await supabase
      .from('pipeline_contacts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(`
        *,
        pipelines (
          id,
          name
        ),
        pipeline_stages (
          id,
          name,
          order,
          color
        ),
        crm_contacts (
          id,
          name,
          profile_url,
          job_title,
          company
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating pipeline contact:', updateError)
      return NextResponse.json({ error: 'Failed to update pipeline contact' }, { status: 500 })
    }

    // Log stage change activity if stage was changed
    if (stage_id !== undefined && currentContact && currentContact.stage_id !== stage_id) {
      await supabase
        .from('crm_contact_activities')
        .insert({
          user_id: user.id,
          contact_id: currentContact.contact_id,
          activity_type: 'stage_changed',
          description: `Moved to ${pipelineContact.pipeline_stages.name} in ${pipelineContact.pipelines.name}`,
          metadata: {
            pipeline_id: pipelineContact.pipeline_id,
            pipeline_name: pipelineContact.pipelines.name,
            old_stage: currentContact.pipeline_stages?.name || 'unknown',
            new_stage: pipelineContact.pipeline_stages.name,
            stage_id
          }
        })
    }

    return NextResponse.json({ pipeline_contact: pipelineContact })
  } catch (error) {
    console.error('Error in PUT /api/pipelines/contacts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE remove a contact from a pipeline
export async function DELETE(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Pipeline contact ID is required' }, { status: 400 })
    }

    // Delete the pipeline contact
    const { error: deleteError } = await supabase
      .from('pipeline_contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting pipeline contact:', deleteError)
      return NextResponse.json({ error: 'Failed to remove contact from pipeline' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/pipelines/contacts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
