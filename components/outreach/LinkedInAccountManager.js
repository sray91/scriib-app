'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Linkedin, Plus, Trash2, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [unipileAccounts, setUnipileAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState(null)
  const [selectedUnipileAccount, setSelectedUnipileAccount] = useState(null)
  const [accountName, setAccountName] = useState('')
  const [dailyLimit, setDailyLimit] = useState(20)
  const [saving, setSaving] = useState(false)
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

  // Sync accounts from Unipile
  const syncUnipileAccounts = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/outreach/accounts/sync')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync accounts')
      }

      setUnipileAccounts(data.accounts || [])
      setIsAddDialogOpen(true)
    } catch (error) {
      console.error('Error syncing accounts:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync Unipile accounts',
        variant: 'destructive'
      })
    } finally {
      setSyncing(false)
    }
  }

  // Add account
  const handleAddAccount = async () => {
    if (!selectedUnipileAccount || !accountName.trim()) {
      toast({
        title: 'Error',
        description: 'Please select an account and provide a name',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/outreach/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_name: accountName,
          unipile_account_id: selectedUnipileAccount.id,
          email: selectedUnipileAccount.email,
          profile_name: selectedUnipileAccount.name || selectedUnipileAccount.display_name,
          daily_connection_limit: dailyLimit,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add account')
      }

      toast({
        title: 'Success',
        description: 'LinkedIn account added successfully',
      })

      setIsAddDialogOpen(false)
      setSelectedUnipileAccount(null)
      setAccountName('')
      setDailyLimit(20)
      fetchAccounts()
    } catch (error) {
      console.error('Error adding account:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to add account',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
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
            onClick={syncUnipileAccounts}
            disabled={syncing}
            className="bg-[#fb2e01] hover:bg-[#e02a01]"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
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
              onClick={syncUnipileAccounts}
              disabled={syncing}
              className="bg-[#fb2e01] hover:bg-[#e02a01]"
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
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

      {/* Add Account Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect LinkedIn Account</DialogTitle>
            <DialogDescription>
              Select a LinkedIn account from Unipile to use for outreach campaigns
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {unipileAccounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  No LinkedIn accounts found in Unipile. Please add accounts in your Unipile dashboard first.
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.open('https://app.unipile.com', '_blank')}
                >
                  Open Unipile Dashboard
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Account</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                    {unipileAccounts.map((account) => (
                      <div
                        key={account.id}
                        className={`p-3 border rounded-md cursor-pointer transition-colors ${
                          selectedUnipileAccount?.id === account.id
                            ? 'border-[#fb2e01] bg-[#fb2e01]/5'
                            : 'hover:bg-muted'
                        } ${account.is_connected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !account.is_connected && setSelectedUnipileAccount(account)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Linkedin className="h-5 w-5 text-[#0077b5]" />
                            <div>
                              <p className="font-medium">
                                {account.name || account.display_name || account.email}
                              </p>
                              <p className="text-sm text-muted-foreground">{account.email}</p>
                            </div>
                          </div>
                          {account.is_connected && (
                            <Badge variant="secondary">Already Connected</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedUnipileAccount && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="account-name">Account Name</Label>
                      <Input
                        id="account-name"
                        placeholder="e.g., Personal LinkedIn, Work Account"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Give this account a friendly name to identify it
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="daily-limit">Daily Connection Limit</Label>
                      <Input
                        id="daily-limit"
                        type="number"
                        min="1"
                        max="100"
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum connection requests per day (recommended: 20)
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                setSelectedUnipileAccount(null)
                setAccountName('')
                setDailyLimit(20)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAccount}
              disabled={!selectedUnipileAccount || !accountName.trim() || saving}
              className="bg-[#fb2e01] hover:bg-[#e02a01]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
