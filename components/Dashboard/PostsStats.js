'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PostsStats() {
  const [counts, setCounts] = useState({
    drafts: 0,
    pending: 0,
    scheduled: 0
  })
  const supabase = createClientComponentClient()

  // Fetch post counts for the dashboard cards
  useEffect(() => {
    const fetchPostCounts = async () => {
      try {
        // Get all posts
        const { data, error } = await supabase
          .from('posts')
          .select('id, status')
          .limit(100)

        if (error) {
          console.error('Error fetching post counts:', error)
          return
        }

        if (!data) return
        
        // Normalize status values for consistent comparison
        const normalizeStatus = (status) => {
          if (!status) return ''
          return String(status).trim().toLowerCase()
        }

        // Count posts by status
        const postCounts = {
          drafts: data.filter(post => normalizeStatus(post.status) === 'draft').length,
          pending: data.filter(post => normalizeStatus(post.status) === 'pending_approval').length,
          scheduled: data.filter(post => normalizeStatus(post.status) === 'scheduled').length
        }

        setCounts(postCounts)
      } catch (err) {
        console.error('Error in fetchPostCounts:', err)
      }
    }

    fetchPostCounts()
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Draft Posts</CardTitle>
          <CardDescription>Posts in progress</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            <span className="tracking-tight">{counts.drafts}</span>
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Pending Approval</CardTitle>
          <CardDescription>Posts awaiting review</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            <span className="tracking-tight">{counts.pending}</span>
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Scheduled</CardTitle>
          <CardDescription>Posts ready to publish</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            <span className="tracking-tight">{counts.scheduled}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 