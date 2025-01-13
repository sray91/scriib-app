"use client";

// pages/content-scheduler.js
import { useState, useEffect } from 'react';
import { Calendar, Send } from 'lucide-react';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from "@/components/ui/use-toast";

const supabase = createClientComponentClient();

export default function ContentScheduler() {
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({
    content: '',
    platforms: {}, 
    scheduledTime: '',
    requiresApproval: false,
    approverId: '',
    mediaFiles: []
  });
  const [approvers, setApprovers] = useState([]);
  const [activeTab, setActiveTab] = useState('compose');
  const [deletingPosts, setDeletingPosts] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
    fetchPosts();
    fetchApprovers();
  }, []);

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
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('scheduled_time', { ascending: true });
      
    if (error) {
      console.error('Error fetching posts:', error);
      return;
    }
    setPosts(data);
  }

  async function fetchApprovers() {
    // Get current user first
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('users')
      .select('id, email')
      .neq('id', user.id);
      
    if (error) {
      console.error('Error fetching approvers:', error);
      return;
    }
    setApprovers(data);
  }

  async function handleMediaUpload(files) {
    const uploadedFiles = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${supabase.auth.user().id}/${fileName}`;
      
      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, file);
        
      if (error) {
        console.error('Error uploading file:', error);
        continue;
      }
      
      const { publicURL } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);
        
      uploadedFiles.push({
        path: filePath,
        type: file.type,
        url: publicURL
      });
    }
    
    setNewPost(prev => ({
      ...prev,
      mediaFiles: [...prev.mediaFiles, ...uploadedFiles]
    }));
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
    
    // Add platform validation
    const selectedPlatforms = Object.values(newPost.platforms).filter(Boolean);
    if (selectedPlatforms.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one platform to post to.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // First create the post
      const { data: createdPost, error: postError } = await supabase
        .from('posts')
        .insert([{
          content: newPost.content,
          platforms: newPost.platforms,
          scheduled_time: newPost.scheduledTime,
          approver_id: newPost.requiresApproval ? newPost.approverId : null,
          status: newPost.requiresApproval ? 'pending_approval' : 'scheduled'
        }])
        .select()
        .single();

      if (postError) {
        console.error('Error creating post:', postError);
        return;
      }

      // Store the post ID for later use
      const postId = createdPost.id;

      // If this is an immediate post, publish to selected platforms
      if (new Date(createdPost.scheduledTime) <= new Date()) {
        const linkedInAccounts = accounts.filter(
          account => account.platform === 'linkedin' && newPost.platforms[account.id]
        );

        for (const account of linkedInAccounts) {
          try {
            const response = await fetch('/api/post/linkedin', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: createdPost.content,
                accessToken: account.access_token,
                platformUserId: account.platform_user_id,
                mediaFiles: newPost.mediaFiles,
              }),
            });

            const responseData = await response.json();
            
            if (!response.ok) {
              // Handle duplicate post case
              if (response.status === 422 && responseData.isDuplicate) {
                // Add a small random string to make the content unique
                const uniqueContent = `${createdPost.content} ${Math.random().toString(36).substring(7)}`;
                
                // Try posting again with modified content
                const retryResponse = await fetch('/api/post/linkedin', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    content: uniqueContent,
                    accessToken: account.access_token,
                    platformUserId: account.platform_user_id,
                    mediaFiles: newPost.mediaFiles,
                  }),
                });

                if (!retryResponse.ok) {
                  throw new Error(responseData.error || `HTTP error! status: ${response.status}`);
                }
              } else {
                throw new Error(responseData.error || `HTTP error! status: ${response.status}`);
              }
            }

            // Update post status using the stored postId
            await supabase
              .from('posts')
              .update({ 
                status: 'published',
                published_content: createdPost.content
              })
              .eq('id', postId);

          } catch (error) {
            console.error('Detailed LinkedIn posting error:', error);
            await supabase
              .from('posts')
              .update({ 
                status: 'failed',
                error_message: error.message
              })
              .eq('id', postId);
          }
        }
      }

      // Handle media files
      if (newPost.mediaFiles.length > 0) {
        const { error: mediaError } = await supabase
          .from('media_files')
          .insert(
            newPost.mediaFiles.map(file => ({
              post_id: postId,
              file_path: file.path,
              file_type: file.type
            }))
          );

        if (mediaError) {
          console.error('Error saving media files:', mediaError);
          return;
        }
      }

      // Reset form
      setNewPost({
        content: '',
        platforms: {},
        scheduledTime: '',
        requiresApproval: false,
        approverId: '',
        mediaFiles: []
      });

      // Refresh posts list
      fetchPosts();

    } catch (error) {
      console.error('Error in handleSubmitPost:', error);
    }
  }

  async function handleDeletePost(postId) {
    try {
      if (!window.confirm('Are you sure you want to delete this post?')) {
        return;
      }

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

  return (
    <div className="max-w-6xl mx-auto p-4">
      <nav className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('compose')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'compose'
              ? 'bg-[#fb2e01] text-white'
              : 'bg-gray-100'
          }`}
        >
          Compose
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'scheduled'
              ? 'bg-[#fb2e01] text-white'
              : 'bg-gray-100'
          }`}
        >
          Scheduled
        </button>
      </nav>

      {activeTab === 'compose' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Create Post</h2>
            <button className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 flex items-center gap-1">
              Add Tags <span className="text-xs">▾</span>
            </button>
          </div>
          <form onSubmit={handleSubmitPost}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content
                </label>
                <div className="relative">
                  <textarea
                    value={newPost.content}
                    onChange={(e) =>
                      setNewPost({ ...newPost, content: e.target.value })
                    }
                    className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="What would you like to share?"
                  />
                  <div className="absolute bottom-3 right-3 text-sm text-gray-500">
                    {newPost.content.length}/3000
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platforms
                </label>
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <label key={account.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newPost.platforms[account.id] || false}
                        onChange={(e) =>
                          setNewPost({
                            ...newPost,
                            platforms: {
                              ...newPost.platforms,
                              [account.id]: e.target.checked,
                            },
                          })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>{account.screen_name} ({account.platform})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Schedule Time
                </label>
                <input
                  type="datetime-local"
                  value={newPost.scheduledTime}
                  onChange={(e) =>
                    setNewPost({ ...newPost, scheduledTime: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newPost.requiresApproval}
                    onChange={(e) =>
                      setNewPost({
                        ...newPost,
                        requiresApproval: e.target.checked,
                        approverId: e.target.checked ? newPost.approverId : '',
                      })
                    }
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Requires Approval
                  </span>
                </label>
              </div>

              {newPost.requiresApproval && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approver
                  </label>
                  <select
                    value={newPost.approverId}
                    onChange={(e) =>
                      setNewPost({ ...newPost, approverId: e.target.value })
                    }
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select an approver</option>
                    {approvers.map((approver) => (
                      <option key={approver.id} value={approver.id}>
                        {approver.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Schedule</span>
                </button>
                <button
                  type="button"
                  onClick={async (e) => {
                    try {
                      // Check if any platform is selected
                      const selectedPlatforms = Object.values(newPost.platforms).filter(Boolean);
                      if (selectedPlatforms.length === 0) {
                        toast({
                          title: "Error",
                          description: "Please select at least one platform to post to.",
                          variant: "destructive",
                        });
                        return;
                      }

                      const currentTime = new Date().toISOString().slice(0, 16);
                      // Create a new post object with the current time
                      const immediatePost = {
                        ...newPost,
                        scheduledTime: currentTime
                      };
                      
                      // First create the post
                      const { data: createdPost, error: postError } = await supabase
                        .from('posts')
                        .insert([{
                          content: immediatePost.content,
                          platforms: immediatePost.platforms,
                          scheduled_time: immediatePost.scheduledTime,
                          approver_id: immediatePost.requiresApproval ? immediatePost.approverId : null,
                          status: immediatePost.requiresApproval ? 'pending_approval' : 'scheduled'
                        }])
                        .select()
                        .single();

                      if (postError) {
                        console.error('Error creating post:', postError);
                        return;
                      }

                      // Immediately post to selected platforms
                      const linkedInAccounts = accounts.filter(
                        account => account.platform === 'linkedin' && immediatePost.platforms[account.id]
                      );
                      const twitterAccounts = accounts.filter(
                        account => account.platform === 'twitter' && immediatePost.platforms[account.id]
                      );

                      // Post to LinkedIn accounts
                      for (const account of linkedInAccounts) {
                        try {
                          const response = await fetch('/api/post/linkedin', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              content: createdPost.content,
                              accessToken: account.access_token,
                              platformUserId: account.platform_user_id,
                              mediaFiles: immediatePost.mediaFiles,
                            }),
                          });

                          const responseData = await response.json();
                          if (!response.ok) {
                            throw new Error(responseData.error || `HTTP error! status: ${response.status}`);
                          }

                          toast({
                            title: "Success!",
                            description: "Your post has been published.",
                            variant: "default",
                          });

                          // Update post status
                          await supabase
                            .from('posts')
                            .update({ 
                              status: 'published',
                              published_content: createdPost.content
                            })
                            .eq('id', createdPost.id);

                        } catch (error) {
                          console.error('Error posting to LinkedIn:', error);
                          await supabase
                            .from('posts')
                            .update({ 
                              status: 'failed',
                              error_message: error.message
                            })
                            .eq('id', createdPost.id);
                        }
                      }

                      // Add debug logging for selected accounts
                      console.log('Selected Twitter accounts:', twitterAccounts);

                      // Post to Twitter accounts
                      for (const account of twitterAccounts) {
                        try {
                          console.log('Attempting to post to Twitter with account:', account.screen_name);
                          
                          // Check if access token exists and is valid
                          if (!account.access_token) {
                            throw new Error('No access token available for Twitter account');
                          }

                          // Check if content is within Twitter's character limit
                          if (createdPost.content.length > 280) {
                            throw new Error('Tweet exceeds 280 character limit');
                          }
                          
                          const postData = {
                            content: createdPost.content,
                            accessToken: account.access_token,
                            mediaFiles: immediatePost.mediaFiles?.map(file => ({
                              url: supabase.storage.from('media').getPublicUrl(file.file_path).publicURL,
                              type: file.file_type
                            })) || [],
                          };
                          
                          console.log('Sending post data:', { 
                            ...postData, 
                            accessToken: '[REDACTED]',
                            content: postData.content.substring(0, 50) + '...' 
                          });

                          const response = await fetch('/api/post/twitter', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(postData),
                          });

                          if (!response.ok) {
                            const responseData = await response.json();
                            console.error('Twitter API error response:', responseData);
                            throw new Error(responseData.error || `HTTP error! status: ${response.status}`);
                          }

                          const responseData = await response.json();
                          console.log('Twitter API success response:', responseData);

                          toast({
                            title: "Success!",
                            description: "Your tweet has been published.",
                            variant: "default",
                          });

                          // Update post status
                          const { error: updateError } = await supabase
                            .from('posts')
                            .update({ 
                              status: 'published',
                              published_content: createdPost.content
                            })
                            .eq('id', createdPost.id);

                          if (updateError) {
                            console.error('Error updating post status:', updateError);
                          }

                        } catch (error) {
                          console.error('Detailed error posting to Twitter:', error);
                          toast({
                            title: "Error",
                            description: `Failed to post to Twitter: ${error.message}`,
                            variant: "destructive",
                          });

                          // Update post status with error
                          await supabase
                            .from('posts')
                            .update({ 
                              status: 'failed',
                              error_message: error.message
                            })
                            .eq('id', createdPost.id);
                        }
                      }

                      // Reset form
                      setNewPost({
                        content: '',
                        platforms: {},
                        scheduledTime: '',
                        requiresApproval: false,
                        approverId: '',
                        mediaFiles: []
                      });

                      // Refresh posts list
                      fetchPosts();

                    } catch (error) {
                      console.error('Error posting:', error);
                      toast({
                        title: "Error",
                        description: error.message || "Failed to create post",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Post Now</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'scheduled' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Scheduled Posts</h2>
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="border rounded p-4 space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="mb-2">{post.content}</p>
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(post.scheduled_time).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        post.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : post.status === 'pending_approval'
                          ? 'bg-yellow-100 text-yellow-800'
                          : post.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {post.status}
                    </span>
                    {(post.status === 'scheduled' || post.status === 'failed') && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this post?')) {
                            handleDeletePost(post.id);
                          }
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete post"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-5 w-5" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                
                {post.media_files && post.media_files.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {post.media_files.map((file, index) => (
                      <div key={index} className="relative">
                        {file.file_type.startsWith('image/') ? (
                          <Image
                            src={supabase.storage.from('media').getPublicUrl(file.file_path).publicURL}
                            alt="Post media"
                            width={500}
                            height={384}
                            className="w-full h-32 object-cover rounded"
                          />
                        ) : (
                          <video
                            src={supabase.storage.from('media').getPublicUrl(file.file_path).publicURL}
                            className="w-full h-32 object-cover rounded"
                            controls
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}