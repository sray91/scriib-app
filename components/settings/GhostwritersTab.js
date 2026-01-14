'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { getSupabase } from '@/lib/supabase'
import { useUser } from '@clerk/nextjs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, X, Mail } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert.js'

export default function GhostwritersTab() {
  const supabase = getSupabase()
  const { user, isLoaded } = useUser()
  const [userId, setUserId] = useState(null)
  const [ghostwriters, setGhostwriters] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const { toast } = useToast()

  // Get UUID for current Clerk user
  useEffect(() => {
    if (isLoaded && user) {
      fetch(`/api/user/get-uuid`)
        .then(res => res.json())
        .then(data => {
          if (data.uuid) {
            setUserId(data.uuid)
          }
        })
        .catch(err => console.error('Error fetching UUID:', err))
    }
  }, [isLoaded, user])

  // Fetch data when userId is available
  useEffect(() => {
    if (userId) {
      loadGhostwriters()
    }
  }, [userId])

  const loadGhostwriters = async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      setError(null)

      // Get all ghostwriter links for the current user (as approver)
      const { data, error } = await supabase
        .from('ghostwriter_approver_link')
        .select(`
          id,
          ghostwriter_id,
          active,
          created_at,
          revoked_at
        `)
        .eq('approver_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get the ghostwriters details from users_view
      const ghostwriterIds = data.map(link => link.ghostwriter_id)
      
      if (ghostwriterIds.length > 0) {
        const { data: ghostwriterDetails, error: ghostwriterError } = await supabase
          .from('users_view')
          .select('id, email, raw_user_meta_data')
          .in('id', ghostwriterIds)
        
        if (ghostwriterError) {
          console.error('Error fetching ghostwriter details:', ghostwriterError)
        }
        
        // Format the data
        const formattedGhostwriters = data.map(link => {
          const ghostwriterInfo = ghostwriterDetails?.find(g => g.id === link.ghostwriter_id) || {}
          const userMetadata = ghostwriterInfo.raw_user_meta_data || {}
          
          return {
            id: link.id,
            ghostwriter_id: link.ghostwriter_id,
            active: link.active,
            created_at: link.created_at,
            revoked_at: link.revoked_at,
            email: ghostwriterInfo.email || 'Unknown email',
            full_name: userMetadata.full_name || userMetadata.name || (ghostwriterInfo.email ? ghostwriterInfo.email.split('@')[0] : 'Unknown user')
          }
        })
        
        setGhostwriters(formattedGhostwriters)
      } else {
        setGhostwriters([])
      }
    } catch (error) {
      console.error('Error loading ghostwriters:', error)
      setError('Failed to load ghostwriters. Please try again.')
      toast({
        title: 'Error',
        description: 'Failed to load ghostwriters.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleActive = async (linkId, currentActive) => {
    if (!userId) return

    try {
      const { error } = await supabase
        .from('ghostwriter_approver_link')
        .update({ 
          active: !currentActive,
          revoked_at: !currentActive ? null : new Date().toISOString()
        })
        .eq('id', linkId)
      
      if (error) throw error
      
      // Update the local state
      setGhostwriters(prev => 
        prev.map(ghostwriter => 
          ghostwriter.id === linkId 
            ? {
                ...ghostwriter,
                active: !currentActive,
                revoked_at: !currentActive ? null : new Date().toISOString()
              } 
            : ghostwriter
        )
      )
      
      toast({
        title: 'Success',
        description: !currentActive 
          ? 'Ghostwriter link activated' 
          : 'Ghostwriter link deactivated',
      })
    } catch (error) {
      console.error('Error toggling ghostwriter status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update ghostwriter status',
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
          <CardTitle className="text-xl font-bold">Ghostwriters</CardTitle>
          <div className="text-sm text-gray-500">
            Ghostwriters who have invited you to approve their content
          </div>
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
          ) : ghostwriters.length === 0 ? (
            <div className="text-center py-8 border rounded-lg">
              <p className="text-gray-500">No ghostwriters have invited you yet</p>
              <p className="text-gray-400 text-sm mt-2">When someone invites you to approve their content, they&apos;ll appear here</p>
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
                {ghostwriters.map((ghostwriter) => (
                  <TableRow key={ghostwriter.id}>
                    <TableCell className="font-medium">
                      {ghostwriter.full_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {ghostwriter.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ghostwriter.active ? (
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
                      {formatDate(ghostwriter.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(ghostwriter.id, ghostwriter.active)}
                      >
                        {ghostwriter.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 