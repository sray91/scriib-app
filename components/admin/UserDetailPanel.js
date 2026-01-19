'use client'

import { useState, useEffect } from 'react'
import { User, Users, FileText, Shield, Mail, Calendar, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import RelationshipManager from './RelationshipManager'
import ContextDocManager from './ContextDocManager'

export default function UserDetailPanel({ user, allUsers, onRefreshUsers }) {
  const [activeTab, setActiveTab] = useState('ghostwriters')

  const getInitials = (name) => {
    if (!name || name === 'Unknown') return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>Select a user to view details</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* User Header */}
      <Card className="bg-[#1C1F26] border-[#2A2F3C] mb-4">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.imageUrl} alt={user.fullName} />
              <AvatarFallback className="bg-[#2A2F3C] text-white text-xl">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white">
                  {user.fullName || 'Unknown User'}
                </h2>
                {user.isAdmin && (
                  <Badge className="bg-[#fb2e01] text-white">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
              </div>
              <div className="space-y-1 text-sm text-gray-400">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Joined: {formatDate(user.createdAt)}
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Last active: {formatDate(user.lastSignInAt)}
                </p>
              </div>
            </div>
          </div>
          {user.supabaseId && (
            <div className="mt-4 pt-4 border-t border-[#2A2F3C]">
              <p className="text-xs text-gray-500">
                <span className="font-medium">Supabase ID:</span> {user.supabaseId}
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-medium">Clerk ID:</span> {user.id}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="bg-[#1C1F26] border border-[#2A2F3C] w-full">
          <TabsTrigger
            value="ghostwriters"
            className="flex-1 data-[state=active]:bg-[#fb2e01] data-[state=active]:text-white"
          >
            <Users className="h-4 w-4 mr-2" />
            Ghostwriters
          </TabsTrigger>
          <TabsTrigger
            value="approvers"
            className="flex-1 data-[state=active]:bg-[#fb2e01] data-[state=active]:text-white"
          >
            <Users className="h-4 w-4 mr-2" />
            Approvers
          </TabsTrigger>
          <TabsTrigger
            value="context"
            className="flex-1 data-[state=active]:bg-[#fb2e01] data-[state=active]:text-white"
          >
            <FileText className="h-4 w-4 mr-2" />
            Context Docs
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 mt-4 overflow-hidden">
          <TabsContent value="ghostwriters" className="h-full m-0">
            {user.supabaseId ? (
              <RelationshipManager
                user={user}
                allUsers={allUsers}
                role="approver"
                onRefresh={onRefreshUsers}
              />
            ) : (
              <div className="text-center text-gray-400 py-8">
                User has no Supabase mapping - cannot manage relationships
              </div>
            )}
          </TabsContent>

          <TabsContent value="approvers" className="h-full m-0">
            {user.supabaseId ? (
              <RelationshipManager
                user={user}
                allUsers={allUsers}
                role="ghostwriter"
                onRefresh={onRefreshUsers}
              />
            ) : (
              <div className="text-center text-gray-400 py-8">
                User has no Supabase mapping - cannot manage relationships
              </div>
            )}
          </TabsContent>

          <TabsContent value="context" className="h-full m-0">
            {user.supabaseId ? (
              <ContextDocManager user={user} />
            ) : (
              <div className="text-center text-gray-400 py-8">
                User has no Supabase mapping - cannot manage context docs
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
