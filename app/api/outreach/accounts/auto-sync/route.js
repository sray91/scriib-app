import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getUnipileClient } from '@/lib/unipile-client'

/**
 * POST - Auto-sync LinkedIn accounts from Unipile
 * This endpoint fetches all LinkedIn accounts from Unipile and automatically
 * creates any new accounts that don't exist in the database yet.
 * This provides a fallback for when webhooks can't reach localhost.
 */
export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch accounts from Unipile
    try {
      const unipile = getUnipileClient()
      const unipileResponse = await unipile.listAccounts()

      // Filter only LinkedIn accounts
      const linkedInAccounts = (unipileResponse.items || []).filter(
        account => account.type === 'LINKEDIN'
      )

      console.log(`Found ${linkedInAccounts.length} LinkedIn accounts in Unipile`)

      // Get existing accounts from database
      const { data: existingAccounts } = await supabase
        .from('linkedin_outreach_accounts')
        .select('unipile_account_id')
        .eq('user_id', user.id)

      const existingAccountIds = new Set(
        (existingAccounts || []).map(acc => acc.unipile_account_id)
      )

      // Find accounts that don't exist in the database yet
      const newAccounts = linkedInAccounts.filter(
        account => !existingAccountIds.has(account.id)
      )

      console.log(`Found ${newAccounts.length} new accounts to create`)

      // Create new accounts in the database
      const createdAccounts = []
      for (const unipileAccount of newAccounts) {
        try {
          // Fetch detailed account info
          const accountDetails = await unipile.getAccount(unipileAccount.id)

          // Extract LinkedIn profile information
          const name = accountDetails.name ||
                      accountDetails.connection_params?.im?.username ||
                      'LinkedIn Account'
          const email = accountDetails.connection_params?.im?.email || null
          const publicIdentifier = accountDetails.connection_params?.im?.publicIdentifier || null
          const profileUrl = publicIdentifier ?
                            `https://www.linkedin.com/in/${publicIdentifier}` :
                            null

          // Create the account
          const { data: newAccount, error: insertError } = await supabase
            .from('linkedin_outreach_accounts')
            .insert({
              user_id: user.id,
              unipile_account_id: unipileAccount.id,
              account_name: name,
              profile_name: name,
              email: email,
              profile_url: profileUrl,
              unipile_provider_data: accountDetails.connection_params,
              daily_connection_limit: 20, // Default limit
              is_active: true,
            })
            .select()
            .single()

          if (insertError) {
            console.error('Error creating account:', insertError)
            // Skip duplicate errors
            if (insertError.code !== '23505') {
              throw insertError
            }
          } else {
            console.log('Created account:', newAccount)
            createdAccounts.push(newAccount)
          }
        } catch (accountError) {
          console.error('Error processing account:', accountError)
          // Continue with other accounts
        }
      }

      return NextResponse.json({
        success: true,
        created: createdAccounts.length,
        total: linkedInAccounts.length,
        accounts: createdAccounts,
      })

    } catch (unipileError) {
      console.error('Unipile API error:', unipileError)
      return NextResponse.json(
        { error: 'Failed to fetch Unipile accounts: ' + unipileError.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error in POST /api/outreach/accounts/auto-sync:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
