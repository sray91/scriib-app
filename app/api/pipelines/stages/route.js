import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth';

// POST create a new stage
export async function POST(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const body = await request.json()
    const { pipeline_id, name, order, color } = body

    if (!pipeline_id || !name) {
      return NextResponse.json({ error: 'Pipeline ID and stage name are required' }, { status: 400 })
    }

    // Verify the pipeline belongs to the user
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('id')
      .eq('id', pipeline_id)
      .eq('user_id', userId)
      .single()

    if (pipelineError || !pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
    }

    // Create the stage
    const { data: stage, error: stageError } = await supabase
      .from('pipeline_stages')
      .insert({
        pipeline_id,
        name,
        order: order !== undefined ? order : 0,
        color: color || '#3b82f6'
      })
      .select()
      .single()

    if (stageError) {
      console.error('Error creating stage:', stageError)
      return NextResponse.json({ error: 'Failed to create stage' }, { status: 500 })
    }

    return NextResponse.json({ stage }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/pipelines/stages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT update a stage
export async function PUT(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const body = await request.json()
    const { id, name, order, color } = body

    if (!id) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 })
    }

    // Verify the stage belongs to a pipeline owned by the user
    const { data: stage, error: stageError } = await supabase
      .from('pipeline_stages')
      .select(`
        id,
        pipeline_id,
        pipelines!inner (
          user_id
        )
      `)
      .eq('id', id)
      .single()

    if (stageError || !stage || stage.pipelines.user_id !== userId) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Update the stage
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (order !== undefined) updateData.order = order
    if (color !== undefined) updateData.color = color

    const { data: updatedStage, error: updateError } = await supabase
      .from('pipeline_stages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating stage:', updateError)
      return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
    }

    return NextResponse.json({ stage: updatedStage })
  } catch (error) {
    console.error('Error in PUT /api/pipelines/stages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE delete a stage
export async function DELETE(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 })
    }

    // Verify the stage belongs to a pipeline owned by the user
    const { data: stage, error: stageError } = await supabase
      .from('pipeline_stages')
      .select(`
        id,
        pipeline_id,
        pipelines!inner (
          user_id
        )
      `)
      .eq('id', id)
      .single()

    if (stageError || !stage || stage.pipelines.user_id !== userId) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Delete the stage (contacts in this stage will cascade delete)
    const { error: deleteError } = await supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting stage:', deleteError)
      return NextResponse.json({ error: 'Failed to delete stage' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/pipelines/stages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
