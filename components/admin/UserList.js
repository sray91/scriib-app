'use client'

import { useState } from 'react'
import { Search, Shield, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function UserList({ users, selectedUser, onSelectUser, isLoading }) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase()
    return (
      user.fullName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    )
  })

  const getInitials = (name) => {
    if (!name || name === 'Unknown') return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 border-b border-[#2A2F3C]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#1C1F26] border-[#2A2F3C] text-white placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* User List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              {searchTerm ? 'No users found matching your search' : 'No users found'}
            </div>
          ) : (
            filteredUsers.map(user => (
              <Card
                key={user.id}
                onClick={() => onSelectUser(user)}
                className={`p-3 cursor-pointer transition-colors ${
                  selectedUser?.id === user.id
                    ? 'bg-[#fb2e01] border-[#fb2e01]'
                    : 'bg-[#1C1F26] border-[#2A2F3C] hover:border-[#fb2e01]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.imageUrl} alt={user.fullName} />
                    <AvatarFallback className="bg-[#2A2F3C] text-white">
                      {getInitials(user.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium truncate ${
                        selectedUser?.id === user.id ? 'text-white' : 'text-white'
                      }`}>
                        {user.fullName || 'Unknown'}
                      </p>
                      {user.isAdmin && (
                        <Badge variant="outline" className="bg-[#fb2e01]/20 text-[#fb2e01] border-[#fb2e01] text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm truncate ${
                      selectedUser?.id === user.id ? 'text-white/80' : 'text-gray-400'
                    }`}>
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className={`text-xs mt-2 ${
                  selectedUser?.id === user.id ? 'text-white/60' : 'text-gray-500'
                }`}>
                  Last active: {formatDate(user.lastSignInAt)}
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* User Count */}
      <div className="p-4 border-t border-[#2A2F3C] text-gray-400 text-sm">
        {filteredUsers.length} of {users.length} users
      </div>
    </div>
  )
}
