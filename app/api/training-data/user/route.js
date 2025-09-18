import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')
    const dataType = searchParams.get('type') // 'trending_posts', 'training_documents', 'context_guide'

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    if (!dataType) {
      return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if current user has permission to access target user's training data
    const hasPermission = await checkUserPermission(supabase, user.id, targetUserId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    let data = null

    switch (dataType) {
      case 'trending_posts':
        const { data: trendingData, error: trendingError } = await supabase
          .from('trending_posts')
          .select('*')
          .or(`user_id.eq.${targetUserId},user_id.is.null`)
          .order('created_at', { ascending: false })

        if (trendingError) throw trendingError
        data = trendingData
        break

      case 'training_documents':
        const { data: documentsData, error: documentsError } = await supabase
          .from('training_documents')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })

        if (documentsError) throw documentsError
        data = documentsData
        break

      case 'context_guide':
        const { data: prefsData, error: prefsError } = await supabase
          .from('user_preferences')
          .select('settings, updated_at')
          .eq('user_id', targetUserId)
          .single()

        if (prefsError && prefsError.code !== 'PGRST116') throw prefsError
        data = prefsData?.settings?.contextGuide || null
        break

      default:
        return NextResponse.json({ error: 'Invalid data type' }, { status: 400 })
    }

    return NextResponse.json({ data })

  } catch (error) {
    console.error('Error fetching user training data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch training data' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await request.json()
    const { targetUserId, dataType, data: payload } = body

    if (!targetUserId || !dataType || !payload) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if current user has permission to modify target user's training data
    const hasPermission = await checkUserPermission(supabase, user.id, targetUserId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    let result = null

    switch (dataType) {
      case 'trending_posts':
        // Add user_id to the payload for trending posts
        const trendingPostData = { ...payload, user_id: targetUserId }

        const { data: trendingResult, error: trendingError } = await supabase
          .from('trending_posts')
          .insert(trendingPostData)
          .select()

        if (trendingError) throw trendingError
        result = trendingResult
        break

      case 'training_documents':
        // Add user_id to the payload for training documents
        const documentData = { ...payload, user_id: targetUserId }

        const { data: documentResult, error: documentError } = await supabase
          .from('training_documents')
          .insert(documentData)
          .select()

        if (documentError) throw documentError
        result = documentResult
        break

      case 'context_guide':
        // Update user preferences
        const { data: existingPrefs, error: selectError } = await supabase
          .from('user_preferences')
          .select('id, settings')
          .eq('user_id', targetUserId)
          .single()

        if (selectError && selectError.code !== 'PGRST116') throw selectError

        const updatedSettings = {
          ...(existingPrefs?.settings || {}),
          contextGuide: payload.contextGuide,
          lastTrainingDate: payload.lastTrainingDate
        }

        let prefsResult
        if (existingPrefs) {
          prefsResult = await supabase
            .from('user_preferences')
            .update({
              settings: updatedSettings,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPrefs.id)
        } else {
          prefsResult = await supabase
            .from('user_preferences')
            .insert({
              user_id: targetUserId,
              settings: updatedSettings,
              updated_at: new Date().toISOString()
            })
        }

        if (prefsResult.error) throw prefsResult.error
        result = { success: true }
        break

      default:
        return NextResponse.json({ error: 'Invalid data type' }, { status: 400 })
    }

    return NextResponse.json({ data: result })

  } catch (error) {
    console.error('Error updating user training data:', error)
    return NextResponse.json(
      { error: 'Failed to update training data' },
      { status: 500 }
    )
  }
}

async function checkUserPermission(supabase, currentUserId, targetUserId) {
  try {
    // If user is accessing their own data, allow it
    if (currentUserId === targetUserId) {
      return true
    }

    // Check if current user is linked to target user through ghostwriter_approver_link
    const { data, error } = await supabase
      .from('ghostwriter_approver_link')
      .select('*')
      .or(`and(ghostwriter_id.eq.${currentUserId},approver_id.eq.${targetUserId}),and(ghostwriter_id.eq.${targetUserId},approver_id.eq.${currentUserId})`)
      .eq('active', true)

    if (error) throw error

    return data && data.length > 0
  } catch (error) {
    console.error('Error checking user permission:', error)
    return false
  }
}