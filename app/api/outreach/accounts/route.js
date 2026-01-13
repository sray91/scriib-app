import { NextResponse } from 'next/server'
import { getUnipileClient } from '@/lib/unipile-client'
import { requireAuth } from '@/lib/api-auth';

// GET - List all LinkedIn outreach accounts for the user
export async function GET(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    // Fetch accounts from database
    const { data: accounts, error: dbError } = await supabase
      .from('linkedin_outreach_accounts')
      .select(`
        *,
        social_accounts (
          platform,
          screen_name,
          profile_data
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('Error fetching outreach accounts:', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ accounts: accounts || [] })

  } catch (error) {
    console.error('Error in GET /api/outreach/accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new LinkedIn outreach account
export async function POST(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const body = await request.json()

    // Validate required fields
    if (!body.account_name || !body.unipile_account_id) {
      return NextResponse.json(
        { error: 'Account name and Unipile account ID are required' },
        { status: 400 }
      )
    }

    // Verify the Unipile account exists and is accessible
    try {
      const unipile = getUnipileClient()
      const unipileAccount = await unipile.getAccount(body.unipile_account_id)

      // Prepare account data
      const accountData = {
        user_id: userId,
        account_name: body.account_name,
        unipile_account_id: body.unipile_account_id,
        social_account_id: body.social_account_id || null,
        email: body.email || unipileAccount.email || null,
        profile_name: body.profile_name || unipileAccount.name || null,
        profile_url: body.profile_url || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
        daily_connection_limit: body.daily_connection_limit || 20,
        unipile_provider_data: unipileAccount.provider_data || null,
      }

      // Insert the account
      const { data: account, error: insertError } = await supabase
        .from('linkedin_outreach_accounts')
        .insert(accountData)
        .select()
        .single()

      if (insertError) {
        console.error('Error inserting outreach account:', insertError)

        // Handle duplicate account
        if (insertError.code === '23505') {
          return NextResponse.json(
            { error: 'This Unipile account is already connected' },
            { status: 409 }
          )
        }

        return NextResponse.json(
          { error: 'Failed to create account' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, account })

    } catch (unipileError) {
      console.error('Unipile API error:', unipileError)
      return NextResponse.json(
        { error: 'Failed to verify Unipile account: ' + unipileError.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error in POST /api/outreach/accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a LinkedIn outreach account
export async function DELETE(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('id')

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Delete the account (RLS will ensure user can only delete their own accounts)
    const { error: deleteError } = await supabase
      .from('linkedin_outreach_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error deleting outreach account:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in DELETE /api/outreach/accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update a LinkedIn outreach account
export async function PATCH(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    // Prepare update data (only allow certain fields to be updated)
    const updateData = {}
    if (body.account_name !== undefined) updateData.account_name = body.account_name
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.daily_connection_limit !== undefined) updateData.daily_connection_limit = body.daily_connection_limit

    // Update the account
    const { data: account, error: updateError } = await supabase
      .from('linkedin_outreach_accounts')
      .update(updateData)
      .eq('id', body.id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating outreach account:', updateError)
      return NextResponse.json(
        { error: 'Failed to update account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, account })

  } catch (error) {
    console.error('Error in PATCH /api/outreach/accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
