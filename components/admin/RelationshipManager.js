'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, UserPlus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { ScrollArea } from '@/components/ui/scroll-area'

/**
 * RelationshipManager component
 * @param {Object} user - The currently selected user
 * @param {Array} allUsers - All users in the system
 * @param {string} role - 'approver' (show ghostwriters who write for this user) or 'ghostwriter' (show approvers who approve for this user)
 * @param {Function} onRefresh - Callback to refresh data
 */
export default function RelationshipManager({ user, allUsers, role, onRefresh }) {
  const [relationships, setRelationships] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const { toast } = useToast()

  // Determine which users to show based on the role
  // If role='approver', user is the approver, so we show their ghostwriters
  // If role='ghostwriter', user is the ghostwriter, so we show their approvers
  const isUserApprover = role === 'approver'
  const relationshipLabel = isUserApprover ? 'Ghostwriters' : 'Approvers'
  const addLabel = isUserApprover ? 'Add Ghostwriter' : 'Add Approver'

  useEffect(() => {
    if (user?.supabaseId) {
      fetchRelationships()
    }
  }, [user?.supabaseId, role])

  const fetchRelationships = async () => {
    setIsLoading(true)
    try {
      const queryRole = isUserApprover ? 'approver' : 'ghostwriter'
      const response = await fetch(
        `/api/admin/relationships?user_id=${user.supabaseId}&role=${queryRole}`
      )
      const data = await response.json()

      if (data.success) {
        setRelationships(data.data)
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch relationships',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching relationships:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch relationships',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addRelationship = async () => {
    if (!selectedUserId) return

    setIsAdding(true)
    try {
      const body = isUserApprover
        ? { ghostwriter_id: selectedUserId, approver_id: user.supabaseId }
        : { ghostwriter_id: user.supabaseId, approver_id: selectedUserId }

      const response = await fetch('/api/admin/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message || 'Relationship created',
        })
        setSelectedUserId('')
        fetchRelationships()
        onRefresh?.()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create relationship',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error adding relationship:', error)
      toast({
        title: 'Error',
        description: 'Failed to create relationship',
        variant: 'destructive',
      })
    } finally {
      setIsAdding(false)
    }
  }

  const removeRelationship = async (relationshipId) => {
    try {
      const response = await fetch(`/api/admin/relationships?id=${relationshipId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message || 'Relationship removed',
        })
        fetchRelationships()
        onRefresh?.()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to remove relationship',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error removing relationship:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove relationship',
        variant: 'destructive',
      })
    }
  }

  // Get the related user from the relationship
  const getRelatedUser = (relationship) => {
    const relatedId = isUserApprover
      ? relationship.ghostwriter_id
      : relationship.approver_id
    return allUsers.find(u => u.supabaseId === relatedId)
  }

  // Get users that can be added (have mapping and not already related)
  const getAvailableUsers = () => {
    const existingIds = relationships.map(r =>
      isUserApprover ? r.ghostwriter_id : r.approver_id
    )

    return allUsers.filter(u =>
      u.supabaseId &&
      u.supabaseId !== user.supabaseId &&
      !existingIds.includes(u.supabaseId)
    )
  }

  const getInitials = (name) => {
    if (!name || name === 'Unknown') return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const availableUsers = getAvailableUsers()

  return (
    <div className="h-full flex flex-col">
      {/* Add New Section */}
      <Card className="bg-[#1C1F26] border-[#2A2F3C] mb-4">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1 bg-[#0F1117] border-[#2A2F3C] text-white">
                <SelectValue placeholder={`Select user to add as ${isUserApprover ? 'ghostwriter' : 'approver'}...`} />
              </SelectTrigger>
              <SelectContent className="bg-[#1C1F26] border-[#2A2F3C]">
                {availableUsers.length === 0 ? (
                  <div className="p-2 text-gray-400 text-sm text-center">
                    No available users
                  </div>
                ) : (
                  availableUsers.map(u => (
                    <SelectItem
                      key={u.supabaseId}
                      value={u.supabaseId}
                      className="text-white hover:bg-[#2A2F3C]"
                    >
                      {u.fullName || 'Unknown'} ({u.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={addRelationship}
              disabled={!selectedUserId || isAdding}
              className="bg-[#fb2e01] hover:bg-[#e02a01] text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Relationships List */}
      <div className="flex-1 overflow-hidden">
        <h3 className="text-sm font-medium text-gray-400 mb-2 px-1">
          {relationshipLabel} ({relationships.length})
        </h3>
        <ScrollArea className="h-[calc(100%-2rem)]">
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          ) : relationships.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No {relationshipLabel.toLowerCase()} assigned</p>
            </div>
          ) : (
            <div className="space-y-2">
              {relationships.map(relationship => {
                const relatedUser = getRelatedUser(relationship)
                return (
                  <Card
                    key={relationship.id}
                    className="bg-[#1C1F26] border-[#2A2F3C]"
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={relatedUser?.imageUrl} />
                          <AvatarFallback className="bg-[#2A2F3C] text-white text-sm">
                            {getInitials(relatedUser?.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-white font-medium">
                            {relatedUser?.fullName || 'Unknown User'}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {relatedUser?.email || 'No email'}
                          </p>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-[#1C1F26] border-[#2A2F3C]">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">
                              Remove Relationship
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-400">
                              Are you sure you want to remove {relatedUser?.fullName || 'this user'} as a{' '}
                              {isUserApprover ? 'ghostwriter' : 'approver'}? This action can be undone by re-adding the relationship.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-[#2A2F3C] text-white border-[#2A2F3C] hover:bg-[#3A3F4C]">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeRelationship(relationship.id)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
