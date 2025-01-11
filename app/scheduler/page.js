"use client";

// pages/content-scheduler.js
import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import Image from 'next/image';

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

  useEffect(() => {
    fetchAccounts();
    fetchPosts();
    fetchApprovers();
  }, []);

  async function fetchAccounts() {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', supabase.auth.user().id)
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
    const { data, error } = await supabase
      .from('users')
      .select('id, email')
      .neq('id', supabase.auth.user().id);
      
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

  async function handleCreatePost(e) {
    e.preventDefault();
    
    // First create the post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert([{
        content: newPost.content,
        platforms: newPost.platforms,
        scheduled_time: newPost.scheduledTime,
        approver_id: newPost.requiresApproval ? newPost.approverId : null,
        status: newPost.requiresApproval ? 'pending_approval' : 'scheduled'
      }])
      .single();

    if (postError) {
      console.error('Error creating post:', postError);
      return;
    }

    // Then create media file records
    if (newPost.mediaFiles.length > 0) {
      const { error: mediaError } = await supabase
        .from('media_files')
        .insert(
          newPost.mediaFiles.map(file => ({
            post_id: post.id,
            file_path: file.path,
            file_type: file.type
          }))
        );

      if (mediaError) {
        console.error('Error saving media files:', mediaError);
        return;
      }
    }

    setNewPost({
      content: '',
      platforms: {},
      scheduledTime: '',
      requiresApproval: false,
      approverId: '',
      mediaFiles: []
    });
    fetchPosts();
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
          <form onSubmit={handleCreatePost}>
            <div className="mb-4">
              <label className="block mb-2">Content</label>
              <div className="relative">
                <textarea
                  value={newPost.content}
                  onChange={(e) =>
                    setNewPost({ ...newPost, content: e.target.value })
                  }
                  placeholder="Start writing or use the AI Assistant"
                  className="w-full h-32 p-2 border rounded resize-none"
                  required
                />
                <button className="absolute top-2 right-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <span role="img" aria-label="sparkles">✨</span>
                  Use the AI Assistant
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block mb-2">Media</label>
              <div className="space-y-4">
                <input
                  type="file"
                  onChange={(e) => handleMediaUpload(Array.from(e.target.files))}
                  multiple
                  accept="image/*,video/*"
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {newPost.mediaFiles.map((file, index) => (
                    <div key={index} className="relative">
                      {file.type.startsWith('image/') ? (
                        <Image
                          src={file.url}
                          alt="Upload preview"
                          width={500}
                          height={384}
                          className="w-full h-32 object-cover rounded"
                        />
                      ) : (
                        <video
                          src={file.url}
                          className="w-full h-32 object-cover rounded"
                          controls
                        />
                      )}
                      <button
                        onClick={() => handleRemoveMedia(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1
                          hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex gap-2 items-center">
                {accounts.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    No social accounts connected. Please add accounts in Settings.
                  </div>
                ) : (
                  accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => {
                        setNewPost({
                          ...newPost,
                          platforms: {
                            ...newPost.platforms,
                            [account.id]: !newPost.platforms[account.id]
                          }
                        });
                      }}
                      className={`relative w-12 h-12 rounded-full border-2 transition-all ${
                        newPost.platforms[account.id]
                          ? 'border-orange-600 shadow-md'
                          : 'border-gray-200 opacity-50'
                      }`}
                    >
                      <div className="w-full h-full rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                        {account.platform === 'linkedin' ? (
                          <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.47,2H3.53A1.45,1.45,0,0,0,2.06,3.43V20.57A1.45,1.45,0,0,0,3.53,22H20.47a1.45,1.45,0,0,0,1.47-1.43V3.43A1.45,1.45,0,0,0,20.47,2ZM8.09,18.74h-3v-9h3ZM6.59,8.48h0a1.56,1.56,0,1,1,0-3.12,1.57,1.57,0,1,1,0,3.12ZM18.91,18.74h-3V13.91c0-1.21-.43-2-1.52-2A1.65,1.65,0,0,0,12.85,13a2,2,0,0,0-.1.73v5h-3s0-8.18,0-9h3V11A3,3,0,0,1,15.46,9.5c2,0,3.45,1.29,3.45,4.06Z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        )}
                      </div>
                      {newPost.platforms[account.id] && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-600 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block mb-2">Schedule Time</label>
              <input
                type="datetime-local"
                value={newPost.scheduledTime}
                onChange={(e) =>
                  setNewPost({ ...newPost, scheduledTime: e.target.value })
                }
                className="p-2 border rounded"
                required
              />
            </div>

            <div className="mb-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newPost.requiresApproval}
                  onChange={(e) =>
                    setNewPost({
                      ...newPost,
                      requiresApproval: e.target.checked,
                      approverId: e.target.checked ? newPost.approverId : ''
                    })
                  }
                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span>Requires Approval</span>
              </label>
            </div>

            {newPost.requiresApproval && (
              <div className="mb-4">
                <label className="block mb-2">Approver</label>
                <select
                  value={newPost.approverId}
                  onChange={(e) =>
                    setNewPost({ ...newPost, approverId: e.target.value })
                  }
                  className="p-2 border rounded"
                  required={newPost.requiresApproval}
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

            <button
              type="submit"
              className="bg-[#fb2e01] text-white px-4 py-2 rounded hover:bg-orange-500"
            >
              {newPost.requiresApproval ? 'Submit for Approval' : 'Schedule Post'}
            </button>
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
                <div className="flex items-center">
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      post.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : post.status === 'pending_approval'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}