import { requireAdmin } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/relationships
 * Fetch all relationships or filter by user_id
 * Query params:
 *   - user_id: Filter by ghostwriter OR approver UUID
 *   - role: 'ghostwriter' | 'approver' - which role the user_id plays
 */
export async function GET(request) {
  const adminAuth = await requireAdmin()
  if (adminAuth.error) return adminAuth.error

  const { supabase } = adminAuth

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const role = searchParams.get('role') // 'ghostwriter' or 'approver'

    let query = supabase
      .from('ghostwriter_approver_link')
      .select('*')
      .eq('active', true)

    if (userId && role) {
      if (role === 'ghostwriter') {
        query = query.eq('ghostwriter_id', userId)
      } else if (role === 'approver') {
        query = query.eq('approver_id', userId)
      }
    } else if (userId) {
      // If no role specified, get relationships where user is either ghostwriter or approver
      query = query.or(`ghostwriter_id.eq.${userId},approver_id.eq.${userId}`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching relationships:', error)
      return NextResponse.json(
        { error: 'Failed to fetch relationships' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Error in relationships GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/relationships
 * Create a new ghostwriter-approver relationship
 * Body: { ghostwriter_id: uuid, approver_id: uuid }
 */
export async function POST(request) {
  const adminAuth = await requireAdmin()
  if (adminAuth.error) return adminAuth.error

  const { supabase } = adminAuth

  try {
    const body = await request.json()
    const { ghostwriter_id, approver_id } = body

    if (!ghostwriter_id || !approver_id) {
      return NextResponse.json(
        { error: 'Both ghostwriter_id and approver_id are required' },
        { status: 400 }
      )
    }

    if (ghostwriter_id === approver_id) {
      return NextResponse.json(
        { error: 'Ghostwriter and approver cannot be the same user' },
        { status: 400 }
      )
    }

    // Check if relationship already exists
    const { data: existing, error: checkError } = await supabase
      .from('ghostwriter_approver_link')
      .select('id, active')
      .eq('ghostwriter_id', ghostwriter_id)
      .eq('approver_id', approver_id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found", which is expected for new relationships
      console.error('Error checking existing relationship:', checkError)
      return NextResponse.json(
        { error: 'Failed to check existing relationship' },
        { status: 500 }
      )
    }

    if (existing) {
      if (existing.active) {
        return NextResponse.json(
          { error: 'This relationship already exists' },
          { status: 400 }
        )
      }

      // Reactivate existing relationship
      const { data, error } = await supabase
        .from('ghostwriter_approver_link')
        .update({
          active: true,
          revoked_at: null
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error reactivating relationship:', error)
        return NextResponse.json(
          { error: 'Failed to reactivate relationship' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data,
        message: 'Relationship reactivated',
      })
    }

    // Create new relationship
    const { data, error } = await supabase
      .from('ghostwriter_approver_link')
      .insert({
        ghostwriter_id,
        approver_id,
        active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating relationship:', error)
      return NextResponse.json(
        { error: 'Failed to create relationship' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Relationship created',
    })
  } catch (error) {
    console.error('Error in relationships POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/relationships
 * Remove (deactivate) a relationship
 * Query params: id (relationship UUID)
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
        { error: 'Relationship id is required' },
        { status: 400 }
      )
    }

    // Soft delete by setting active to false
    const { data, error } = await supabase
      .from('ghostwriter_approver_link')
      .update({
        active: false,
        revoked_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error deleting relationship:', error)
      return NextResponse.json(
        { error: 'Failed to delete relationship' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Relationship removed',
    })
  } catch (error) {
    console.error('Error in relationships DELETE:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
