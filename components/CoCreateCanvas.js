'use client';

import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider,
  Panel,
  ConnectionLineType,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play } from 'lucide-react';
import PostEditorDialog from '@/components/post-forge/PostEditorDialog';
import { useToast } from "@/components/ui/use-toast";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Import our refactored modules
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { nodeTypes } from '@/components/canvas-blocks';
import { 
  useCanvasNodes,
  useCanvasKeyboardShortcuts,
  useCanvasEvents,
  usePostCompilation
} from '@/lib/hooks/useCanvasOperations';
import { CANVAS_SETTINGS } from '@/lib/constants/canvasConfig';

// Main Canvas Component
const CoCreateCanvas = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const { initializeSession } = useCanvasStore();
  const { toast } = useToast();
  const supabase = createClientComponentClient();

  // Post Editor Dialog states
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isCreatingNewPost, setIsCreatingNewPost] = useState(false);

  // Track the last compiled post for re-editing
  const [lastCompiledPost, setLastCompiledPost] = useState(null);

  // User selection states
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState('ghostwriter');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // Use our custom hooks
  const { addNode, addConnectedBlock, removeNode } = useCanvasNodes(nodes, setNodes, edges, setEdges);

  // Custom compilation handler that opens the dialog instead of redirecting
  const { compilePost: originalCompilePost } = usePostCompilation();

  // Fetch users linked to current user
  const fetchAvailableUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check current user's role and get linked users
      const { data: asGhostwriter, error: gwError } = await supabase
        .from('ghostwriter_approver_link')
        .select('approver_id')
        .eq('ghostwriter_id', user.id)
        .eq('active', true);

      const { data: asApprover, error: appError } = await supabase
        .from('ghostwriter_approver_link')
        .select('ghostwriter_id')
        .eq('approver_id', user.id)
        .eq('active', true);

      if (gwError && appError) throw new Error('Failed to fetch user links');

      let linkedUserIds = [];
      let role = 'ghostwriter';

      if (asGhostwriter && asGhostwriter.length > 0) {
        linkedUserIds = asGhostwriter.map(link => link.approver_id);
        role = 'ghostwriter';
      } else if (asApprover && asApprover.length > 0) {
        linkedUserIds = asApprover.map(link => link.ghostwriter_id);
        role = 'approver';
      }

      setCurrentUserRole(role);

      // Always include current user as an option
      const allUserIds = [user.id, ...linkedUserIds];

      // Get user details - always include current user even if no linked users
      const { data: userDetails, error: userError } = await supabase
        .from('users_view')
        .select('id, email, raw_user_meta_data')
        .in('id', allUserIds);

      if (userError) {
        console.error('Error fetching user details:', userError);
        // Fallback: Create a basic profile for current user
        const fallbackProfiles = [{
          id: user.id,
          email: user.email,
          full_name: user.email.split('@')[0],
          role: 'current_user',
          isCurrentUser: true
        }];
        setAvailableUsers(fallbackProfiles);
        setSelectedUserId(user.id);
        setSelectedUser(fallbackProfiles[0]);
        return;
      }

      const userProfiles = userDetails.map(userDetail => {
        const userMetadata = userDetail.raw_user_meta_data || {};
        const isCurrentUser = userDetail.id === user.id;
        return {
          id: userDetail.id,
          email: userDetail.email,
          full_name: userMetadata.full_name || userMetadata.name || userDetail.email.split('@')[0],
          role: isCurrentUser ? 'current_user' : (role === 'ghostwriter' ? 'approver' : 'ghostwriter'),
          isCurrentUser
        };
      });

      setAvailableUsers(userProfiles);

      // Set current user as default selection
      setSelectedUserId(user.id);
      setSelectedUser(userProfiles.find(u => u.isCurrentUser));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available users',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleUserSelect = (userId) => {
    const user = availableUsers.find(u => u.id === userId);
    setSelectedUserId(userId);
    setSelectedUser(user);

    // Show toast to indicate context change
    if (user) {
      toast({
        title: 'Context Updated',
        description: `Now using ${user.isCurrentUser ? 'your own' : user.full_name + '\'s'} training data and voice`,
      });
    }
  };
  
  // Handle node selection
  const onSelectionChange = useCallback((elements) => {
    const nodeIds = elements.nodes.map(node => node.id);
    setSelectedNodes(nodeIds);
  }, []);
  
  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({
      ...params,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#3b82f6',
        width: 20,
        height: 20,
      },
    }, eds));
  }, [setEdges]);
  
  // Custom compilation function that opens the editor dialog
  const handleCompilePost = async () => {
    setIsLoading(true);
    
    const { session } = useCanvasStore.getState();
    
    // Check if we have content to compile
    const hasContent = session?.dynamicContext && (
      (session.dynamicContext.ideas?.length > 0) ||
      (session.dynamicContext.hooks?.length > 0) ||
      (session.dynamicContext.generatedContent?.length > 0)
    );
    
    // Check if we have ideation blocks on the canvas (even without generated content)
    const hasIdeationBlocks = nodes.some(node => node.type === 'ideationBlock');
    
    if (!hasContent && !hasIdeationBlocks && lastCompiledPost) {
      // No content to compile, but we have a last compiled post - open it for editing
      setSelectedPost(lastCompiledPost);
      setIsCreatingNewPost(false); // This is editing an existing post
      setIsPostEditorOpen(true);
      
      toast({
        title: "Opening last compiled post",
        description: "No new content to compile. Opening your previously compiled post for editing.",
      });
      
      setIsLoading(false);
      return;
    }
    
    // We need to create a custom compilation process that doesn't redirect
    // Instead, we'll compile the post and then open the editor dialog
    const success = await compilePostForDialog();
    
    setIsLoading(false);
  };
  
  // Custom compile function that returns post data instead of redirecting
  const compilePostForDialog = async () => {
    const { session, clearDynamicContext } = useCanvasStore.getState();
    
    if (!session?.dynamicContext) {
      toast({
        title: "No content to compile",
        description: "Create some content first",
        variant: "destructive",
      });
      return false;
    }
    
    const { ideas, hooks, visuals, generatedContent } = session.dynamicContext;
    
    // Check if we have any content to compile
    const hasContent = ideas?.length > 0 || hooks?.length > 0 || generatedContent?.length > 0;
    
    // Check if we have ideation blocks on the canvas
    const hasIdeationBlocks = nodes.some(node => node.type === 'ideationBlock');
    
    if (!hasContent && !hasIdeationBlocks) {
      toast({
        title: "No content to compile",
        description: "Add an ideation block or generate some content first",
        variant: "destructive",
      });
      return false;
    }
    
    // If we have ideation blocks but no generated content, create a basic post
    if (!hasContent && hasIdeationBlocks) {
      toast({
        title: "Creating basic post...",
        description: "No generated content found. Creating a basic post template.",
      });
      
      // Create a basic post template for the user to edit
      const basicPostContent = `Write your LinkedIn post here...

Consider including:
• A compelling hook to grab attention
• Your main message or insight  
• A call-to-action or question for engagement

#hashtags #linkedin #content`;

      // Create post object for the editor dialog
      const scheduleTime = new Date(new Date().setHours(12, 0, 0, 0));
      const postForEditing = {
        content: basicPostContent,
        scheduledTime: scheduleTime.toISOString(),
        status: 'draft',
        platforms: { linkedin: true },
        requiresApproval: false,
        approverId: '',
        ghostwriterId: '',
        mediaFiles: [],
        day_of_week: scheduleTime.toLocaleDateString('en-US', { weekday: 'long' }),
        canvas_session_id: session.sessionId,
        compiled_from_blocks: {
          ideation: 0,
          hooks: 0,
          visuals: 0,
          content: 0,
          session_id: session.sessionId,
          basic_template: true
        }
      };
      
      // Save this as the last compiled post for future reference
      setLastCompiledPost(postForEditing);
      
      // Open the editor dialog with the basic post template
      setSelectedPost(postForEditing);
      setIsCreatingNewPost(true);
      setIsPostEditorOpen(true);
      
      toast({
        title: "Basic post template created!",
        description: "Edit the template to create your post",
      });
      
      return true;
    }
    
    try {
      // Start compilation process
      toast({
        title: "Compiling post...",
        description: "Assembling content from connected blocks",
      });
      
      // Compile final post content (same logic as the original hook)
      let finalContent = '';
      
      // Get hook and main content
      const latestHook = hooks?.[hooks.length - 1];
      const latestIdea = ideas?.[ideas.length - 1];
      const latestGeneratedContent = generatedContent?.[generatedContent.length - 1];
      
      let mainContent = '';
      if (latestGeneratedContent) {
        mainContent = latestGeneratedContent.content;
      } else if (latestIdea) {
        mainContent = latestIdea.content;
      }
      
      // Remove existing hooks from main content to prevent duplication
      if (mainContent && latestHook) {
        const lines = mainContent.split('\n');
        let contentStartIndex = 0;
        
        // Skip lines that might be hooks (first few lines that look like hooks)
        for (let i = 0; i < Math.min(3, lines.length); i++) {
          const line = lines[i].trim();
          // If line looks like a hook (sentence that ends with punctuation and is standalone)
          if (line && 
              (line.length > 20 && line.length < 200) && // Reasonable hook length
              /[.!?]$/.test(line) && // Ends with punctuation
              !/^(But |However |Additionally |Furthermore |Moreover |Also |And |So |Then )/i.test(line) // Not a continuation
          ) {
            contentStartIndex = i + 1;
            // Skip empty lines after potential hook
            while (contentStartIndex < lines.length && !lines[contentStartIndex].trim()) {
              contentStartIndex++;
            }
          } else if (line) {
            // Found content that doesn't look like a hook, stop
            break;
          }
        }
        
        // Reconstruct content without the hook-like beginning
        mainContent = lines.slice(contentStartIndex).join('\n').trim();
      }
      
      // Add hook if available
      if (latestHook) {
        finalContent += latestHook.content.replace(/^Hook \d+: /, '') + '\n\n';
      }
      
      // Add main content
      if (mainContent) {
        finalContent += mainContent;
      }
      
      // Create post object for the editor dialog
      const scheduleTime = new Date(new Date().setHours(12, 0, 0, 0));
      const postForEditing = {
        content: finalContent.trim(),
        scheduledTime: scheduleTime.toISOString(),
        status: 'draft',
        platforms: { linkedin: true },
        requiresApproval: false,
        approverId: '',
        ghostwriterId: '',
        mediaFiles: visuals || [],
        day_of_week: scheduleTime.toLocaleDateString('en-US', { weekday: 'long' }),
        canvas_session_id: session.sessionId,
        compiled_from_blocks: {
          ideation: ideas?.length || 0,
          hooks: hooks?.length || 0,
          visuals: visuals?.length || 0,
          content: generatedContent?.length || 0,
          session_id: session.sessionId
        }
      };
      
      // Save this as the last compiled post for future reference
      setLastCompiledPost(postForEditing);
      
      // Open the editor dialog with the compiled post
      setSelectedPost(postForEditing);
      setIsCreatingNewPost(true);
      setIsPostEditorOpen(true);
      
      // Clear session context after successful compilation
      clearDynamicContext();
      
      toast({
        title: "Post compiled successfully!",
        description: "Opening post editor to review and schedule your post",
      });
      
      return true;
      
    } catch (error) {
      console.error('Compilation failed:', error);
      toast({
        title: "Compilation failed",
        description: error.message || "Failed to compile post",
        variant: "destructive",
      });
      return false;
    }
  };
  
  // Fetch available users on component mount
  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  // Initialize session and setup default ideation block
  useEffect(() => {
    initializeSession();

    // Add default ideation block
    const defaultIdeationBlock = {
      id: 'ideation-default',
      type: 'ideationBlock',
      position: CANVAS_SETTINGS.DEFAULT_NODE_POSITION,
      style: { width: 450, height: 400 },
      data: {
        label: 'ideation',
        onUpdate: (updates) => {
          setNodes(nds => nds.map(node =>
            node.id === 'ideation-default'
              ? { ...node, data: { ...node.data, ...updates } }
              : node
          ));
        },
        // No onClose function for the default ideation block
      },
    };

    setNodes([defaultIdeationBlock]);
  }, [initializeSession, setNodes]);
  
  // Update all nodes with current edges data when edges change
  useEffect(() => {
    setNodes(nds => nds.map(node => ({
      ...node,
      data: {
        ...node.data,
        edges: edges,
        nodes: nds
      }
    })));
  }, [edges, setNodes]);
  
  
  // Setup event listeners and keyboard shortcuts
  useCanvasKeyboardShortcuts(addNode, handleCompilePost, selectedNodes, setSelectedNodes, setNodes, isLoading);
  useCanvasEvents(addConnectedBlock, removeNode);
  
  // Helper function to get current day of week
  const getCurrentDayOfWeek = () => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const today = new Date();
    const dayIndex = today.getDay();
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Sunday becomes 6, Monday becomes 0, etc.
    return days[adjustedIndex];
  };

  // Handle post save from editor
  const handlePostSave = (savedPost) => {
    // Update the last compiled post with the saved version
    if (savedPost) {
      setLastCompiledPost(savedPost);
    }
    
    // Close the editor
    setIsPostEditorOpen(false);
    setSelectedPost(null);

    // Show success message
    toast({
      title: "Post saved successfully!",
      description: savedPost?.status === 'scheduled' 
        ? "Your post has been scheduled in Post Forge" 
        : "Your post has been saved as a draft",
    });
  };

  // Handle editor close
  const handleEditorClose = () => {
    setIsPostEditorOpen(false);
    setSelectedPost(null);
  };

  // Get dynamic button text based on current state
  const getCompileButtonText = () => {
    const { session } = useCanvasStore.getState();
    
    // Check if we have content to compile
    const hasContent = session?.dynamicContext && (
      (session.dynamicContext.ideas?.length > 0) ||
      (session.dynamicContext.hooks?.length > 0) ||
      (session.dynamicContext.generatedContent?.length > 0)
    );
    
    // Check if we have ideation blocks on the canvas
    const hasIdeationBlocks = nodes.some(node => node.type === 'ideationBlock');
    
    if (!hasContent && !hasIdeationBlocks && lastCompiledPost) {
      return 'Edit Last Post';
    }
    
    if (!hasContent && hasIdeationBlocks) {
      return 'Create Post';
    }
    
    return 'Compile Post';
  };
  
  return (
    <div className="w-full h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.05,
          minZoom: 1,
          maxZoom: 1
        }}
        multiSelectionKeyCode="Control"
        deleteKeyCode="Delete"
        selectNodesOnDrag={false}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5,5' }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#3b82f6',
          },
        }}
      >
        <MiniMap />
        <Background />
        
        {/* Controls Panel */}
        <Panel position="bottom-right" style={{ marginRight: '10px', marginBottom: '10px' }}>
          <Controls showZoom={true} showFitView={true} showInteractive={true} />
        </Panel>
        
        {/* Top Panel */}
        <Panel position="top-right" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
          <div className="flex gap-2">
            <Button 
              onClick={handleCompilePost} 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="h-4 w-4 mr-2" />
              {isLoading ? 'Compiling...' : getCompileButtonText()}
            </Button>
          </div>
        </Panel>
        
        {/* User Selection Panel - Clean Dropdown Only */}
        <Panel position="top-center" style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
          <Select value={selectedUserId || ''} onValueChange={handleUserSelect} disabled={isLoadingUsers}>
            <SelectTrigger className="w-[280px] h-11 border-0 bg-white/90 backdrop-blur-xl hover:bg-white/95 rounded-xl text-sm font-medium shadow-2xl shadow-black/10 transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:bg-white">
              <SelectValue
                placeholder={
                  isLoadingUsers
                    ? 'Loading...'
                    : availableUsers.length === 0
                      ? 'No users available'
                      : 'Choose voice context'
                }
              />
            </SelectTrigger>
            <SelectContent className="border-0 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl shadow-black/20 p-1">
              {availableUsers.map((user) => (
                <SelectItem
                  key={user.id}
                  value={user.id}
                  className="rounded-lg hover:bg-blue-50/80 focus:bg-blue-50/80 transition-all duration-150 cursor-pointer p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${user.isCurrentUser ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'} rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm`}>
                      {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {user.isCurrentUser ? 'Your Voice' : user.full_name}
                      </span>
                      <span className="text-xs text-gray-500 font-normal">
                        {user.isCurrentUser ? 'Personal training data' : `${user.role === 'approver' ? 'Approver' : 'Ghostwriter'} context`}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Panel>

        {/* Quick Add Panel */}
        <Panel position="top-left" style={{ position: 'fixed', top: '20px', left: '120px', zIndex: 1000 }}>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => addNode('ideation')}
              variant="outline"
              size="sm"
              className="bg-white/80 hover:bg-white border-blue-200 text-blue-700 hover:text-blue-800"
            >
              + Ideation
            </Button>
            {nodes.length > 1 && (
              <div className="text-xs text-gray-600 bg-white/90 p-2 rounded border max-w-48">
                💡 <strong>Tip:</strong> Drag from the blue dots on block edges to connect them visually!
              </div>
            )}
          </div>
        </Panel>
        

        

      </ReactFlow>
      
      {/* Post Editor Dialog */}
      <PostEditorDialog
        isOpen={isPostEditorOpen}
        onOpenChange={setIsPostEditorOpen}
        post={selectedPost}
        isNew={isCreatingNewPost}
        onSave={handlePostSave}
        onClose={handleEditorClose}
        onDelete={() => {
          // Handle delete if needed
          setIsPostEditorOpen(false);
          setSelectedPost(null);
        }}
      />
    </div>
  );
};

export default function CoCreateCanvasWrapper() {
  return (
    <ReactFlowProvider>
      <CoCreateCanvas />
    </ReactFlowProvider>
  );
} 