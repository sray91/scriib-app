import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, XCircle, Users, Edit, ExternalLink, FileIcon, Trash2, Upload } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from "@/components/ui/use-toast";
import Image from 'next/image';

// Media preview component for editing mode
function MediaPreview({ file, index, onRemove, onImageClick }) {
  const isBlobUrl = file.url?.startsWith('blob:');
  
  if (file.type?.startsWith('image/')) {
    return (
      <div className="relative h-[200px] w-full">
        <div 
          className="cursor-pointer w-full h-full relative"
          onClick={() => onImageClick && onImageClick(file.url)}
        >
          {isBlobUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.url}
              alt="Preview"
              className="rounded-lg object-cover w-full h-full hover:opacity-90 transition-opacity"
            />
          ) : (
            <Image
              src={file.url}
              alt="Preview"
              fill
              className="rounded-lg object-cover hover:opacity-90 transition-opacity"
              unoptimized={isBlobUrl}
            />
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 z-10 hover:bg-red-600"
          aria-label="Remove media"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }
  
  if (file.type?.startsWith('video/')) {
    return (
      <div className="relative h-[200px] w-full bg-black rounded-lg overflow-hidden">
        <video
          src={file.url}
          className="rounded-lg object-contain w-full h-full"
          controls
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 z-10 hover:bg-red-600"
          aria-label="Remove media"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }
  
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
        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
        aria-label="Remove media"
        type="button"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

const ApprovalWorkflow = ({ 
  post,
  isOpen,
  onClose,
  onApprove,
  onReject,
  isApprover 
}) => {
  const [approvalComment, setApprovalComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedMediaFiles, setEditedMediaFiles] = useState([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const supabase = createClientComponentClient();
  const { toast } = useToast();

  // Fetch existing media files for the post
  const fetchPostMedia = useCallback(async () => {
    if (!post?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('post_media')
        .select('media_urls')
        .eq('post_id', post.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching post media:', error);
        return;
      }
      
      if (data?.media_urls && data.media_urls.length > 0) {
        const mediaFiles = data.media_urls.map(url => ({
          url,
          type: url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' :
                url.toLowerCase().endsWith('.png') ? 'image/png' :
                url.toLowerCase().endsWith('.gif') ? 'image/gif' :
                url.toLowerCase().endsWith('.webp') ? 'image/webp' :
                url.toLowerCase().endsWith('.mp4') ? 'video/mp4' :
                url.toLowerCase().endsWith('.webm') ? 'video/webm' :
                url.toLowerCase().endsWith('.ogg') ? 'video/ogg' :
                url.toLowerCase().endsWith('.mov') ? 'video/quicktime' :
                url.toLowerCase().endsWith('.avi') ? 'video/x-msvideo' :
                'application/octet-stream',
          path: url.split('/').pop()
        }));
        setEditedMediaFiles(mediaFiles);
      } else {
        setEditedMediaFiles([]);
      }
    } catch (error) {
      console.error('Error in fetchPostMedia:', error);
    }
  }, [post?.id, supabase]);

  // Initialize editing state when post changes or dialog opens
  useEffect(() => {
    if (post && isOpen) {
      setEditedContent(post.content || '');
      setEditedMediaFiles([]); // Reset media files first
      fetchPostMedia();
    }
  }, [post, isOpen, fetchPostMedia]);

  // Handle media upload
  const handleMediaUpload = async (e) => {
    e.preventDefault();
    
    const files = e.dataTransfer ? 
      Array.from(e.dataTransfer.files) : 
      Array.from(e.target.files || []);
      
    if (!files || files.length === 0) return;
    
    try {
      toast({
        title: "Uploading",
        description: "Uploading your media files...",
      });
      
      const uploadedFiles = [];
      
      for (const file of files) {
        // Choose upload method based on file size to bypass Vercel 4.5MB limit
        const VERCEL_LIMIT = 4 * 1024 * 1024; // 4MB to be safe
        let response, data;
        
        if (file.size > VERCEL_LIMIT) {
          // Use direct upload to Supabase for large files
          console.log(`Using direct upload for large file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
          
          // Step 1: Get signed upload URL
          const urlResponse = await fetch('/api/posts/generate-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size
            })
          });
          
          if (!urlResponse.ok) {
            const urlError = await urlResponse.json().catch(() => ({}));
            throw new Error(urlError.error || 'Failed to get upload URL');
          }
          
          const urlData = await urlResponse.json();
          
          // Step 2: Upload directly to Supabase
          response = await fetch(urlData.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
          });
          
          if (!response.ok) {
            throw new Error(`Direct upload failed: ${response.status}`);
          }
          
          data = {
            success: true,
            fileName: urlData.fileName,
            filePath: urlData.publicUrl
          };
          
        } else {
          // Use existing server upload for smaller files
          console.log(`Using server upload for small file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
          
          const formData = new FormData();
          formData.append('file', file);
          
          response = await fetch('/api/posts/upload-media', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            if (response.status === 413) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `File "${file.name}" is too large.`);
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to upload ${file.name}`);
          }
          
          data = await response.json();
        }
        
        uploadedFiles.push({
          path: data.fileName,
          type: file.type,
          url: data.filePath,
          file: file
        });
      }
      
      setEditedMediaFiles(prev => [...prev, ...uploadedFiles]);
      
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
  };

  // Handle media removal
  const handleRemoveMedia = (index) => {
    setEditedMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Save edited content and media
  const saveEditedPost = async () => {
    try {
      // Update post content
      const { error: postError } = await supabase
        .from('posts')
        .update({
          content: editedContent,
          edited_at: new Date().toISOString()
        })
        .eq('id', post.id);
      
      if (postError) throw postError;
      
      // Update media files using API route (bypasses RLS)
      const mediaUrls = editedMediaFiles.map(file => file.url);
      
      const response = await fetch('/api/posts/save-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: post.id,
          mediaUrls: mediaUrls
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save media');
      }
      
      return true;
    } catch (error) {
      console.error('Error saving edited post:', error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleAction = async (isApproved) => {
    try {
      setIsSubmitting(true);
      
      // Save changes first
      const saveSuccess = await saveEditedPost();
      if (!saveSuccess) {
        setIsSubmitting(false);
        return;
      }
      
      await (isApproved ? onApprove : onReject)(approvalComment);
      setApprovalComment('');
      onClose();
    } catch (error) {
      console.error('Error processing approval action:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInstead = async () => {
    try {
      setIsSubmitting(true);
      
      // Save changes first
      const saveSuccess = await saveEditedPost();
      if (!saveSuccess) {
        setIsSubmitting(false);
        return;
      }
      
      // Update the post status to needs_edit and set it back to the ghostwriter
      const { error } = await supabase
        .from('posts')
        .update({
          status: 'needs_edit',
          approval_comment: approvalComment,
          edited_at: new Date().toISOString()
        })
        .eq('id', post.id);
      
      if (error) throw error;
      
      setApprovalComment('');
      onClose();
      
      // Refresh the page to show the updated status
      window.location.reload();
    } catch (error) {
      console.error('Error sending post back for edits:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    const statusConfig = {
      draft: {
        label: 'Draft',
        className: 'bg-gray-100 text-gray-800',
        icon: Edit
      },
      pending_approval: {
        label: 'Pending Review',
        className: 'bg-yellow-100 text-yellow-800',
        icon: AlertCircle
      },
      needs_edit: {
        label: 'Needs Edit',
        className: 'bg-blue-100 text-blue-800',
        icon: Edit
      },
      approved: {
        label: 'Approved',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle2
      },
      scheduled: {
        label: 'Scheduled',
        className: 'bg-purple-100 text-purple-800',
        icon: ExternalLink
      },
      rejected: {
        label: 'Rejected',
        className: 'bg-red-100 text-red-800',
        icon: XCircle
      }
    };

    const config = statusConfig[post?.status] || statusConfig.pending_approval;
    const Icon = config.icon;

    return (
      <Badge className={`flex items-center gap-1 ${config.className}`}>
        <Icon size={14} />
        {config.label}
      </Badge>
    );
  };

  if (!post) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            Review Post
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 my-4">
          {/* Save Changes Button */}
          {isApprover && post.status === 'pending_approval' && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={async () => {
                  const success = await saveEditedPost();
                  if (success) {
                    toast({
                      title: "Success",
                      description: "Changes saved successfully",
                    });
                  }
                }}
                disabled={isSubmitting}
                className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
              >
                Save Changes
              </Button>
            </div>
          )}

          {/* Post Content - Always Editable */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">
              Scheduled for: {new Date(post.scheduled_time).toLocaleString()}
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-content" className="text-sm font-medium">Post Content</Label>
                <Textarea
                  id="edit-content"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full h-32 mt-1 resize-none bg-white"
                  placeholder="Edit the post content..."
                />
              </div>
              
              {/* Media Upload Area */}
              <div>
                <Label className="text-sm font-medium">Media Files</Label>
                <div 
                  className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                  onDrop={(e) => {
                    e.preventDefault();
                    handleMediaUpload(e);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => document.getElementById('approval-media-upload').click()}
                >
                  <input
                    id="approval-media-upload"
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleMediaUpload}
                  />
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Drag & drop images/videos or click to upload
                  </p>
                </div>
              </div>
              
              {/* Media Preview */}
              {editedMediaFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {editedMediaFiles.map((file, index) => (
                    <MediaPreview 
                      key={index} 
                      file={file} 
                      index={index} 
                      onRemove={handleRemoveMedia}
                      onImageClick={setSelectedImageUrl}
                    />
                  ))}
                </div>
              )}
            </div>
            
            {post.platforms && (
              <div className="flex gap-2 mt-3">
                {Object.entries(post.platforms).map(([platform, enabled]) => 
                  enabled && (
                    <Badge key={platform} variant="secondary" className="text-xs capitalize">
                      {platform}
                    </Badge>
                  )
                )}
              </div>
            )}

            {post.user_id && (
              <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                <span>Created by: {post.creator_name || 'Unknown'}</span>
              </div>
            )}

            {isApprover && post.status === 'pending_approval' && (
              <div className="mt-2 text-xs text-gray-500">
                Tip: You can enable SMS reminders in Settings &gt; Profile.
              </div>
            )}
          </div>

          {/* Previous Approval Comments */}
          {post.approval_comment && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-1">
                Previous Review Comments
              </h4>
              <p className="text-sm text-blue-700">{post.approval_comment}</p>
            </div>
          )}

          {/* Approval Comment Input */}
          {isApprover && post.status === 'pending_approval' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Review Comments
                <span className="text-gray-500 ml-1">(optional)</span>
              </label>
              <Textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="Add your review comments..."
                rows={3}
                className="resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          {isApprover && post.status === 'pending_approval' ? (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleEditInstead}
                disabled={isSubmitting}
              >
                <Edit className="mr-2 h-4 w-4" />
                Send Back for Edits
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleAction(false)}
                disabled={isSubmitting}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Post
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleAction(true)}
                disabled={isSubmitting}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve Post
              </Button>
            </div>
          ) : (
            <Button onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
      
      {/* Image Modal */}
      {selectedImageUrl && (
        <Dialog open={!!selectedImageUrl} onOpenChange={() => setSelectedImageUrl(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-4">
            <div className="relative w-full h-[80vh] flex items-center justify-center bg-black rounded-lg">
              <Image
                src={selectedImageUrl}
                alt="Full size preview"
                width={800}
                height={600}
                className="max-w-full max-h-full object-contain rounded-lg"
                unoptimized
              />
              <button
                onClick={() => setSelectedImageUrl(null)}
                className="absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-opacity"
                aria-label="Close image"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};

export default ApprovalWorkflow;