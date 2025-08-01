'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Users } from 'lucide-react'
import ApprovalWorkflow from '@/components/ApprovalWorkflow'

export default function ApprovalPortal() {
  const [posts, setPosts] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadUserAndPosts()
  }, [])

  const loadUserAndPosts = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      if (!user) {
        window.location.href = '/login'
        return
      }

      // Fetch posts that need approval where current user is the approver
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'pending_approval')
        .eq('approver_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching posts:', error)
        return
      }

      // Manually fetch user data for each unique user ID in the posts
      const userIds = new Set()
      postsData.forEach(post => {
        if (post.user_id) userIds.add(post.user_id)
        if (post.approver_id) userIds.add(post.approver_id)
        if (post.ghostwriter_id) userIds.add(post.ghostwriter_id)
      })
      
      // Only fetch users if there are any IDs to fetch
      let users = {}
      if (userIds.size > 0) {
        const { data: userData, error: userError } = await supabase
          .from('users_view')
          .select('id, email, raw_user_meta_data')
          .in('id', Array.from(userIds))
        
        if (userError) {
          console.error('Error fetching user data:', userError)
        } else if (userData) {
          // Create a map of user ID to user data
          userData.forEach(user => {
            users[user.id] = user
          })
        }
      }

      // Transform the data for display
      const formattedPosts = postsData.map(post => {
        const creator = users[post.user_id]
        const approver = users[post.approver_id]
        const ghostwriter = users[post.ghostwriter_id]
        
        return {
          ...post,
          creator_name: creator?.raw_user_meta_data?.full_name || creator?.raw_user_meta_data?.name || creator?.email?.split('@')[0] || 'Unknown',
          approver_name: approver?.raw_user_meta_data?.full_name || approver?.raw_user_meta_data?.name || approver?.email?.split('@')[0] || null,
          ghostwriter_name: ghostwriter?.raw_user_meta_data?.full_name || ghostwriter?.raw_user_meta_data?.name || ghostwriter?.email?.split('@')[0] || null
        }
      })

      setPosts(formattedPosts || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenApprovalDialog = (post) => {
    setSelectedPost(post)
    setIsApprovalDialogOpen(true)
  }

  const handleApprovePost = async (comment) => {
    try {
      if (!selectedPost) return
      
      const { error } = await supabase
        .from('posts')
        .update({
          status: 'approved',
          approval_comment: comment,
          scheduled: true,
          edited_at: new Date().toISOString()
        })
        .eq('id', selectedPost.id)
      
      if (error) throw error
      
      // Refresh posts after approval
      await loadUserAndPosts()
    } catch (error) {
      console.error('Error approving post:', error)
    }
  }

  const handleRejectPost = async (comment) => {
    try {
      if (!selectedPost) return
      
      const { error } = await supabase
        .from('posts')
        .update({
          status: 'rejected',
          approval_comment: comment,
          scheduled: false,
          edited_at: new Date().toISOString()
        })
        .eq('id', selectedPost.id)
      
      if (error) throw error
      
      // Refresh posts after rejection
      await loadUserAndPosts()
    } catch (error) {
      console.error('Error rejecting post:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Header with Logo */}
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="flex h-12 w-12 items-center justify-center">
              <Image src="/scriib-logo.png" width={48} height={48} alt="Scriib Logo" />
            </div>
            <div className="font-bebas-neue text-2xl tracking-wide text-black">SCRIIB</div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Approval Portal</h1>
          <p className="text-gray-600">
            Review and approve content that&apos;s pending your approval
          </p>
        </div>

        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No posts pending approval</h3>
              <p className="text-gray-500">
                All caught up! There are no posts waiting for your approval at this time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div 
                    className="p-6 cursor-pointer"
                    onClick={() => handleOpenApprovalDialog(post)}
                  >
                    <div className="flex flex-col space-y-4">
                      {/* Header with status and timestamp */}
                      <div className="flex items-center justify-between">
                        <Badge className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
                          <Clock size={14} />
                          Pending Approval
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {/* Content preview */}
                      <div className="my-2">
                        <p className="text-gray-800 whitespace-pre-wrap line-clamp-3">
                          {post.content}
                        </p>
                      </div>
                      
                      {/* Author info */}
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Users size={14} /> 
                        <span>
                          Created by {post.creator_name || 'Unknown'}
                          {post.ghostwriter_id && (
                            <> • Written by {post.ghostwriter_name || 'Unknown'}</>
                          )}
                        </span>
                      </div>
                      
                      {/* Platform info */}
                      {post.platforms && post.platforms.length > 0 && (
                        <div className="text-sm text-gray-500">
                          Platforms: {post.platforms.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Approval Dialog */}
      {isApprovalDialogOpen && selectedPost && (
        <ApprovalWorkflow
          post={selectedPost}
          isOpen={isApprovalDialogOpen}
          onClose={() => setIsApprovalDialogOpen(false)}
          onApprove={handleApprovePost}
          onReject={handleRejectPost}
          isApprover={selectedPost?.approver_id === currentUser?.id}
        />
      )}
    </div>
  )
}