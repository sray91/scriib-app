'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, UserPlus, X, CheckCircle, Mail, Clock } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert.js'

export default function ApproversTab() {
  const [approvers, setApprovers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  useEffect(() => {
    loadApprovers()
  }, [])

  const loadApprovers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get all approver links for the current user (as ghostwriter)
      const { data, error } = await supabase
        .from('ghostwriter_approver_link')
        .select(`
          id,
          approver_id,
          active,
          created_at,
          revoked_at,
          approver:approver_id(
            id,
            email,
            user_metadata
          )
        `)
        .eq('ghostwriter_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Format the data
      const formattedApprovers = data.map(link => ({
        id: link.id,
        approver_id: link.approver_id,
        active: link.active,
        created_at: link.created_at,
        revoked_at: link.revoked_at,
        email: link.approver.email,
        full_name: link.approver.user_metadata?.full_name || link.approver.email.split('@')[0],
        // If the approver exists but doesn't have a Supabase account yet
        is_registered: !!link.approver.id
      }))

      setApprovers(formattedApprovers)
    } catch (error) {
      console.error('Error loading approvers:', error)
      setError('Failed to load approvers. Please try again.')
      toast({
        title: 'Error',
        description: 'Failed to load approvers.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInviteApprover = async (e) => {
    e.preventDefault()
    
    if (!inviteEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address.',
        variant: 'destructive'
      })
      return
    }
    
    try {
      setIsSubmitting(true)
      setError(null)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be logged in to invite approvers')

      // Call the server action to invite the approver
      const response = await fetch('/api/invite-approver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: inviteEmail,
          ghostwriter_id: user.id
        }),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to invite approver')
      }

      // Add the new approver to the list (optimistically)
      const newApprover = {
        id: result.data.id,
        approver_id: result.data.approver_id,
        active: result.data.active,
        created_at: result.data.created_at,
        email: inviteEmail,
        full_name: inviteEmail.split('@')[0],
        is_registered: result.data.is_registered
      }
      
      setApprovers(prev => [newApprover, ...prev])
      setInviteDialogOpen(false)
      setInviteEmail('')
      
      toast({
        title: 'Success',
        description: result.data.is_registered
          ? 'Approver added successfully'
          : 'Invitation sent successfully',
      })
    } catch (error) {
      console.error('Error inviting approver:', error)
      setError(error.message)
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (approverId, currentActive) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { error } = await supabase
        .from('ghostwriter_approver_link')
        .update({ 
          active: !currentActive,
          revoked_at: !currentActive ? null : new Date().toISOString()
        })
        .eq('id', approverId)
      
      if (error) throw error
      
      // Update the local state
      setApprovers(prev => 
        prev.map(approver => 
          approver.id === approverId 
            ? {
                ...approver,
                active: !currentActive,
                revoked_at: !currentActive ? null : new Date().toISOString()
              } 
            : approver
        )
      )
      
      toast({
        title: 'Success',
        description: !currentActive 
          ? 'Approver link activated' 
          : 'Approver link deactivated',
      })
    } catch (error) {
      console.error('Error toggling approver status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update approver status',
        variant: 'destructive'
      })
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold">Approvers</CardTitle>
          <Button
            onClick={() => setIsInviteDialogOpen(true)}
            className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Approver
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : approvers.length === 0 ? (
            <div className="text-center py-8 border rounded-lg">
              <p className="text-gray-500">No approvers added yet</p>
              <p className="text-gray-400 text-sm mt-2">Invite approvers to review and schedule your posts</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked Since</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvers.map((approver) => (
                  <TableRow key={approver.id}>
                    <TableCell className="font-medium">
                      {approver.full_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {approver.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {!approver.is_registered ? (
                        <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      ) : approver.active ? (
                        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 flex items-center gap-1">
                          <X className="h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDate(approver.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(approver.id, approver.active)}
                        disabled={!approver.is_registered}
                      >
                        {approver.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Approver Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Approver</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInviteApprover} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="approver@example.com"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                We&apos;ll send an invitation email if this person doesn&apos;t have an account yet.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsInviteDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Invitation'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
} 