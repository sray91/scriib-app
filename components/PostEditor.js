import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileIcon, Trash2, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert.js';

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
    platforms: {},
    ...post
  });
  const [approvers, setApprovers] = useState([]);
  const [ghostwriters, setGhostwriters] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (currentUser) {
      fetchApprovers();
      fetchGhostwriters();
    }
  }, [currentUser]);

  async function fetchApprovers() {
    try {
      // Get all linked and active approvers for the current user
      const { data, error } = await supabase
        .from('ghostwriter_approver_link')
        .select(`
          id,
          approver_id,
          approver:approver_id(
            id,
            email,
            user_metadata
          )
        `)
        .eq('ghostwriter_id', currentUser.id)
        .eq('active', true);

      if (error) {
        console.error('Error fetching approvers:', error);
        // Silently set empty approvers rather than showing an error
        setApprovers([]);
        return;
      }
      
      // Transform the data
      const formattedApprovers = data
        .filter(item => item.approver) // Ensure approver exists
        .map(item => ({
          id: item.approver.id,
          email: item.approver.email,
          name: item.approver.user_metadata?.full_name || item.approver.email.split('@')[0]
        }));

      setApprovers(formattedApprovers);
    } catch (error) {
      console.error('Error fetching approvers:', error);
      // Silently set empty approvers rather than showing an error
      setApprovers([]);
    }
  }

  async function fetchGhostwriters() {
    try {
      // Get all linked and active ghostwriters for the current user
      const { data, error } = await supabase
        .from('ghostwriter_approver_link')
        .select(`
          id,
          ghostwriter_id,
          ghostwriter:ghostwriter_id(
            id,
            email,
            user_metadata
          )
        `)
        .eq('approver_id', currentUser.id)
        .eq('active', true);

      if (error) {
        console.error('Error fetching ghostwriters:', error);
        // Silently set empty ghostwriters rather than showing an error
        setGhostwriters([]);
        return;
      }
      
      // Transform the data
      const formattedGhostwriters = data
        .filter(item => item.ghostwriter) // Ensure ghostwriter exists
        .map(item => ({
          id: item.ghostwriter.id,
          email: item.ghostwriter.email,
          name: item.ghostwriter.user_metadata?.full_name || item.ghostwriter.email.split('@')[0]
        }));

      setGhostwriters(formattedGhostwriters);
    } catch (error) {
      console.error('Error fetching ghostwriters:', error);
      // Silently set empty ghostwriters rather than showing an error
      setGhostwriters([]);
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

  async function handleSavePost(e, actionType = 'draft') {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      
      if (!currentUser) {
        console.error('User not authenticated');
        setIsSaving(false);
        return;
      }
      
      // Determine post status based on action type
      let status, approver_id, ghostwriter_id;
      
      switch(actionType) {
        case 'draft':
          status = 'draft';
          approver_id = null;
          ghostwriter_id = null;
          break;
          
        case 'send_for_approval':
          status = 'pending_approval';
          approver_id = postData.approverId;
          ghostwriter_id = null;
          break;
          
        case 'send_to_ghostwriter':
          status = 'needs_edit';
          approver_id = null;
          ghostwriter_id = postData.ghostwriterId;
          break;
          
        case 'schedule':
          status = 'scheduled';
          approver_id = null;
          ghostwriter_id = null;
          break;
          
        default:
          status = 'draft';
          approver_id = null;
          ghostwriter_id = null;
      }
      
      // Prepare post data
      const postPayload = {
        content: postData.content,
        scheduled_time: postData.scheduledTime,
        status: status,
        platforms: postData.platforms || {},
        day_of_week: postData.day_of_week,
        template_id: postData.template_id,
        approver_id: approver_id,
        ghostwriter_id: ghostwriter_id,
        scheduled: status === 'scheduled',
        edited_at: new Date().toISOString()
      };
      
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
            description: "Failed to create post",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
        result = data;
      } else {
        // Update existing post
        const { data, error } = await supabase
          .from('posts')
          .update(postPayload)
          .eq('id', post.id)
          .select()
          .single();
          
        if (error) {
          console.error('Error updating post:', error);
          toast({
            title: "Error",
            description: "Failed to update post",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
        result = data;
      }
      
      // Handle media files if any
      if (postData.mediaFiles && postData.mediaFiles.length > 0) {
        // In a real app, you would upload the files to storage here
        // and then save the references in the database
        
        // For now, we'll just log that we would save the media
        console.log('Would save media files:', postData.mediaFiles);
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
  }

  // Determine if the current user is primarily a ghostwriter or approver for this post
  // by counting their relationships in each role
  const hasApprovers = approvers.length > 0;
  const hasGhostwriters = ghostwriters.length > 0;
  const isGhostwriter = hasApprovers && !hasGhostwriters;
  const isApprover = hasGhostwriters && !hasApprovers;
  const isBoth = hasGhostwriters && hasApprovers;
  const hasWorkflowOptions = hasApprovers || hasGhostwriters;

  // Add a function to handle deletion
  const handleDelete = (e) => {
    e.preventDefault();
    if (window.confirm("Are you sure you want to delete this post?")) {
      if (onDelete && post?.id) {
        onDelete(post.id);
      }
    }
  };

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

        {/* Platforms section */}
        <div className="mt-4">
          <Label className="block mb-2">Select platforms</Label>
          <div className="flex flex-wrap gap-3">
            {['linkedin', 'twitter', 'facebook', 'instagram'].map(platform => (
              <div key={platform} className="flex items-center gap-2">
                <Checkbox
                  id={`platform-${platform}`}
                  checked={postData.platforms?.[platform] || false}
                  onCheckedChange={(checked) => setPostData(prev => ({
                    ...prev,
                    platforms: {
                      ...(prev.platforms || {}),
                      [platform]: checked
                    }
                  }))}
                />
                <Label htmlFor={`platform-${platform}`} className="capitalize">
                  {platform}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Actions Section - Only show if there are workflow options */}
        {hasWorkflowOptions && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h3 className="font-medium mb-3">Post Workflow</h3>
            
            {/* Different actions based on user role and post status */}
            {isGhostwriter && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="requiresApproval"
                    checked={!!postData.approverId}
                    onCheckedChange={(checked) => setPostData(prev => ({
                      ...prev,
                      approverId: checked ? (approvers[0]?.id || '') : ''
                    }))}
                  />
                  <Label htmlFor="requiresApproval">
                    Send for approval
                  </Label>
                </div>

                {!!postData.approverId && (
                  <div className="ml-6">
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
            )}

            {isApprover && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="needsEdit"
                    checked={!!postData.ghostwriterId}
                    onCheckedChange={(checked) => setPostData(prev => ({
                      ...prev,
                      ghostwriterId: checked ? (ghostwriters[0]?.id || '') : ''
                    }))}
                  />
                  <Label htmlFor="needsEdit">
                    Send to ghostwriter for edits
                  </Label>
                </div>

                {!!postData.ghostwriterId && (
                  <div className="ml-6">
                    <Label htmlFor="ghostwriter" className="block mb-1">
                      Select Ghostwriter
                    </Label>
                    <select
                      id="ghostwriter"
                      value={postData.ghostwriterId}
                      onChange={(e) => setPostData(prev => ({
                        ...prev,
                        ghostwriterId: e.target.value
                      }))}
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="">Select a ghostwriter</option>
                      {ghostwriters.map((ghostwriter) => (
                        <option key={ghostwriter.id} value={ghostwriter.id}>
                          {ghostwriter.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            
            {isBoth && (
              <Tabs defaultValue="as_ghostwriter" className="w-full">
                <TabsList className="grid grid-cols-2 mb-2">
                  <TabsTrigger value="as_ghostwriter">As Ghostwriter</TabsTrigger>
                  <TabsTrigger value="as_approver">As Approver</TabsTrigger>
                </TabsList>
                
                <TabsContent value="as_ghostwriter" className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="requiresApproval"
                      checked={!!postData.approverId}
                      onCheckedChange={(checked) => setPostData(prev => ({
                        ...prev,
                        approverId: checked ? (approvers[0]?.id || '') : '',
                        ghostwriterId: ''
                      }))}
                    />
                    <Label htmlFor="requiresApproval">
                      Send for approval
                    </Label>
                  </div>

                  {!!postData.approverId && (
                    <div className="ml-6">
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
                </TabsContent>
                
                <TabsContent value="as_approver" className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="needsEdit"
                      checked={!!postData.ghostwriterId}
                      onCheckedChange={(checked) => setPostData(prev => ({
                        ...prev,
                        ghostwriterId: checked ? (ghostwriters[0]?.id || '') : '',
                        approverId: ''
                      }))}
                    />
                    <Label htmlFor="needsEdit">
                      Send to ghostwriter for edits
                    </Label>
                  </div>

                  {!!postData.ghostwriterId && (
                    <div className="ml-6">
                      <Label htmlFor="ghostwriter" className="block mb-1">
                        Select Ghostwriter
                      </Label>
                      <select
                        id="ghostwriter"
                        value={postData.ghostwriterId}
                        onChange={(e) => setPostData(prev => ({
                          ...prev,
                          ghostwriterId: e.target.value
                        }))}
                        className="w-full p-2 border rounded-lg"
                      >
                        <option value="">Select a ghostwriter</option>
                        {ghostwriters.map((ghostwriter) => (
                          <option key={ghostwriter.id} value={ghostwriter.id}>
                            {ghostwriter.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}

        <div className="flex justify-between items-center mt-6">
          <div className="flex gap-2">
            {!isNew && onDelete && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={isSaving}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete Post
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={(e) => handleSavePost(e, 'draft')}
              disabled={isSaving}
            >
              Save as Draft
            </Button>
          </div>
          
          <div>
            {postData.approverId && hasApprovers ? (
              <Button 
                onClick={(e) => handleSavePost(e, 'send_for_approval')}
                disabled={isSaving || !postData.approverId}
                className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
              >
                Send for Approval
              </Button>
            ) : postData.ghostwriterId && hasGhostwriters ? (
              <Button 
                onClick={(e) => handleSavePost(e, 'send_to_ghostwriter')}
                disabled={isSaving || !postData.ghostwriterId}
                className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
              >
                Send for Editing
              </Button>
            ) : (
              <Button 
                onClick={(e) => handleSavePost(e, 'schedule')}
                disabled={isSaving}
                className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
              >
                Schedule Post
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="w-[400px] p-6 bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">Preview</h3>
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="whitespace-pre-wrap">{postData.content || 'Your post will appear here...'}</p>
          
          {postData.platforms && Object.keys(postData.platforms).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(postData.platforms).map(([platform, isSelected]) => 
                isSelected && (
                  <span key={platform} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full capitalize">
                    {platform}
                  </span>
                )
              )}
            </div>
          )}
          
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
          </div>
        </div>
      </div>
    </div>
  );
} 