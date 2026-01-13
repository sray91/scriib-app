import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth';

// GET all pipelines for the authenticated user
export async function GET(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;
    const { searchParams } = new URL(request.url)

    // Fetch pipelines with their stages
    const { data: pipelines, error: pipelinesError } = await supabase
      .from('pipelines')
      .select(`
        *,
        pipeline_stages (
          *
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (pipelinesError) {
      console.error('Error fetching pipelines:', pipelinesError)
      return NextResponse.json({ error: 'Failed to fetch pipelines' }, { status: 500 })
    }

    // Sort stages by order within each pipeline
    const pipelinesWithSortedStages = pipelines.map(pipeline => ({
      ...pipeline,
      pipeline_stages: pipeline.pipeline_stages.sort((a, b) => a.order - b.order)
    }))

    return NextResponse.json({ pipelines: pipelinesWithSortedStages })
  } catch (error) {
    console.error('Error in GET /api/pipelines:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create a new pipeline
export async function POST(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const body = await request.json()
    const { name, description, stages } = body

    if (!name) {
      return NextResponse.json({ error: 'Pipeline name is required' }, { status: 400 })
    }

    // Create the pipeline
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .insert({
        user_id: userId,
        name,
        description: description || null
      })
      .select()
      .single()

    if (pipelineError) {
      console.error('Error creating pipeline:', pipelineError)
      return NextResponse.json({ error: 'Failed to create pipeline' }, { status: 500 })
    }

    // Create stages if provided
    if (stages && stages.length > 0) {
      const stageRecords = stages.map((stage, index) => ({
        pipeline_id: pipeline.id,
        name: stage.name,
        order: stage.order !== undefined ? stage.order : index,
        color: stage.color || '#3b82f6'
      }))

      const { error: stagesError } = await supabase
        .from('pipeline_stages')
        .insert(stageRecords)

      if (stagesError) {
        console.error('Error creating stages:', stagesError)
        // Pipeline was created but stages failed - return partial success
        return NextResponse.json({
          pipeline,
          warning: 'Pipeline created but failed to create stages'
        }, { status: 201 })
      }

      // Fetch the complete pipeline with stages
      const { data: completePipeline } = await supabase
        .from('pipelines')
        .select(`
          *,
          pipeline_stages (*)
        `)
        .eq('id', pipeline.id)
        .single()

      return NextResponse.json({ pipeline: completePipeline }, { status: 201 })
    }

    return NextResponse.json({ pipeline }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/pipelines:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT update a pipeline
export async function PUT(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const body = await request.json()
    const { id, name, description } = body

    if (!id || !name) {
      return NextResponse.json({ error: 'Pipeline ID and name are required' }, { status: 400 })
    }

    // Update the pipeline
    const { data: pipeline, error: updateError } = await supabase
      .from('pipelines')
      .update({
        name,
        description: description || null
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating pipeline:', updateError)
      return NextResponse.json({ error: 'Failed to update pipeline' }, { status: 500 })
    }

    return NextResponse.json({ pipeline })
  } catch (error) {
    console.error('Error in PUT /api/pipelines:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE delete a pipeline
export async function DELETE(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Pipeline ID is required' }, { status: 400 })
    }

    // Delete the pipeline (stages and contacts will cascade delete)
    const { error: deleteError } = await supabase
      .from('pipelines')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting pipeline:', deleteError)
      return NextResponse.json({ error: 'Failed to delete pipeline' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/pipelines:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
