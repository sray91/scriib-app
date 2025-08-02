import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { FileIcon, Trash2, AlertCircle, Users, Send } from 'lucide-react';
import Image from 'next/image';
import { Input } from "@/components/ui/input";

import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const supabase = createClientComponentClient();

// Media preview component
function MediaPreview({ file, index, onRemove }) {
  // For blob URLs, we need to use regular img tag
  const isBlobUrl = file.url?.startsWith('blob:');
  
  if (file.type?.startsWith('image/')) {
    return (
      <div className="relative h-[200px] w-full">
        {isBlobUrl ? (
          // Use regular img tag for blob URLs
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt="Preview"
            className="rounded-lg object-cover w-full h-full"
          />
        ) : (
          // Use Next.js Image for remote URLs
          <Image
            src={file.url}
            alt="Preview"
            fill
            className="rounded-lg object-cover"
            unoptimized={isBlobUrl}
          />
        )}
        <button
          onClick={() => onRemove(index)}
          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 z-10"
          aria-label="Remove media"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }
  
  // Generic file preview
  return (
    <div className="relative p-4 border rounded-lg">
      <div className="flex items-center gap-2">
        <FileIcon className="h-6 w-6 text-blue-500" />
        <span className="text-sm truncate">
          {file.file?.name || file.path || 'File'}
        </span>
      </div>
      <button
        onClick={() => onRemove(index)}
        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
        aria-label="Remove media"
        type="button"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function PostEditor({ post, isNew, onSave, onClose, onDelete }) {
  const { toast } = useToast();
  const [postData, setPostData] = useState({
    content: '',
    scheduledTime: new Date().toISOString(),
    requiresApproval: false,
    approverId: '',
    ghostwriterId: '',
    needsEdit: false,
    mediaFiles: [],
    day_of_week: '',
    template_id: null,
    status: 'draft',
    ...post
  });
  const [approvers, setApprovers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        setCurrentUser(user);
      } catch (error) {
        console.error('Error fetching current user:', error);
        setError('Failed to authenticate user.');
      }
    };

    fetchCurrentUser();
  }, []);

  const fetchApprovers = useCallback(async () => {
    try {
      // Get all linked and active approvers for the current user
      const { data, error } = await supabase
        .from('ghostwriter_approver_link')
        .select(`
          id,
          approver_id,
          active
        `)
        .eq('ghostwriter_id', currentUser.id)
        .eq('active', true);

      if (error) {
        console.error('Error fetching approvers:', error);
        // Silently set empty approvers rather than showing an error
        setApprovers([]);
        return;
      }
      
      // Get approver details in a separate query
      if (data && data.length > 0) {
        const approverIds = data.map(link => link.approver_id);
        
        const { data: approverDetails, error: approverError } = await supabase
          .from('users_view')
          .select('id, email, raw_user_meta_data')
          .in('id', approverIds);
        
        if (approverError) {
          console.error('Error fetching approver details:', approverError);
          setApprovers([]);
          return;
        }
        
        // Transform the data
        const formattedApprovers = data.map(link => {
          const approverInfo = approverDetails?.find(a => a.id === link.approver_id) || {};
          const userMetadata = approverInfo.raw_user_meta_data || {};
          
          return {
            id: approverInfo.id || link.approver_id,
            email: approverInfo.email || 'Unknown email',
            name: userMetadata.full_name || userMetadata.name || (approverInfo.email ? approverInfo.email.split('@')[0] : 'Unknown user')
          };
        }).filter(item => item.id); // Ensure approver exists
        
        setApprovers(formattedApprovers);
      } else {
        setApprovers([]);
      }
    } catch (error) {
      console.error('Error fetching approvers:', error);
      // Silently set empty approvers rather than showing an error
      setApprovers([]);
    }
  }, [currentUser]);

  // Function to fetch media files associated with a post
  const fetchPostMedia = useCallback(async (postId) => {
    try {
      const { data, error } = await supabase
        .from('post_media')
        .select('media_urls')
        .eq('post_id', postId)
        .single();
      
      if (error) {
        console.error('Error fetching post media:', error);
        return;
      }
      
      if (data && data.media_urls && data.media_urls.length > 0) {
        // Convert URLs to mediaFiles format expected by the component
        const mediaFiles = data.media_urls.map(url => ({
          url,
          type: url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' :
                url.toLowerCase().endsWith('.png') ? 'image/png' :
                url.toLowerCase().endsWith('.gif') ? 'image/gif' :
                url.toLowerCase().endsWith('.webp') ? 'image/webp' :
                'application/octet-stream',
          path: url.split('/').pop()
        }));
        
        setPostData(prev => ({
          ...prev,
          mediaFiles
        }));
      }
    } catch (fetchError) {
      console.error('Error in fetchPostMedia:', fetchError);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchApprovers();
      
      // If editing an existing post, fetch its media files
      if (!isNew && post?.id) {
        fetchPostMedia(post.id);
      }
    }
  }, [currentUser, isNew, post?.id, fetchApprovers, fetchPostMedia]);

  const handleMediaUpload = useCallback(async (e) => {
    e.preventDefault();
    
    // Get files from either drop event or file input
    const files = e.dataTransfer ? 
      Array.from(e.dataTransfer.files) : 
      Array.from(e.target.files || []);
      
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    try {
      // Show loading toast
      toast({
        title: "Uploading",
        description: "Uploading your media files...",
      });
      
      const uploadedFiles = [];
      
      // Upload each file to Supabase storage
      for (const file of files) {
        const uniqueId = Math.random().toString(36).substring(2);
        const fileName = `${uniqueId}-${file.name}`;
        
        // Create a FormData object to send the file
        const formData = new FormData();
        formData.append('file', file);
        
        // Upload the file to storage via API
        const response = await fetch('/api/posts/upload-media', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        
        const data = await response.json();
        
        // Add the file to our local state with the storage URL
        uploadedFiles.push({
          path: data.fileName,
          type: file.type,
          url: data.filePath, // Use the returned URL from storage
          file: file
        });
      }
      
      // Update state with new media files
      setPostData(prev => ({
        ...prev,
        mediaFiles: [...(prev.mediaFiles || []), ...uploadedFiles]
      }));
      
      // Success toast
      toast({
        title: "Success",
        description: `${uploadedFiles.length} file(s) uploaded successfully`,
      });
      
    } catch (error) {
      console.error('Error in handleMediaUpload:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload media files",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleRemoveMedia = useCallback((index) => {
    setPostData(prev => {
      const updatedMediaFiles = [...(prev.mediaFiles || [])];
      updatedMediaFiles.splice(index, 1);
      return {
        ...prev,
        mediaFiles: updatedMediaFiles
      };
    });
  }, []);

  const handleSavePost = useCallback(async (e, actionType = 'draft') => {
    if (e) e.preventDefault();
    
    try {
      setIsSaving(true);
      
      if (!currentUser) {
        console.error('User not authenticated');
        setIsSaving(false);
        toast({
          title: "Error",
          description: "You must be logged in to save a post",
          variant: "destructive",
        });
        return;
      }
      
      // Special handling for saving changes without changing status
      if (actionType === 'save_changes' && !isNew) {
        // Just update content and other fields without changing status
        const postPayload = {
          content: postData.content,
          scheduled_time: postData.scheduledTime,
          approver_id: postData.approverId || null,
          ghostwriter_id: postData.ghostwriterId || null,
          day_of_week: postData.day_of_week || null,
          template_id: postData.template_id || null,
          edited_at: new Date().toISOString(),
          user_id: post?.user_id || currentUser.id
        };
        
        try {
          const { data, error } = await supabase
            .from('posts')
            .update(postPayload)
            .eq('id', post.id)
            .select()
            .single();
            
          if (error) {
            console.error('Error updating post:', error);
            throw error;
          }
          
          // Handle media files using API route for consistent permissions (always call to ensure cleanup)
          try {
            const mediaUrls = postData.mediaFiles ? postData.mediaFiles.map(file => file.url) : [];
            
            const response = await fetch('/api/posts/save-media', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                postId: data.id,
                mediaUrls: mediaUrls
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              console.error('Error saving media:', errorData.error || 'Failed to save media');
            }
          } catch (mediaError) {
            console.error('Error processing media:', mediaError);
          }
          
          toast({
            title: "Success",
            description: "Changes saved successfully",
          });
          
          if (onSave) onSave(data);
          if (onClose) onClose();
          return;
        } catch (updateError) {
          console.error('Error updating post:', updateError);
          toast({
            title: "Error",
            description: `Failed to save changes: ${updateError.message}`,
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      }
      
      // Special handling for scheduling posts
      if (actionType === 'schedule') {
        try {
          console.log('Using dedicated scheduling endpoint...');
          const scheduleResponse = await fetch('/api/posts/schedule', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: post.id,
              scheduledTime: postData.scheduledTime,
              dayOfWeek: postData.day_of_week
            }),
          });
          
          if (!scheduleResponse.ok) {
            const errorData = await scheduleResponse.json();
            throw new Error(errorData.error || 'Failed to schedule post');
          }
          
          const scheduledPost = await scheduleResponse.json();
          
          toast({
            title: "Success",
            description: "Post scheduled successfully",
          });
          
          // Call the onSave callback to update the parent component
          if (onSave) onSave(scheduledPost);
          
          // Close the editor
          if (onClose) onClose();
          
          setIsSaving(false);
          return;
        } catch (scheduleError) {
          console.error('Error scheduling post:', scheduleError);
          
          // Continue with normal flow as fallback
          console.log('Falling back to standard update for scheduling...');
        }
      }
      
      // Determine post status based on action type
      let status, ghostwriter_id;
      
      switch(actionType) {
        case 'draft':
          status = 'draft';
          ghostwriter_id = null;
          break;
          
        case 'send_for_approval':
          status = 'pending_approval';
          ghostwriter_id = null;
          break;
          
        case 'send_to_ghostwriter':
          status = 'needs_edit';
          ghostwriter_id = postData.ghostwriterId;
          
          // Validate ghostwriter_id is present when sending to ghostwriter
          if (!ghostwriter_id) {
            toast({
              title: "Error",
              description: "Please select a ghostwriter before sending for edits",
              variant: "destructive",
            });
            setIsSaving(false);
            return;
          }
          break;
          
        case 'schedule':
          status = 'scheduled';
          ghostwriter_id = null;
          break;
          
        default:
          status = 'draft';
          ghostwriter_id = null;
      }
      
      // Always use the selected approver regardless of the action type
      const approver_id = postData.approverId || null;
      
      // Prepare post data
      const postPayload = {
        content: postData.content,
        scheduled_time: postData.scheduledTime,
        status: status,
        day_of_week: postData.day_of_week || null,
        template_id: postData.template_id || null,
        approver_id: approver_id,
        ghostwriter_id: ghostwriter_id,
        scheduled: status === 'scheduled',
        edited_at: new Date().toISOString(),
        // Always include the user_id when updating to satisfy RLS policies
        user_id: post?.user_id || currentUser.id
      };
      
      console.log('Saving post with payload:', postPayload);
      
      let result;
      
      if (isNew) {
        // Create new post
        const { data, error } = await supabase
          .from('posts')
          .insert({
            ...postPayload,
            user_id: currentUser.id
          })
          .select()
          .single();
          
        if (error) {
          console.error('Error creating post:', error);
          toast({
            title: "Error",
            description: `Failed to create post: ${error.message}`,
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
        result = data;
      } else {
        // Try to update existing post directly
        try {
          const { data, error } = await supabase
            .from('posts')
            .update(postPayload)
            .eq('id', post.id)
            .select()
            .single();
            
          if (error) {
            console.error('Error updating post:', error);
            throw error;
          }
          result = data;
        } catch (updateError) {
          console.error('Error updating post:', updateError);
          
          // If we hit an RLS error, try updating with the server API routes
          if (updateError.message?.includes('security policy') || updateError.message?.includes('violates row-level security')) {
            toast({
              title: "Using server update",
              description: "Using server-side method to update post...",
              duration: 2000,
            });
            
            // Try first with the main endpoint, then the alternative if that fails
            try {
              // First try the normal update API route
              console.log('Trying main update endpoint...');
              const response = await fetch('/api/posts/update', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  id: post.id,
                  post: postPayload
                }),
              });
              
              if (!response.ok) {
                // If that fails, try the alternative endpoint
                console.log('Main endpoint failed, trying alternative...');
                const altResponse = await fetch('/api/posts/update-alt', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    id: post.id,
                    post: postPayload
                  }),
                });
                
                if (!altResponse.ok) {
                  const errorData = await altResponse.json();
                  throw new Error(errorData.error || 'Failed to update post via alternative API');
                }
                
                result = await altResponse.json();
              } else {
                result = await response.json();
              }
              
            } catch (apiError) {
              console.error('Error updating via API:', apiError);
              toast({
                title: "Error",
                description: `Failed to update post: ${apiError.message || 'Unknown error'}`,
                variant: "destructive",
              });
              setIsSaving(false);
              return;
            }
          } else {
            toast({
              title: "Error",
              description: `Failed to update post: ${updateError.message || 'Unknown error'}`,
              variant: "destructive",
            });
            setIsSaving(false);
            return;
          }
        }
      }
      
      // Handle media files (always call API to ensure proper cleanup if files were removed)
      try {
        // Extract the URLs or paths from the media files (empty array if no files)
        const mediaUrls = postData.mediaFiles ? postData.mediaFiles.map(file => file.url) : [];
        
        // Use the save-media API route for consistent permissions (bypasses RLS)
        const response = await fetch('/api/posts/save-media', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            postId: result.id,
            mediaUrls: mediaUrls
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error saving media:', errorData.error || 'Failed to save media');
        }
      } catch (mediaError) {
        console.error('Error processing media:', mediaError);
      }
      
      // Set appropriate success message
      let successMessage;
      switch(actionType) {
        case 'draft':
          successMessage = "Post saved as draft";
          break;
        case 'send_for_approval':
          successMessage = "Post sent for approval";
          break;
        case 'send_to_ghostwriter':
          successMessage = "Post sent to ghostwriter for editing";
          break;
        case 'schedule':
          successMessage = "Post scheduled successfully";
          break;
        default:
          successMessage = "Post saved successfully";
      }
      
      toast({
        title: "Success",
        description: successMessage,
      });
      
      // Call the onSave callback to update the parent component
      if (onSave) onSave(result);
      
      // Close the editor
      if (onClose) onClose();
      
    } catch (error) {
      console.error('Error saving post:', error);
      
      // Show a user-friendly error message
      toast({
        title: "Error",
        description: "There was a problem saving your post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentUser, isNew, post, postData, toast, onSave, onClose]);

  // Keep approvers list for the approval dialog
  const hasApprovers = approvers.length > 0;

  // Add a function to handle deletion
  const handleDelete = useCallback((e) => {
    e.preventDefault();
    
    if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      if (onDelete && typeof onDelete === 'function') {
        if (post?.id) {
          onDelete(post.id);
        } else {
          onDelete();
        }
      } else {
        console.warn('Delete handler not provided');
        toast({
          title: "Error",
          description: "Delete functionality is not available in this context",
          variant: "destructive",
        });
      }
    }
  }, [onDelete, post?.id, toast]);

  // Handle sending for approval
  const handleSendForApproval = useCallback(async () => {
    try {
      setIsSaving(true);
      
      // Update post data with approval comment if provided
      if (approvalComment.trim()) {
        setPostData(prev => ({
          ...prev,
          approval_comment: approvalComment.trim()
        }));
      }
      
      // Save the post and send for approval
      await handleSavePost(null, 'send_for_approval');
      
      setShowApprovalDialog(false);
      setApprovalComment('');
      
      toast({
        title: "Success",
        description: "Post sent for approval successfully",
      });
    } catch (error) {
      console.error('Error sending for approval:', error);
      toast({
        title: "Error",
        description: "Failed to send post for approval",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [approvalComment, setPostData, handleSavePost, setShowApprovalDialog, setApprovalComment, toast]);

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 border-r overflow-y-auto">
        {/* Status indicator for existing posts */}
        {!isNew && postData.status && (
          <div className="mb-4 p-3 bg-gray-50 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  postData.status === 'draft' ? 'bg-gray-200' :
                  postData.status === 'pending_approval' ? 'bg-yellow-200 text-yellow-800' :
                  postData.status === 'approved' ? 'bg-green-200 text-green-800' :
                  postData.status === 'scheduled' ? 'bg-blue-200 text-blue-800' :
                  postData.status === 'rejected' ? 'bg-red-200 text-red-800' :
                  postData.status === 'needs_edit' ? 'bg-indigo-200 text-indigo-800' :
                  'bg-gray-200'
                }`}>
                  {postData.status === 'pending_approval' ? 'Pending Approval' : 
                   postData.status === 'needs_edit' ? 'Needs Edit' : 
                   postData.status.charAt(0).toUpperCase() + postData.status.slice(1)}
                </span>
              </div>
              
              {/* Show approver info if post is in approval process */}
              {postData.approverId && (
                <div className="text-sm text-gray-600">
                  <span className="mr-1">Approver:</span>
                  <span className="font-medium">
                    {approvers.find(a => a.id === postData.approverId)?.name || 'Selected approver'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <Textarea
          value={postData.content}
          onChange={(e) => setPostData(prev => ({ ...prev, content: e.target.value }))}
          className="w-full h-32 p-3 border rounded-lg resize-none"
          placeholder="What would you like to share?"
        />

        <div className="mt-4">
          <Label htmlFor="scheduled-time">Schedule for</Label>
          <Input
            id="scheduled-time"
            type="datetime-local"
            value={postData.scheduledTime ? new Date(postData.scheduledTime).toISOString().slice(0, 16) : ''}
            onChange={(e) => {
              try {
                const selectedDate = new Date(e.target.value);
                if (isNaN(selectedDate.getTime())) return;
                setPostData(prev => ({
                  ...prev,
                  scheduledTime: selectedDate.toISOString()
                }));
              } catch (error) {
                console.error('Error handling date:', error);
              }
            }}
            className="w-full p-2 border rounded-lg mt-1"
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

        <div className="flex justify-between items-center mt-6">
          <div className="flex gap-2">
            {!isNew && onDelete && typeof onDelete === 'function' && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={isSaving}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete Post
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            {hasApprovers && (
              <Button 
                variant="outline"
                onClick={() => setShowApprovalDialog(true)}
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                Send for Approval
              </Button>
            )}
            <Button 
              onClick={(e) => handleSavePost(e, 'schedule')}
              disabled={isSaving}
              className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
            >
              Save Post
            </Button>
          </div>
        </div>
      </div>

      <div className="w-[400px] p-6 bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">Preview</h3>
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="whitespace-pre-wrap">{postData.content || 'Your post will appear here...'}</p>
          
          {postData.mediaFiles && postData.mediaFiles.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {postData.mediaFiles.map((file, index) => (
                <MediaPreview 
                  key={index} 
                  file={file} 
                  index={index} 
                  onRemove={handleRemoveMedia} 
                />
              ))}
            </div>
          )}
          
          <div className="mt-4 text-sm text-gray-500">
            {postData.scheduledTime && (
              <div className="flex justify-between border-t pt-2 mt-2">
                <span>Scheduled for:</span>
                <span className="font-medium">
                  {new Date(postData.scheduledTime).toLocaleString()}
                </span>
              </div>
            )}
            
            {postData.approverId && (
              <div className="flex justify-between border-t pt-2 mt-2">
                <span>For approval by:</span>
                <span className="font-medium">
                  {approvers.find(a => a.id === postData.approverId)?.name || 'Selected approver'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Dialog */}
      {showApprovalDialog && (
        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Send for Approval</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4 my-4">
              {/* Post Content Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2">
                  Scheduled for: {new Date(postData.scheduledTime).toLocaleString()}
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{postData.content || 'No content yet...'}</p>
                
                {/* Show media files if any */}
                {postData.mediaFiles && postData.mediaFiles.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {postData.mediaFiles.map((file, index) => (
                      <div key={index} className="relative h-[200px] w-full">
                        <Image
                          src={file.url}
                          alt="Post media"
                          fill
                          className="rounded-lg object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {postData.user_id && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>Created by: {currentUser?.email?.split('@')[0] || 'You'}</span>
                  </div>
                )}
              </div>

              {/* Approver Selection */}
              <div>
                <Label htmlFor="post-approver" className="block mb-2">Select Approver</Label>
                <select
                  id="post-approver"
                  value={postData.approverId || ''}
                  onChange={(e) => setPostData(prev => ({
                    ...prev,
                    approverId: e.target.value
                  }))}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">Select an approver</option>
                  {approvers.map((approver) => (
                    <option key={approver.id} value={approver.id}>
                      {approver.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Comment */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Additional Notes <span className="text-gray-500">(optional)</span>
                </Label>
                <Textarea
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="Add any notes for the approver..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            <DialogFooter className="flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowApprovalDialog(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendForApproval}
                disabled={isSaving || !postData.approverId}
                className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
              >
                <Send className="mr-2 h-4 w-4" />
                Send for Approval
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 