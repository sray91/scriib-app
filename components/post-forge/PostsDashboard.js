'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Calendar, CheckCircle, Clock, Edit, XCircle, Users } from 'lucide-react'
import Link from 'next/link'
import PostEditorDialog from './PostEditorDialog'
import { Badge } from '@/components/ui/badge'
import ApprovalWorkflow from '@/components/ApprovalWorkflow'

export default function PostsDashboard() {
  const [activeTab, setActiveTab] = useState('all')
  const [posts, setPosts] = useState([])
  const [filteredPosts, setFilteredPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState(null)
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false)
  const [isCreatingNewPost, setIsCreatingNewPost] = useState(false)
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Load current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) throw error
        setCurrentUser(user)
      } catch (error) {
        console.error('Error fetching current user:', error)
        toast({
          title: 'Error',
          description: 'Could not authenticate user',
          variant: 'destructive'
        })
      }
    }

    fetchCurrentUser()
  }, [])

  // Load posts when user is available
  useEffect(() => {
    if (currentUser) {
      fetchPosts()
    }
  }, [currentUser])

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

  // Helper function to normalize status values
  const normalizeStatus = (status) => {
    if (!status) return '';
    return String(status).trim().toLowerCase();
  };

  // Filter posts when tab or posts change
  useEffect(() => {
    if (!posts || !posts.length) {
      setFilteredPosts([])
      return
    }
    
    // DIAGNOSTIC: Direct detailed logging of all posts 
    console.log('🔍 ALL POSTS AVAILABLE IN STATE:');
    posts.forEach(post => {
      console.log(`ID: ${post.id.substring(0, 8)}, Status: "${post.status}", Raw Status Type: ${typeof post.status}`);
    });
    
    // Try to find draft posts by various methods
    console.log('🔍 LOOKING FOR DRAFT POSTS:');
    const draftPosts = posts.filter(post => normalizeStatus(post.status) === 'draft');
    console.log(`Found ${draftPosts.length} draft posts:`, draftPosts.map(p => ({ id: p.id.substring(0,8), status: p.status })));

    let filtered = [];
    
    switch (activeTab) {
      case 'drafts':
        // Simple filter for drafts
        filtered = posts.filter(post => normalizeStatus(post.status) === 'draft');
        console.log(`DRAFTS tab should show ${filtered.length} posts`);
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
    
    // DIAGNOSTIC: Log the filtered posts for the current tab 
    console.log(`DIAGNOSTIC - ${activeTab} tab should have ${filtered.length} posts`);
    console.log('DIAGNOSTIC - Filtered posts:', filtered.map(p => ({ id: p.id.substring(0,8), status: p.status })));
    
    // Set filtered posts
    setFilteredPosts(filtered);
  }, [activeTab, posts, currentUser])

  const fetchPosts = async () => {
    try {
      setIsLoading(true)
      
      if (!currentUser?.id) {
        console.error('Cannot fetch posts: currentUser or currentUser.id is null');
        setIsLoading(false);
        return;
      }
      
      console.log('Fetching posts for user ID:', currentUser.id);
      
      // Fetch posts related to the current user in any capacity (creator, approver, or ghostwriter)
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .or(`user_id.eq.${currentUser.id},approver_id.eq.${currentUser.id},ghostwriter_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) {
        console.error('Supabase error when fetching posts:', error);
        throw error;
      }

      console.log('Posts data retrieved:', data ? data.length : 0, 'posts found related to user ID:', currentUser.id);

      // Manually fetch user data for each unique user ID in the posts
      const userIds = new Set();
      data.forEach(post => {
        if (post.user_id) userIds.add(post.user_id);
        if (post.approver_id) userIds.add(post.approver_id);
        if (post.ghostwriter_id) userIds.add(post.ghostwriter_id);
      });
      
      // Only fetch users if there are any IDs to fetch
      let users = {};
      if (userIds.size > 0) {
        const { data: userData, error: userError } = await supabase
          .from('users_view')
          .select('id, email, raw_user_meta_data')
          .in('id', Array.from(userIds));
        
        if (userError) {
          console.error('Error fetching user data:', userError);
        } else if (userData) {
          // Create a map of user ID to user data
          userData.forEach(user => {
            users[user.id] = user;
          });
        }
      }

      // Transform the data for display
      const formattedPosts = data.map(post => {
        const creator = users[post.user_id];
        const approver = users[post.approver_id];
        const ghostwriter = users[post.ghostwriter_id];
        
        // Use the original post status - don't normalize it yet
        // This ensures we preserve the exact database value
        const status = post.status;
        
        return {
          ...post,
          status,
          creator_name: creator?.raw_user_meta_data?.full_name || creator?.raw_user_meta_data?.name || creator?.email?.split('@')[0] || 'Unknown',
          approver_name: approver?.raw_user_meta_data?.full_name || approver?.raw_user_meta_data?.name || approver?.email?.split('@')[0] || null,
          ghostwriter_name: ghostwriter?.raw_user_meta_data?.full_name || ghostwriter?.raw_user_meta_data?.name || ghostwriter?.email?.split('@')[0] || null
        };
      });

      // DIAGNOSTIC: Log all post statuses directly from the database
      console.log('DIAGNOSTIC - Raw post statuses from database:');
      data.forEach(post => {
        console.log(`Post ID: ${post.id}, Raw Status: "${post.status}"`);
      });

      console.log('Formatted posts:');
      formattedPosts.forEach(post => {
        console.log(`Post ID: ${post.id}, Status: "${post.status}", Creator: ${post.creator_name}`);
      });

      setPosts(formattedPosts)
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