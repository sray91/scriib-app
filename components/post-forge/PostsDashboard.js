'use client'

import { useState, useEffect } from 'react'
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, CheckCircle, Clock, Edit, XCircle, Users } from 'lucide-react'
import Link from 'next/link'
import PostEditorDialog from './PostEditorDialog'
import { Badge } from '@/components/ui/badge'
import ApprovalWorkflow from '@/components/ApprovalWorkflow'
import { useSupabase } from '@/lib/hooks/useSupabase'

// Helper function to normalize status values
const normalizeStatus = (status) => {
  if (!status) return '';
  return String(status).trim().toLowerCase();
};

export default function PostsDashboard() {
  const [activeTab, setActiveTab] = useState('all')
  const [posts, setPosts] = useState([])
  const [filteredPosts, setFilteredPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState(null)
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false)
  const [isCreatingNewPost, setIsCreatingNewPost] = useState(false)
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)

  const { supabase, userId, user, isLoaded, isLoading: isAuthLoading } = useSupabase()
  const { toast } = useToast()

  // Create currentUser object for compatibility with child components
  const currentUser = userId ? { id: userId } : null

  // Load posts when Clerk auth is ready and user is logged in
  useEffect(() => {
    if (isLoaded && user) {
      fetchPosts()
    }
  }, [isLoaded, user])

  // Helper to more robustly check if a post is a draft
  const isDraft = (post) => {
    if (!post) return false;
    
    // If no status, assume it's a draft
    if (!post.status) return true;
    
    // Convert to string and lowercase
    const status = String(post.status || '').trim().toLowerCase();
    
    // Check for actual draft status
    return status === 'draft';
  };
  
  // Helper to get the correct status for display
  const getDisplayStatus = (post) => {
    if (!post) return 'draft';
    
    // If status is explicitly set, use it
    if (post.status) {
      const status = String(post.status).toLowerCase();
      
      // Map the status to one of our display categories
      if (status === 'draft' || status === '') return 'draft';
      if (status === 'pending_approval') return 'pending_approval';
      if (status === 'needs_edit') return 'needs_edit';
      if (status === 'approved') return 'approved';
      if (status === 'scheduled') return 'scheduled';
      if (status === 'rejected') return 'rejected';
      if (status === 'published') return 'published';
    }
    
    // Default to 'draft' for unknown statuses
    return 'draft';
  };

  // Filter posts when tab or posts change
  useEffect(() => {
    if (!posts || !posts.length) {
      setFilteredPosts([])
      return
    }
    

    let filtered = [];
    
    switch (activeTab) {
      case 'drafts':
        // Simple filter for drafts
        filtered = posts.filter(post => normalizeStatus(post.status) === 'draft');
        break;
      case 'pending':
        filtered = posts.filter(post => normalizeStatus(post.status) === 'pending_approval');
        break;
      case 'needs_edit':
        filtered = posts.filter(post => normalizeStatus(post.status) === 'needs_edit');
        break;
      case 'approved':
        filtered = posts.filter(post => normalizeStatus(post.status) === 'approved');
        break;
      case 'scheduled':
        filtered = posts.filter(post => normalizeStatus(post.status) === 'scheduled');
        break;
      case 'rejected':
        filtered = posts.filter(post => normalizeStatus(post.status) === 'rejected');
        break;
      default: // 'all'
        filtered = posts;
    }
    
    // Set filtered posts
    setFilteredPosts(filtered);
  }, [activeTab, posts])

  const fetchPosts = async () => {
    try {
      setIsLoading(true)

      console.log('Fetching posts via API...');

      // Use API route which has proper auth and bypasses RLS
      const response = await fetch('/api/posts/list')
      const data = await response.json()

      if (!response.ok) {
        console.error('API error when fetching posts:', data.error);
        throw new Error(data.error || 'Failed to fetch posts')
      }

      console.log('Posts data retrieved:', data.posts?.length || 0, 'posts found');

      setPosts(data.posts || [])
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: 'Error',
        description: `Failed to load posts: ${error.message || 'Unknown error'}`,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreatePost = () => {
    const newPost = {
      content: '',
      platforms: {},
      scheduledTime: new Date().toISOString(),
      status: 'draft'
    }
    
    setSelectedPost(newPost)
    setIsCreatingNewPost(true)
    setIsPostEditorOpen(true)
  }

  const handleEditPost = (post) => {
    setSelectedPost(post)
    setIsCreatingNewPost(false)
    setIsPostEditorOpen(true)
  }

  const handlePostSave = async (savedPost) => {
    // After a post is saved, refresh the posts list
    await fetchPosts()
    
    setIsPostEditorOpen(false)
    setSelectedPost(null)
  }

  const handleCloseEditor = () => {
    setIsPostEditorOpen(false)
  }

  const handleDeletePost = async (postId) => {
    if (!postId) return;
    
    try {
      toast({
        title: 'Deleting post...',
        description: 'Please wait while we delete the post.',
      });
      
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      
      // Update local state
      setPosts(prev => prev.filter(post => post.id !== postId));
      
      toast({
        title: 'Success',
        description: 'Post deleted successfully',
      });
      
      setIsPostEditorOpen(false);
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete post: ' + error.message,
        variant: 'destructive',
      });
    }
  };

  const handleArchivePost = async (postId, archived = true) => {
    if (!postId) return;
    
    try {
      toast({
        title: archived ? 'Archiving post...' : 'Unarchiving post...',
        description: 'Please wait while we update the post.',
      });
      
      const response = await fetch('/api/posts/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: postId, archived }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to archive post');
      }

      const result = await response.json();
      
      // Update local state - remove archived posts from the current list
      if (archived) {
        setPosts(prev => prev.filter(post => post.id !== postId));
      }
      
      toast({
        title: 'Success',
        description: result.message,
      });
      
      setIsPostEditorOpen(false);
    } catch (error) {
      console.error('Error archiving post:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to archive post',
        variant: 'destructive',
      });
    }
  };

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
      
      toast({
        title: 'Success',
        description: 'Post has been approved'
      })
      
      // Refresh the posts list
      await fetchPosts()
    } catch (error) {
      console.error('Error approving post:', error)
      toast({
        title: 'Error',
        description: 'Failed to approve post',
        variant: 'destructive'
      })
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
      
      toast({
        title: 'Notice',
        description: 'Post has been rejected'
      })
      
      // Refresh the posts list
      await fetchPosts()
    } catch (error) {
      console.error('Error rejecting post:', error)
      toast({
        title: 'Error',
        description: 'Failed to reject post',
        variant: 'destructive'
      })
    }
  }

  const getStatusBadge = (status) => {
    // Default to 'draft' if status is null or undefined
    const safeStatus = normalizeStatus(status);
    
    const statusConfig = {
      draft: {
        label: 'Draft',
        className: 'bg-gray-100 text-gray-800',
        icon: Edit 
      },
      pending_approval: {
        label: 'Pending Approval',
        className: 'bg-yellow-100 text-yellow-800',
        icon: Clock
      },
      needs_edit: {
        label: 'Needs Edit',
        className: 'bg-blue-100 text-blue-800',
        icon: Edit
      },
      approved: {
        label: 'Approved',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle
      },
      scheduled: {
        label: 'Scheduled',
        className: 'bg-purple-100 text-purple-800',
        icon: Calendar
      },
      rejected: {
        label: 'Rejected',
        className: 'bg-red-100 text-red-800',
        icon: XCircle
      },
      published: {
        label: 'Published',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle
      }
    }

    const config = statusConfig[safeStatus] || statusConfig.draft
    const Icon = config.icon

    return (
      <Badge className={`flex items-center gap-1 ${config.className}`}>
        <Icon size={14} />
        {config.label}
      </Badge>
    )
  }

  // Sort posts by created time descending
  const sortedPosts = [...filteredPosts].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  )

  // Calculate counts for badges with safety checks
  const counts = {
    drafts: posts.filter(post => normalizeStatus(post.status) === 'draft').length,
    pending: posts.filter(post => normalizeStatus(post.status) === 'pending_approval').length,
    needs_edit: posts.filter(post => normalizeStatus(post.status) === 'needs_edit').length,
    scheduled: posts.filter(post => normalizeStatus(post.status) === 'scheduled').length
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button 
          className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
          onClick={handleCreatePost}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create New Post
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="mb-6">
          <TabsList className="flex bg-gray-100 p-1 rounded-lg">
            <TabsTrigger 
              value="all" 
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              All Posts
            </TabsTrigger>
            <TabsTrigger 
              value="drafts" 
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm relative"
            >
              Drafts
              {counts.drafts > 0 && (
                <span className="absolute -top-1 -right-1 bg-gray-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {counts.drafts}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="pending" 
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm relative"
            >
              Needs Approval
              {counts.pending > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {counts.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="needs_edit" 
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm relative"
            >
              Needs Edit
              {counts.needs_edit > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {counts.needs_edit}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="approved" 
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Approved
            </TabsTrigger>
            <TabsTrigger 
              value="scheduled" 
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm relative"
            >
              Scheduled
              {counts.scheduled > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {counts.scheduled}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="rejected" 
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              Rejected
            </TabsTrigger>

          </TabsList>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="rounded-md bg-gray-200 h-6 w-24 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2.5"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-2.5"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ) : sortedPosts.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">No posts found</p>
                <Link href="/post-forge">
                  <Button 
                    className="mt-4 bg-[#fb2e01] hover:bg-[#fb2e01]/90"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Post
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            // Safely map over posts with error boundary
            sortedPosts.map(post => {
              try {
                // Safe getter for nested properties
                const safeGet = (obj, path, fallback = '') => {
                  return path.split('.').reduce((acc, part) => acc && acc[part], obj) || fallback;
                };

                return (
                  <Card key={post?.id || Math.random()} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <div 
                        className="p-6 cursor-pointer"
                        onClick={() => {
                          // If the post needs approval and current user is the approver
                          if (post?.status?.toLowerCase() === 'pending_approval' && post?.approver_id === currentUser?.id) {
                            handleOpenApprovalDialog(post)
                          } else {
                            handleEditPost(post)
                          }
                        }}
                      >
                        <div className="flex flex-col space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              {getStatusBadge(post?.status)}
                              
                              {post?.scheduled_time && (
                                <div className="text-sm text-gray-500 mt-1">
                                  {post?.scheduled ? "Scheduled for: " : "Target date: "}
                                  {new Date(post.scheduled_time).toLocaleString()}
                                </div>
                              )}
                              
                              {/* Show approver name when assigned */}
                              {post?.approver_id && post?.approver_name && (
                                <div className="mt-1">
                                  <Badge className="bg-blue-50 text-blue-800 hover:bg-blue-100 flex items-center gap-1">
                                    <Users size={14} />
                                    For {post.approver_name}
                                  </Badge>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {post?.platforms && Object.entries(post.platforms).map(([platform, enabled]) => 
                                enabled && (
                                  <Badge key={platform} variant="outline" className="capitalize">
                                    {platform}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                          
                          <div className="my-2">
                            <p className="text-gray-800 whitespace-pre-wrap line-clamp-3">
                              {post?.content || ''}
                            </p>
                          </div>
                          
                          <div className="flex justify-between text-sm text-gray-500">
                            <div className="flex items-center gap-2">
                              <Users size={14} /> 
                              <span>
                                {post?.user_id === currentUser?.id ? 'You' : (post?.creator_name || 'Unknown')}
                                {post?.ghostwriter_id && post?.status?.toLowerCase() === 'needs_edit' && (
                                  <> • For editing by {post.ghostwriter_id === currentUser?.id ? 'you' : (post?.ghostwriter_name || 'Unknown')}</>
                                )}
                                {post?.approver_id && ['pending_approval', 'approved', 'rejected'].includes(post?.status?.toLowerCase()) && (
                                  <> • {post.status?.toLowerCase() === 'pending_approval' ? 'Awaiting' : post.status?.toLowerCase() === 'approved' ? 'Approved by' : 'Rejected by'} {post.approver_id === currentUser?.id ? 'you' : (post?.approver_name || 'Unknown')}</>
                                )}
                              </span>
                            </div>
                            <span>{post?.created_at ? new Date(post.created_at).toLocaleDateString() : 'Unknown date'}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              } catch (err) {
                console.error('Error rendering post:', err, post);
                return (
                  <Card key={Math.random()} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-6 text-center">
                      <p className="text-red-500">Error displaying this post</p>
                    </CardContent>
                  </Card>
                );
              }
            })
          )}
        </div>
      </Tabs>
      
      {isPostEditorOpen && (
        <PostEditorDialog
          isOpen={isPostEditorOpen}
          onOpenChange={setIsPostEditorOpen}
          post={selectedPost}
          isNew={isCreatingNewPost}
          onSave={handlePostSave}
          onClose={handleCloseEditor}
          onDelete={handleDeletePost}
          onArchive={handleArchivePost}
        />
      )}
      
      {isApprovalDialogOpen && (
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