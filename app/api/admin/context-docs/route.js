import { requireAdmin } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/context-docs
 * Fetch context guides and training documents for a specific user
 * Query params:
 *   - user_id: Required - the Supabase UUID of the user
 *   - type: Optional - 'guides' | 'training' | 'all' (default: 'all')
 */
export async function GET(request) {
  const adminAuth = await requireAdmin()
  if (adminAuth.error) return adminAuth.error

  const { supabase } = adminAuth

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const type = searchParams.get('type') || 'all'

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      )
    }

    const result = { guides: [], trainingDocs: [] }

    // Fetch context guides
    if (type === 'all' || type === 'guides') {
      const { data: guides, error: guidesError } = await supabase
        .from('user_context_guides')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (guidesError) {
        console.error('Error fetching guides:', guidesError)
      } else {
        result.guides = guides || []
      }
    }

    // Fetch training documents
    if (type === 'all' || type === 'training') {
      const { data: trainingDocs, error: trainingError } = await supabase
        .from('training_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (trainingError) {
        console.error('Error fetching training docs:', trainingError)
      } else {
        result.trainingDocs = trainingDocs || []
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Error in context-docs GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/context-docs
 * Create a new context guide for a user
 * Body: { user_id, title, content, guide_type }
 */
export async function POST(request) {
  const adminAuth = await requireAdmin()
  if (adminAuth.error) return adminAuth.error

  const { supabase } = adminAuth

  try {
    const body = await request.json()
    const { user_id, title, content, guide_type = 'custom' } = body

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      )
    }

    if (!title || !content) {
      return NextResponse.json(
        { error: 'title and content are required' },
        { status: 400 }
      )
    }

    // Validate guide_type
    const validTypes = ['content_creation', 'voice_analysis', 'brand_guidelines', 'custom']
    if (!validTypes.includes(guide_type)) {
      return NextResponse.json(
        { error: `guide_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('user_context_guides')
      .insert({
        user_id,
        title,
        content,
        guide_type,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating context guide:', error)
      return NextResponse.json(
        { error: 'Failed to create context guide' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Context guide created',
    })
  } catch (error) {
    console.error('Error in context-docs POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/context-docs
 * Update an existing context guide
 * Body: { id, title?, content?, guide_type?, is_active? }
 */
export async function PUT(request) {
  const adminAuth = await requireAdmin()
  if (adminAuth.error) return adminAuth.error

  const { supabase } = adminAuth

  try {
    const body = await request.json()
    const { id, title, content, guide_type, is_active } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    // Build update object with only provided fields
    const updateData = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (guide_type !== undefined) {
      const validTypes = ['content_creation', 'voice_analysis', 'brand_guidelines', 'custom']
      if (!validTypes.includes(guide_type)) {
        return NextResponse.json(
          { error: `guide_type must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.guide_type = guide_type
    }
    if (is_active !== undefined) updateData.is_active = is_active

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('user_context_guides')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating context guide:', error)
      return NextResponse.json(
        { error: 'Failed to update context guide' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Context guide updated',
    })
  } catch (error) {
    console.error('Error in context-docs PUT:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/context-docs
 * Delete a context guide
 * Query params: id (guide UUID)
 */
export async function DELETE(request) {
  const adminAuth = await requireAdmin()
  if (adminAuth.error) return adminAuth.error

  const { supabase } = adminAuth

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('user_context_guides')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting context guide:', error)
      return NextResponse.json(
        { error: 'Failed to delete context guide' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Context guide deleted',
    })
  } catch (error) {
    console.error('Error in context-docs DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
