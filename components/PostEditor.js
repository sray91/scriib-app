import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileIcon, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Input } from "@/components/ui/input";

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
  } else if (file.type?.startsWith('video/')) {
    return (
      <div className="relative">
        <video
          src={file.url}
          className="rounded-lg w-full h-auto"
          controls
        />
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
  } else {
    return (
      <div className="relative flex items-center justify-center bg-gray-100 rounded-lg p-4">
        <FileIcon className="h-8 w-8 text-gray-500" />
        <span className="ml-2 text-sm">{file.path?.split('/').pop() || 'File'}</span>
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
}

export default function PostEditor({ post, isNew, onSave, onClose }) {
  const { toast } = useToast();
  const [postData, setPostData] = useState({
    content: '',
    scheduledTime: new Date().toISOString(),
    requiresApproval: false,
    approverId: '',
    mediaFiles: [],
    day_of_week: '',
    template_id: null,
    ...post
  });
  const [approvers, setApprovers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchApprovers();
  }, []);

  async function fetchApprovers() {
    try {
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

      if (error) throw error;
      
      // Transform the data to match your component's needs
      const formattedApprovers = data
        .filter(item => item.users) // Ensure user exists
        .map(item => ({
          id: item.users.id,
          email: item.users.email,
          name: item.users.raw_user_meta_data?.full_name || item.users.email
        }));

      setApprovers(formattedApprovers);
    } catch (error) {
      console.error('Error fetching approvers:', error);
      toast({
        title: "Error",
        description: "Failed to load approvers list",
        variant: "destructive",
      });
    }
  }

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
    
    try {
      // Show loading toast
      toast({
        title: "Uploading",
        description: "Uploading your media files...",
      });
      
      // Create mock URLs for the files (in a real app, you'd upload to storage)
      const uploadedFiles = files.map(file => ({
        path: `mock-${Math.random().toString(36).substring(2)}`,
        type: file.type,
        url: URL.createObjectURL(file),
        file: file // Store the actual file for later use if needed
      }));
      
      // Update state with new media files
      setPostData(prev => ({
        ...prev,
        mediaFiles: [...(prev.mediaFiles || []), ...uploadedFiles]
      }));
      
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

  function handleRemoveMedia(index) {
    setPostData(prev => {
      const updatedMediaFiles = [...(prev.mediaFiles || [])];
      updatedMediaFiles.splice(index, 1);
      return {
        ...prev,
        mediaFiles: updatedMediaFiles
      };
    });
  }

  async function handleSavePost(e, isDraft = false) {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Determine post status
      const status = isDraft 
        ? 'draft' 
        : postData.requiresApproval 
          ? 'pending_approval' 
          : 'scheduled';
      
      // Prepare post data
      const postPayload = {
        content: postData.content,
        scheduled_time: postData.scheduledTime,
        status: status,
        platforms: postData.platforms || {},
        day_of_week: postData.day_of_week,
        template_id: postData.template_id,
        approver_id: postData.requiresApproval ? postData.approverId : null,
        requires_approval: postData.requiresApproval
      };
      
      let result;
      
      if (isNew) {
        // Create new post
        const { data, error } = await supabase
          .from('posts')
          .insert(postPayload)
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      } else {
        // Update existing post
        const { data, error } = await supabase
          .from('posts')
          .update(postPayload)
          .eq('id', post.id)
          .select()
          .single();
          
        if (error) throw error;
        result = data;
      }
      
      // Handle media files if any
      if (postData.mediaFiles && postData.mediaFiles.length > 0) {
        // In a real app, you would upload the files to storage here
        // and then save the references in the database
        
        // For now, we'll just log that we would save the media
        console.log('Would save media files:', postData.mediaFiles);
      }
      
      toast({
        title: "Success",
        description: isDraft 
          ? "Post saved as draft" 
          : postData.requiresApproval 
            ? "Post sent for approval" 
            : "Post scheduled successfully",
      });
      
      // Call the onSave callback to update the parent component
      if (onSave) onSave(result);
      
      // Close the editor
      if (onClose) onClose();
      
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save post",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 border-r overflow-y-auto">
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

        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center gap-2 mb-4">
            <Checkbox
              id="requiresApproval"
              checked={postData.requiresApproval}
              onCheckedChange={(checked) => setPostData(prev => ({
                ...prev,
                requiresApproval: checked,
                approverId: checked ? prev.approverId : ''
              }))}
            />
            <Label htmlFor="requiresApproval">
              Requires Approval
            </Label>
          </div>

          {postData.requiresApproval && (
            <div className="mt-2">
              <Label htmlFor="approver" className="block mb-1">
                Select Approver
              </Label>
              <select
                id="approver"
                value={postData.approverId}
                onChange={(e) => setPostData(prev => ({
                  ...prev,
                  approverId: e.target.value
                }))}
                className="w-full p-2 border rounded-lg"
                required={postData.requiresApproval}
              >
                <option value="">Select an approver</option>
                {approvers.map((approver) => (
                  <option key={approver.id} value={approver.id}>
                    {approver.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-6">
          <Button 
            variant="outline" 
            onClick={(e) => handleSavePost(e, true)}
            disabled={isSaving}
          >
            Save as Draft
          </Button>
          <Button 
            onClick={(e) => handleSavePost(e, false)}
            disabled={isSaving || (postData.requiresApproval && !postData.approverId)}
            className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
          >
            {postData.requiresApproval 
              ? 'Send for Approval' 
              : 'Schedule Post'}
          </Button>
        </div>
      </div>

      <div className="w-[400px] p-6 bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">Preview</h3>
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="whitespace-pre-wrap">{postData.content}</p>
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
        </div>
      </div>
    </div>
  );
} 