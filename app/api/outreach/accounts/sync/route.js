import { NextResponse } from 'next/server'
import { getUnipileClient } from '@/lib/unipile-client'
import { requireAuth } from '@/lib/api-auth';

// GET - Sync LinkedIn accounts from Unipile
// This endpoint fetches all accounts from Unipile and returns them
// so the user can choose which ones to add to the database
export async function GET(request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    // Fetch accounts from Unipile
    try {
      const unipile = getUnipileClient()
      const unipileAccounts = await unipile.listAccounts()

      // Filter only LinkedIn accounts
      const linkedInAccounts = (unipileAccounts.items || []).filter(
        account => account.type === 'LINKEDIN'
      )

      // Get existing accounts from database to mark which are already connected
      const { data: existingAccounts } = await supabase
        .from('linkedin_outreach_accounts')
        .select('unipile_account_id')
        .eq('user_id', userId)

      const existingAccountIds = new Set(
        (existingAccounts || []).map(acc => acc.unipile_account_id)
      )

      // Mark which accounts are already connected
      const accountsWithStatus = linkedInAccounts.map(account => ({
        ...account,
        is_connected: existingAccountIds.has(account.id),
      }))

      return NextResponse.json({
        success: true,
        accounts: accountsWithStatus,
      })

    } catch (unipileError) {
      console.error('Unipile API error:', unipileError)
      return NextResponse.json(
        { error: 'Failed to fetch Unipile accounts: ' + unipileError.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error in GET /api/outreach/accounts/sync:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
