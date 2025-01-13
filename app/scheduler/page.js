"use client";

// pages/content-scheduler.js
import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Send, List, Grid } from 'lucide-react';
import Image from 'next/image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from "@/components/ui/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
    
    // Platform validation
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
      // Log the data being sent
      console.log('Attempting to create post with data:', {
        content: newPost.content,
        platforms: newPost.platforms,
        scheduled_time: newPost.scheduledTime,
        approver_id: newPost.requiresApproval ? newPost.approverId : null,
        status: newPost.requiresApproval ? 'pending_approval' : 'scheduled'
      });

      // Create the post
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
        console.error('Detailed post error:', postError);
        toast({
          title: "Error",
          description: `Failed to create post: ${postError.message}`,
          variant: "destructive",
        });
        return;
      }

      // If this is an immediate post, publish to selected platforms
      if (new Date(createdPost.scheduled_time) <= new Date()) {
        // Handle LinkedIn posts
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
              if (response.status === 422 && responseData.isDuplicate) {
                const uniqueContent = `${createdPost.content} ${Math.random().toString(36).substring(7)}`;
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
                  throw new Error('Failed to post to LinkedIn after retry');
                }
              } else {
                throw new Error('Failed to post to LinkedIn');
              }
            }
          } catch (error) {
            console.error('LinkedIn posting error:', error);
            toast({
              title: "Error",
              description: `Failed to post to LinkedIn: ${error.message}`,
              variant: "destructive",
            });
          }
        }

        // Handle Twitter posts
        const twitterAccounts = accounts.filter(
          account => account.platform === 'twitter' && newPost.platforms[account.id]
        );

        for (const account of twitterAccounts) {
          try {
            const response = await fetch('/api/post/twitter', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: createdPost.content,
                accessToken: account.access_token,
                mediaFiles: newPost.mediaFiles,
              }),
            });

            if (!response.ok) {
              throw new Error('Failed to post to Twitter');
            }
          } catch (error) {
            console.error('Twitter posting error:', error);
            toast({
              title: "Error",
              description: `Failed to post to Twitter: ${error.message}`,
              variant: "destructive",
            });
          }
        }
      }

      // Success toast
      toast({
        title: "Success",
        description: new Date(createdPost.scheduled_time) <= new Date()
          ? "Post published successfully!"
          : "Post scheduled successfully!",
      });

      // Reset form and close dialog
      setNewPost({
        content: '',
        platforms: {},
        scheduledTime: '',
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

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">All Channels</h1>
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">New</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-8">
            <button className="text-sm font-medium border-b-2 border-[#fb2e01] text-[#fb2e01] pb-2">
              Queue <span className="ml-1 bg-gray-100 px-1.5 rounded">0</span>
            </button>
            <button className="text-sm font-medium text-gray-600">
              Drafts <span className="ml-1 bg-gray-100 px-1.5 rounded">0</span>
            </button>
            <button className="text-sm font-medium text-gray-600">
              Approvals <span className="ml-1 bg-purple-100 text-purple-800 px-1.5 rounded">4</span>
            </button>
            <button className="text-sm font-medium text-gray-600">
              Sent <span className="ml-1 bg-gray-100 px-1.5 rounded">486</span>
            </button>
          </div>
          <Button 
            onClick={() => setIsCreatePostOpen(true)}
            className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
          >
            + New Post
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            onClick={() => setView('list')}
            size="sm"
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
          <Button
            variant={view === 'calendar' ? 'default' : 'outline'}
            onClick={() => setView('calendar')}
            size="sm"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Calendar
          </Button>
        </div>
        <div className="flex gap-4">
          <select className="px-3 py-2 border rounded-lg">
            <option>Channels ▾</option>
          </select>
          <select className="px-3 py-2 border rounded-lg">
            <option>Tags ▾</option>
          </select>
          <select className="px-3 py-2 border rounded-lg">
            <option>New York ▾</option>
          </select>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="h-8 w-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No posts scheduled</h3>
          <p className="text-gray-500 mb-4">Schedule some posts and they will appear here</p>
          <Button onClick={() => setIsCreatePostOpen(true)}>
            + New Post
          </Button>
        </div>
      ) : view === 'list' ? (
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
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    {new Date(post.scheduled_time).toLocaleString('en-US', { 
                      timeZone: 'America/New_York'
                    })}
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
      ) : (
        <div className="bg-white rounded-lg border p-6">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border"
          />
          <div className="mt-4">
            <h3 className="font-medium mb-2">Posts for {selectedDate?.toLocaleDateString()}</h3>
            {posts
              .filter(post => 
                new Date(post.scheduled_time).toDateString() === selectedDate?.toDateString()
              )
              .map(post => (
                <div
                  key={post.id}
                  className="border rounded p-4 space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="mb-2">{post.content}</p>
                      <div className="flex items-center text-sm text-gray-500">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        {new Date(post.scheduled_time).toLocaleString('en-US', { 
                          timeZone: 'America/New_York'
                        })}
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
                  value={newPost.scheduledTime ? new Date(newPost.scheduledTime).toISOString().slice(0, 16) : ''}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setNewPost(prev => ({
                      ...prev,
                      scheduledTime: date.toISOString()  // Direct ISO string
                    }));
                  }}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div 
                className="mt-4 border-2 border-dashed rounded-lg p-4 text-center"
                onDrop={handleMediaUpload}
                onDragOver={(e) => e.preventDefault()}
              >
                <p>Drag & drop or click to upload media</p>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="outline">
                  Save as Draft
                </Button>
                <div className="flex gap-2">
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
                  <Button onClick={handleSubmitPost}>
                    Schedule Post
                  </Button>
                </div>
              </div>
            </div>

            <div className="w-[400px] p-6 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">Preview</h3>
              <div className="bg-white rounded-lg p-4 shadow">
                <p>{newPost.content}</p>
                {newPost.mediaFiles.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {newPost.mediaFiles.map((file, index) => (
                      <div key={index} className="relative">
                        {file.type.startsWith('image/') ? (
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}