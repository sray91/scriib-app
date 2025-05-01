'use client'

import PostsDashboard from '@/components/post-forge/PostsDashboard'
import PostsStats from '@/components/Dashboard/PostsStats'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <div className="container max-w-6xl py-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to CreatorTask</h1>
      <p className="text-muted-foreground mb-8">
        Select a tool from the sidebar to get started with managing your content creation workflow.
      </p>
      
      {/* Original home page cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-12">
        <Card>
          <CardHeader>
            <CardTitle>Quick Start Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Learn how to use CreatorTask effectively</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">View and manage your recent tasks</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Analytics Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Track your content performance</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Dashboard section */}
      <h2 className="text-2xl font-bold mb-6">Content Dashboard</h2>
      
      {/* Post stats component */}
      <PostsStats />
      
      <PostsDashboard />
    </div>
  )
}