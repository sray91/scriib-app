'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Card } from '@/components/ui/card'
import UserList from '@/components/admin/UserList'
import UserDetailPanel from '@/components/admin/UserDetailPanel'

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()

      if (data.success) {
        setUsers(data.data)
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch users',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectUser = (user) => {
    setSelectedUser(user)
  }

  return (
    <div className="h-[calc(100vh-120px)]">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
        {/* User List Panel - 40% width on large screens */}
        <Card className="lg:col-span-2 bg-[#1C1F26] border-[#2A2F3C] overflow-hidden">
          <UserList
            users={users}
            selectedUser={selectedUser}
            onSelectUser={handleSelectUser}
            isLoading={isLoading}
          />
        </Card>

        {/* User Detail Panel - 60% width on large screens */}
        <Card className="lg:col-span-3 bg-[#1C1F26] border-[#2A2F3C] overflow-hidden p-4">
          <UserDetailPanel
            user={selectedUser}
            allUsers={users}
            onRefreshUsers={fetchUsers}
          />
        </Card>
      </div>
    </div>
  )
}
