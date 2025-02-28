"use client";

// pages/content-scheduler.js
import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Send, List, Grid, TrashIcon, Pencil, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApprovalWorkflow from '@/components/ApprovalWorkflow';

const supabase = createClientComponentClient();

// Helper function to format date for Supabase
function formatDateForSupabase(date) {
  // Format as: YYYY-MM-DD HH:mm:ssZ
  return date.toISOString();  // This will give us the correct timezone format
}

export default function ContentScheduler() {
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({
    content: '',
    platforms: {}, 
    scheduledTime: new Date().toISOString(),
    requiresApproval: false,
    approverId: '',
    mediaFiles: []
  });
  const [approvers, setApprovers] = useState([]);
  const [activeTab, setActiveTab] = useState('compose');
  const [deletingPosts, setDeletingPosts] = useState({});
  const { toast } = useToast();
  const [view, setView] = useState('list');
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeView, setActiveView] = useState('queue'); // 'queue', 'drafts', 'approvals', 'sent'
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [approvalComment, setApprovalComment] = useState('');
  
  // Function to check if current user is an approver
  const [isUserApprover, setIsUserApprover] = useState(false);
  
  // Add new state for counts
  const [postCounts, setPostCounts] = useState({
    queue: 0,
    drafts: 0,
    approvals: 0,
    sent: 0,
    rejected: 0
  });
  
  // Add new state for post details dialog
  const [isPostDetailsOpen, setIsPostDetailsOpen] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedScheduledTime, setEditedScheduledTime] = useState(new Date());
  const [comment, setComment] = useState('');
  
  // Add these state variables at the top with other states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [postToEdit, setPostToEdit] = useState(null);
  
  useEffect(() => {
    fetchAccounts();
    fetchPosts();
    fetchApprovers();
    checkApproverStatus();
  }, []);

  useEffect(() => {
    console.log('Current posts state:', posts);
  }, [posts]);

  async function fetchAccounts() {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching accounts:', error);
      return;
    }
    setAccounts(data || []);
  }

  async function fetchPosts() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // First, get all posts to calculate counts
      const { data: allPosts, error: countError } = await supabase
        .from('posts')
        .select('*');

      if (countError) throw countError;

      // Update counts regardless of active view
      setPostCounts({
        queue: allPosts.filter(p => p.status === 'scheduled').length,
        drafts: allPosts.filter(p => p.status === 'draft').length,
        approvals: allPosts.filter(p => p.status === 'pending_approval').length,
        sent: allPosts.filter(p => p.status === 'published').length,
        rejected: allPosts.filter(p => p.status === 'rejected').length
      });

      // Then get posts for current view
      let query = supabase
        .from('posts')
        .select('*');

      if (activeView === 'approvals') {
        query = query.eq('status', 'pending_approval');
      } else if (activeView === 'queue') {
        query = query.eq('status', 'scheduled');
      } else {
        const statusMap = {
          drafts: 'draft',
          sent: 'published',
          rejected: 'rejected'
        };
        query = query.eq('status', statusMap[activeView]);
      }

      const { data, error } = await query;
      
      console.log('Posts query result:', {
        activeView,
        query: query.toString(), // Log the actual query
        postsCount: data?.length,
        posts: data,
        error
      });

      if (error) throw error;
      setPosts(data || []);

    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch posts",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    console.log('Component mounted or activeView changed:', {
      activeView,
      isUserApprover
    });
    fetchPosts();
  }, [activeView]);

  async function fetchApprovers() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      const { data, error } = await supabase
        .from('user_teams')
        .select(`
          user_id,
          role,
          users:auth_user_list!user_id (
            id,
            email,
            raw_user_meta_data
          )
        `)
        .eq('role', 'approver');

      console.log('Approvers query response:', { data, error });

      if (error) throw error;
      
      // Transform the data to match your component's needs
      const formattedApprovers = data
        .filter(item => item.users) // Ensure user exists
        .map(item => ({
          id: item.users.id,
          email: item.users.email,
          users: {
            raw_user_meta_data: item.users.raw_user_meta_data
          }
        }));

      setApprovers(formattedApprovers);
    } catch (error) {
      console.error('Detailed error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load approvers list",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    fetchApprovers();
  }, []);

  async function handleMediaUpload(e) {
    e.preventDefault();
    
    // Get files from either drop event or file input
    const files = e.dataTransfer ? 
      Array.from(e.dataTransfer.files) : 
      Array.from(e.target.files || []);
      
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    const uploadedFiles = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');
      
      // Show loading toast
      toast({
        title: "Uploading",
        description: "Uploading your media files...",
      });
      
      // First, check if we need to create a bucket
      try {
        // Try to create the bucket (will fail if it already exists, which is fine)
        await supabase.storage.createBucket('media', {
          public: true
        });
        console.log('Media bucket created or already exists');
      } catch (bucketError) {
        // If error is not "bucket already exists", log it but continue
        if (!bucketError.message?.includes('already exists')) {
          console.warn('Note about bucket creation:', bucketError);
        }
      }
      
      // For testing purposes, let's create mock media files instead of actual uploads
      // This will allow us to test the UI without relying on storage permissions
      for (const file of files) {
        // Create a mock URL for the file
        const mockUrl = URL.createObjectURL(file);
        const mockPath = `mock-${Math.random().toString(36).substring(2)}`;
        
        console.log(`Creating mock file entry with URL: ${mockUrl}`);
        
        uploadedFiles.push({
          path: mockPath,
          type: file.type,
          url: mockUrl,
          file: file // Store the actual file for later use if needed
        });
      }
      
      // Update state with new media files
      if (postToEdit) {
        // If editing a post
        setPostToEdit(prev => {
          const updatedPost = {
            ...prev,
            mediaFiles: [...(prev.mediaFiles || []), ...uploadedFiles]
          };
          console.log('Updated post with media:', updatedPost);
          return updatedPost;
        });
      } else {
        // If creating a new post
        setNewPost(prev => {
          const updatedPost = {
            ...prev,
            mediaFiles: [...(prev.mediaFiles || []), ...uploadedFiles]
          };
          console.log('Updated new post with media:', updatedPost);
          return updatedPost;
        });
      }
      
      // Success toast
      toast({
        title: "Success",
        description: `${uploadedFiles.length} file(s) added successfully`,
      });
      
    } catch (error) {
      console.error('Error in handleMediaUpload:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload media files",
        variant: "destructive",
      });
    }
  }

  async function handleRemoveMedia(index) {
    const fileToRemove = newPost.mediaFiles[index];
    
    const { error } = await supabase.storage
      .from('media')
      .remove([fileToRemove.path]);
      
    if (error) {
      console.error('Error removing file:', error);
      return;
    }
    
    setNewPost(prev => ({
      ...prev,
      mediaFiles: prev.mediaFiles.filter((_, i) => i !== index)
    }));
  }

  async function handleSubmitPost(e) {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if this is a scheduled post or immediate post
      const isScheduled = e.target.textContent === 'Schedule Post';
      const isApprovalRequired = newPost.requiresApproval;
      
      const postStatus = isApprovalRequired 
        ? 'pending_approval'
        : isScheduled 
          ? 'scheduled' 
          : 'published';

      const { data: createdPost, error: postError } = await supabase
        .from('posts')
        .insert([{
          content: newPost.content,
          platforms: newPost.platforms,
          scheduled_time: newPost.scheduledTime,
          status: postStatus,
          user_id: user.id,
          approver_id: isApprovalRequired ? newPost.approverId : null,
          requires_approval: isApprovalRequired
        }])
        .select()
        .single();

      if (postError) throw postError;

      // If we have media files, save them to the media_files table
      if (newPost.mediaFiles && newPost.mediaFiles.length > 0) {
        const mediaEntries = newPost.mediaFiles.map(file => ({
          post_id: createdPost.id,
          file_path: file.path,
          file_type: file.type
        }));
        
        const { error: mediaError } = await supabase
          .from('media_files')
          .insert(mediaEntries);
          
        if (mediaError) {
          console.error('Error saving media files:', mediaError);
          // Continue anyway, as the post was created successfully
        }
      }

      // Only attempt to post to social media if it's a "Post Now" and doesn't require approval
      if (!isScheduled && !isApprovalRequired) {
        // Existing social media posting logic
        // ... Twitter posting code ...
      }

      // Success toast
      toast({
        title: "Success",
        description: isApprovalRequired 
          ? "Post sent for approval!"
          : isScheduled 
            ? "Post scheduled successfully!" 
            : "Post published successfully!",
      });

      // Reset form and close dialog
      setNewPost({
        content: '',
        platforms: {},
        scheduledTime: new Date().toISOString(),
        requiresApproval: false,
        approverId: '',
        mediaFiles: []
      });
      setIsCreatePostOpen(false);

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }

  async function handleDeletePost(postId) {
    try {
      setDeletingPosts(prev => ({ ...prev, [postId]: true }));

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) {
        throw error;
      }

      // Also delete any associated media files
      const { data: mediaFiles } = await supabase
        .from('media_files')
        .select('file_path')
        .eq('post_id', postId);

      if (mediaFiles?.length > 0) {
        await supabase.storage
          .from('media')
          .remove(mediaFiles.map(file => file.file_path));
      }

      // Refresh the posts list
      fetchPosts();

    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post. Please try again.');
    } finally {
      setDeletingPosts(prev => ({ ...prev, [postId]: false }));
    }
  }

  // Update the handleApprovalAction function:
  async function handleApprovalAction(approved, comment) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData = approved ? {
        status: 'scheduled',
        approval_status: 'approved',
        approval_comment: comment,
        approved_at: new Date().toISOString(),
        approved_by: user.id
      } : {
        status: 'rejected',
        approval_status: 'rejected',
        approval_comment: comment,
        approved_at: new Date().toISOString(),
        approved_by: user.id
      };

      const { error } = await supabase
        .from('posts')
        .update(updateData)
        .eq('id', selectedPost.id);

      if (error) throw error;

      toast({
        title: approved ? "Post Approved" : "Post Rejected",
        description: approved 
          ? `Post will be published at ${new Date(selectedPost.scheduled_time).toLocaleString()}`
          : "Post has been rejected and won't be published",
      });

      setSelectedPost(null);
      fetchPosts();

    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to process approval action",
        variant: "destructive",
      });
    }
  }

  // Add this function to handle edit
  const handleEditPost = async (e) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if this needs approval
      const isApprovalRequired = postToEdit.requiresApproval;
      const postStatus = isApprovalRequired ? 'pending_approval' : 'scheduled';

      const { error } = await supabase
        .from('posts')
        .update({
          content: postToEdit.content,
          scheduled_time: postToEdit.scheduled_time,
          platforms: postToEdit.platforms,
          status: postStatus,
          approver_id: isApprovalRequired ? postToEdit.approverId : null,
          requires_approval: isApprovalRequired,
          media_files: postToEdit.mediaFiles
        })
        .eq('id', postToEdit.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: isApprovalRequired 
          ? "Post submitted for approval" 
          : "Post updated successfully",
      });
      
      setIsEditDialogOpen(false);
      setPostToEdit(null);
      fetchPosts();
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: "Error",
        description: "Failed to update post",
        variant: "destructive",
      });
    }
  };

  // Modify the post rendering to include edit/delete buttons
  const renderPostActions = (post) => (
    <div className="flex items-center gap-2 ml-2" onClick={e => e.stopPropagation()}>
      <Button
        size="icon"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          setPostToEdit(post);
          setIsEditDialogOpen(true);
        }}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="text-red-500 hover:text-red-700"
        onClick={(e) => {
          e.stopPropagation();
          handleDeletePost(post.id);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const checkApproverStatus = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is an approver either through user_teams or direct is_approver flag
      const { data, error } = await supabase
        .from('users')
        .select(`
          is_approver,
          user_teams!inner (
            role
          )
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // User is an approver if they have is_approver flag or are a team approver
      const isApprover = data.is_approver || 
        (data.user_teams || []).some(team => team.role === 'approver');

      setIsUserApprover(isApprover);
    } catch (error) {
      console.error('Error checking approver status:', error);
      setIsUserApprover(false);
    }
  };

  // Modify handlePostClick to handle different post types
  const handlePostClick = (post) => {
    if (post.status === 'pending_approval' && isUserApprover) {
      // Use ApprovalWorkflow for approval posts
      setSelectedPost(post);
      setIsPostDetailsOpen(true);
    } else {
      // Open edit dialog for other posts
      setPostToEdit(post);
      setIsEditDialogOpen(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Content Scheduler</h1>
      </div>

      <Tabs value={activeView} onValueChange={setActiveView} className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="queue">
              Queue <span className="ml-1 bg-gray-100 px-1.5 rounded">
                {postCounts.queue}
              </span>
            </TabsTrigger>
            <TabsTrigger value="drafts">
              Drafts <span className="ml-1 bg-gray-100 px-1.5 rounded">
                {postCounts.drafts}
              </span>
            </TabsTrigger>
            <TabsTrigger value="approvals">
              Approvals <span className="ml-1 bg-purple-100 text-purple-800 px-1.5 rounded">
                {postCounts.approvals}
              </span>
            </TabsTrigger>
            <TabsTrigger value="sent">
              Sent <span className="ml-1 bg-gray-100 px-1.5 rounded">
                {postCounts.sent}
              </span>
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected <span className="ml-1 bg-red-100 text-red-800 px-1.5 rounded">
                {postCounts.rejected}
              </span>
            </TabsTrigger>
          </TabsList>
          
          <Button 
            onClick={() => setIsCreatePostOpen(true)}
            className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
          >
            + New Post
          </Button>
        </div>

        <TabsContent value="approvals" className="space-y-4">
          {posts
            .filter(post => post.status === 'pending_approval')
            .map((post) => (
              <div 
                key={post.id} 
                className="border rounded-lg p-4 mb-4 cursor-pointer hover:border-gray-400 transition-colors"
                onClick={() => handlePostClick(post)}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                        Pending Approval
                      </span>
                      <span className="text-sm text-gray-500">
                        Scheduled for: {new Date(post.scheduled_time).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-800">{post.content}</p>
                    {post.platforms && Object.entries(post.platforms).length > 0 && (
                      <div className="flex gap-2">
                        {Object.entries(post.platforms).map(([platform, enabled]) => 
                          enabled && (
                            <span key={platform} className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {platform}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                  {renderPostActions(post)}
                </div>
              </div>
            ))}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {posts
            .filter(post => post.status === 'rejected')
            .map((post) => (
              <div key={post.id} className="border rounded-lg p-6 bg-white shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                      Rejected
                    </span>
                    <span className="text-sm text-gray-500">
                      Rejected at: {new Date(post.approved_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-800">{post.content}</p>
                  {post.approval_comment && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Rejection reason:</span> {post.approval_comment}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          {posts
            .filter(post => post.status === 'scheduled')
            .map((post) => (
              <div 
                key={post.id} 
                className="border rounded-lg p-4 mb-4 cursor-pointer hover:border-gray-400 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        Scheduled
                      </span>
                      <span className="text-sm text-gray-500">
                        Scheduled for: {new Date(post.scheduled_time).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-800">{post.content}</p>
                    
                    {post.platforms && Object.entries(post.platforms).length > 0 && (
                      <div className="flex gap-2">
                        {Object.entries(post.platforms).map(([platform, enabled]) => 
                          enabled && (
                            <span key={platform} className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {platform}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                  {renderPostActions(post)}
                </div>
              </div>
            ))}
          
          {posts.filter(post => post.status === 'scheduled').length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No scheduled posts
            </div>
          )}
        </TabsContent>

        <TabsContent value="drafts">
          {/* Drafts content */}
        </TabsContent>

        <TabsContent value="sent">
          {/* Sent content */}
        </TabsContent>
      </Tabs>

      <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
        <DialogContent className="max-w-6xl h-[80vh] p-0">
          <div className="flex h-full">
            <div className="flex-1 p-6 border-r overflow-y-auto">
              <div className="flex gap-2 mb-6">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => {
                      setNewPost(prev => ({
                        ...prev,
                        platforms: {
                          ...prev.platforms,
                          [account.id]: !prev.platforms[account.id]
                        }
                      }))
                    }}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      newPost.platforms[account.id] ? 'border-[#fb2e01] bg-[#fb2e01]/10' : 'border-gray-200'
                    }`}
                  >
                    <span>{account.screen_name}</span>
                  </button>
                ))}
              </div>

              <textarea
                value={newPost.content}
                onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                className="w-full h-32 p-3 border rounded-lg resize-none"
                placeholder="What would you like to share?"
              />

              <div className="mt-4">
                <input
                  type="datetime-local"
                  value={newPost.scheduledTime ? new Date(newPost.scheduledTime).toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  }).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+)/, '$3-$1-$2T$4:$5') : ''}
                  onChange={(e) => {
                    try {
                      // Create a date object from the input value
                      const selectedDate = new Date(e.target.value);
                      
                      // Validate the date
                      if (isNaN(selectedDate.getTime())) {
                        console.error('Invalid date selected');
                        return;
                      }

                      // Create an ISO string directly from the selected date
                      setNewPost(prev => ({
                        ...prev,
                        scheduledTime: selectedDate.toISOString()
                      }));
                    } catch (error) {
                      console.error('Error handling date:', error);
                    }
                  }}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div 
                className="mt-4 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer"
                onDrop={(e) => {
                  e.preventDefault();
                  handleMediaUpload(e);
                }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById('media-upload-input').click()}
              >
                <input
                  id="media-upload-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleMediaUpload}
                />
                <p>Drag & drop or click to upload media</p>
              </div>

              <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="requiresApproval"
                    checked={newPost.requiresApproval}
                    onChange={(e) => setNewPost(prev => ({
                      ...prev,
                      requiresApproval: e.target.checked,
                      approverId: e.target.checked ? prev.approverId : ''
                    }))}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="requiresApproval" className="text-sm font-medium">
                    Requires Approval
                  </label>
                </div>

                {newPost.requiresApproval && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">
                      Select Approver
                    </label>
                    <select
                      value={newPost.approverId}
                      onChange={(e) => setNewPost(prev => ({
                        ...prev,
                        approverId: e.target.value
                      }))}
                      className="w-full p-2 border rounded-lg"
                      required={newPost.requiresApproval}
                    >
                      <option value="">Select an approver</option>
                      {approvers.map((approver) => (
                        <option key={approver.id} value={approver.id}>
                          {approver.users.raw_user_meta_data?.full_name || approver.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="outline">
                  Save as Draft
                </Button>
                <div className="flex gap-2">
                  {!newPost.requiresApproval && (
                    <Button 
                      variant="outline" 
                      onClick={async (e) => {
                        e.preventDefault();
                        await setNewPost(prev => ({
                          ...prev,
                          scheduledTime: new Date().toISOString()
                        }));
                        handleSubmitPost(e);
                      }}
                    >
                      Post Now
                    </Button>
                  )}
                  <Button 
                    onClick={handleSubmitPost}
                    disabled={newPost.requiresApproval && !newPost.approverId}
                  >
                    {newPost.requiresApproval ? 'Send for Approval' : 'Schedule Post'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="w-[400px] p-6 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">Preview</h3>
              <div className="bg-white rounded-lg p-4 shadow">
                <p>{newPost.content}</p>
                {newPost.mediaFiles && newPost.mediaFiles.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {newPost.mediaFiles.map((file, index) => (
                      <div key={index} className="relative">
                        {file.type.startsWith('image/') ? (
                          <div className="relative">
                            <Image
                              src={file.url}
                              alt="Preview"
                              width={200}
                              height={200}
                              className="rounded-lg object-cover"
                            />
                            <button
                              onClick={() => handleRemoveMedia(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                              aria-label="Remove media"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <video
                              src={file.url}
                              className="rounded-lg w-full h-auto"
                              controls
                            />
                            <button
                              onClick={() => handleRemoveMedia(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                              aria-label="Remove media"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Post</DialogTitle>
          </DialogHeader>
          
          <div className="my-4">
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">{selectedPost?.content}</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Comments
              </label>
              <Textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="Add your review comments here..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => handleApprovalAction(false)}
              >
                Reject
              </Button>
              <Button
                variant="default"
                onClick={() => handleApprovalAction(true)}
              >
                Approve
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={postToEdit?.content || ''}
                onChange={(e) => setPostToEdit(prev => ({
                  ...prev,
                  content: e.target.value
                }))}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Schedule Time</label>
              <input
                type="datetime-local"
                value={postToEdit?.scheduled_time ? new Date(postToEdit.scheduled_time)
                  .toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  }).replace(/(\d+)\/(\d+)\/(\d+), (\d+):(\d+)/, '$3-$1-$2T$4:$5') : ''}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  setPostToEdit(prev => ({
                    ...prev,
                    scheduled_time: date.toISOString()
                  }));
                }}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            {/* Add Media Upload Section */}
            <div 
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer"
              onDrop={(e) => {
                e.preventDefault();
                handleMediaUpload(e);
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('edit-media-upload').click()}
            >
              <input
                id="edit-media-upload"
                type="file"
                multiple
                className="hidden"
                onChange={handleMediaUpload}
              />
              <p>Drag & drop or click to upload media</p>
            </div>

            {/* Show Media Preview */}
            {postToEdit?.mediaFiles && postToEdit.mediaFiles.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {postToEdit.mediaFiles.map((file, index) => (
                  <div key={index} className="relative">
                    {file.type?.startsWith('image/') ? (
                      <Image
                        src={file.url}
                        alt="Preview"
                        width={200}
                        height={200}
                        className="rounded-lg object-cover"
                      />
                    ) : (
                      <video
                        src={file.url}
                        className="rounded-lg"
                        controls
                      />
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => handleRemoveMedia(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Approval Section */}
            <div className="p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="requiresApproval"
                  checked={postToEdit?.requiresApproval}
                  onChange={(e) => setPostToEdit(prev => ({
                    ...prev,
                    requiresApproval: e.target.checked,
                    approverId: e.target.checked ? prev.approverId : ''
                  }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="requiresApproval" className="text-sm font-medium">
                  Requires Approval
                </label>
              </div>

              {postToEdit?.requiresApproval && (
                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">
                    Select Approver
                  </label>
                  <select
                    value={postToEdit.approverId}
                    onChange={(e) => setPostToEdit(prev => ({
                      ...prev,
                      approverId: e.target.value
                    }))}
                    className="w-full p-2 border rounded-lg"
                    required={postToEdit.requiresApproval}
                  >
                    <option value="">Select an approver</option>
                    {approvers.map((approver) => (
                      <option key={approver.id} value={approver.id}>
                        {approver.users.raw_user_meta_data?.full_name || approver.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditPost}
              disabled={postToEdit?.requiresApproval && !postToEdit.approverId}
            >
              {postToEdit?.requiresApproval ? 'Submit for Approval' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApprovalWorkflow
        post={selectedPost}
        isOpen={isPostDetailsOpen}
        onClose={() => setIsPostDetailsOpen(false)}
        onApprove={async (comment) => {
          await handleApprovalAction(true, comment);
        }}
        onReject={async (comment) => {
          await handleApprovalAction(false, comment);
        }}
        isApprover={isUserApprover}
      />
    </div>
  );
}