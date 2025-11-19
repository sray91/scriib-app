'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Linkedin, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from '@/components/ui/badge'

export default function LinkedInAccountManager() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState(null)
  const { toast } = useToast()

  // Fetch connected accounts
  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/outreach/accounts')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch accounts')
      }

      setAccounts(data.accounts || [])
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast({
        title: 'Error',
        description: 'Failed to load LinkedIn accounts',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Sync accounts from Unipile and auto-create new ones
  const syncAccountsFromUnipile = async () => {
    try {
      const response = await fetch('/api/outreach/accounts/auto-sync', {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync accounts')
      }

      if (data.created > 0) {
        toast({
          title: 'Success',
          description: `${data.created} LinkedIn account${data.created > 1 ? 's' : ''} connected successfully`,
        })
      }

      return data
    } catch (error) {
      console.error('Error syncing accounts:', error)
      toast({
        title: 'Error',
        description: 'Failed to sync LinkedIn accounts',
        variant: 'destructive'
      })
    }
  }

  // Open hosted auth flow to connect LinkedIn account
  const connectLinkedInAccount = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/outreach/accounts/connect', {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create auth link')
      }

      // Open Unipile hosted auth in a popup window
      const popup = window.open(
        data.url,
        'unipile-auth',
        'width=600,height=700,scrollbars=yes'
      )

      // Poll for popup close or redirect
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup)
          // Auto-sync accounts from Unipile after popup closes
          setTimeout(async () => {
            await syncAccountsFromUnipile()
            fetchAccounts()
          }, 1000)
        }
      }, 500)

      toast({
        title: 'Opening authentication window',
        description: 'Please complete the LinkedIn authentication in the popup window',
      })

    } catch (error) {
      console.error('Error connecting account:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to connect LinkedIn account',
        variant: 'destructive'
      })
    } finally {
      setSyncing(false)
    }
  }

  // Delete account
  const handleDeleteAccount = async () => {
    if (!deleteAccountId) return

    try {
      const response = await fetch(`/api/outreach/accounts?id=${deleteAccountId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      toast({
        title: 'Success',
        description: 'LinkedIn account removed successfully',
      })

      fetchAccounts()
    } catch (error) {
      console.error('Error deleting account:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete account',
        variant: 'destructive'
      })
    } finally {
      setDeleteAccountId(null)
    }
  }

  // Toggle account active status
  const toggleAccountStatus = async (accountId, currentStatus) => {
    try {
      const response = await fetch('/api/outreach/accounts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: accountId,
          is_active: !currentStatus,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update account')
      }

      toast({
        title: 'Success',
        description: `Account ${!currentStatus ? 'activated' : 'deactivated'}`,
      })

      fetchAccounts()
    } catch (error) {
      console.error('Error updating account:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to update account',
        variant: 'destructive'
      })
    }
  }

  useEffect(() => {
    fetchAccounts()

    // Check for auth success/error in URL params
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')

    if (status === 'success') {
      toast({
        title: 'Success',
        description: 'LinkedIn account connected successfully',
      })
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname)
    } else if (status === 'error') {
      toast({
        title: 'Error',
        description: 'Failed to connect LinkedIn account. Please try again.',
        variant: 'destructive'
      })
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>LinkedIn Outreach Accounts</CardTitle>
            <CardDescription>
              Connect LinkedIn accounts via Unipile for outreach campaigns
            </CardDescription>
          </div>
          <Button
            onClick={connectLinkedInAccount}
            disabled={syncing}
            className="bg-[#fb2e01] hover:bg-[#e02a01]"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Connect Account
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12">
            <Linkedin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-1">No accounts connected</p>
            <p className="text-sm text-muted-foreground mb-4">
              Connect a LinkedIn account via Unipile to start outreach campaigns
            </p>
            <Button
              onClick={connectLinkedInAccount}
              disabled={syncing}
              className="bg-[#fb2e01] hover:bg-[#e02a01]"
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Your First Account
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Daily Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.account_name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {account.profile_name || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {account.email || 'N/A'}
                    </TableCell>
                    <TableCell>{account.daily_connection_limit} / day</TableCell>
                    <TableCell>
                      <Badge
                        variant={account.is_active ? 'default' : 'secondary'}
                        className={account.is_active ? 'bg-green-500' : ''}
                      >
                        {account.is_active ? (
                          <>
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-1 h-3 w-3" />
                            Inactive
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAccountStatus(account.id, account.is_active)}
                        >
                          {account.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteAccountId(account.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAccountId} onOpenChange={(open) => !open && setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove LinkedIn Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this LinkedIn account? Active campaigns using this account will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
