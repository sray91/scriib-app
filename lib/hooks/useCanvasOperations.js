import { useCallback, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { createClient } from '@supabase/supabase-js';
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { 
  KEYBOARD_SHORTCUTS, 
  API_ENDPOINTS, 
  CANVAS_SETTINGS,
  CANVAS_EVENTS,
  SESSION_CONFIG
} from '@/lib/constants/canvasConfig';

// Hook for managing canvas nodes
export const useCanvasNodes = (nodes, setNodes, edges, setEdges) => {
  const addNode = useCallback((type) => {
    const nodeId = `${type}-${Date.now()}`;
    const newNode = {
      id: nodeId,
      type: `${type}Block`,
      position: { 
        x: Math.random() * 400, 
        y: Math.random() * 400 
      },
      data: { 
        label: type,
        onUpdate: (updates) => {
          setNodes(nds => nds.map(node => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, ...updates } }
              : node
          ));
        },
        onClose: type !== 'ideation' ? () => removeNode(nodeId) : undefined
      },
    };
    
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const addConnectedBlock = useCallback((type, sourceId) => {
    const sourceNode = nodes.find(node => node.id === sourceId);
    const sourcePosition = sourceNode ? sourceNode.position : CANVAS_SETTINGS.DEFAULT_NODE_POSITION;
    
    const nodeId = `${type}-${Date.now()}`;
    const newNode = {
      id: nodeId,
      type: `${type}Block`,
      position: { 
        x: sourcePosition.x + CANVAS_SETTINGS.CONNECTED_NODE_OFFSET.x, 
        y: sourcePosition.y + (Math.random() - 0.5) * 200 
      },
      data: { 
        label: type,
        onUpdate: (updates) => {
          setNodes(nds => nds.map(node => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, ...updates } }
              : node
          ));
        },
        onClose: () => removeNode(nodeId)
      },
    };
    
    setNodes((nds) => nds.concat(newNode));
    
    // Create connection from source to new node
    const newEdge = {
      id: `${sourceId}-${nodeId}`,
      source: sourceId,
      target: nodeId,
      type: 'default',
      animated: true,
    };
    
    setEdges((eds) => eds.concat(newEdge));
  }, [nodes, setNodes, setEdges]);

  const removeNode = useCallback((nodeId) => {
    setNodes(nds => nds.filter(node => node.id !== nodeId));
    setEdges(eds => eds.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

  return { addNode, addConnectedBlock, removeNode };
};

// Hook for keyboard shortcuts
export const useCanvasKeyboardShortcuts = (addNode, compilePost, selectedNodes, setSelectedNodes, setNodes, isLoading) => {
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger shortcuts if user is typing in an input field
      const activeElement = document.activeElement;
      const isInputField = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.contentEditable === 'true'
      );
      
      // Delete selected nodes
      if (KEYBOARD_SHORTCUTS.DELETE_NODE.includes(e.key) && !isInputField) {
        if (selectedNodes.length > 0) {
          // Prevent deletion of the default ideation block
          const deletableNodes = selectedNodes.filter(nodeId => nodeId !== 'ideation-default');
          if (deletableNodes.length > 0) {
            setNodes(nds => nds.filter(node => !deletableNodes.includes(node.id)));
            setSelectedNodes([]);
          }
        }
      }
      
      // Quick add shortcuts
      if ((e.ctrlKey || e.metaKey) && !isInputField) {
        switch (e.key) {
          case KEYBOARD_SHORTCUTS.ADD_IDEATION:
            e.preventDefault();
            addNode('ideation');
            break;
          case KEYBOARD_SHORTCUTS.ADD_HOOK:
            e.preventDefault();
            addNode('hook');
            break;
          case KEYBOARD_SHORTCUTS.ADD_VISUAL:
            e.preventDefault();
            addNode('visual');
            break;
          case KEYBOARD_SHORTCUTS.ADD_CONTENT:
            e.preventDefault();
            addNode('content');
            break;
          case KEYBOARD_SHORTCUTS.COMPILE_POST:
            e.preventDefault();
            if (!isLoading && compilePost) {
              compilePost();
            }
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedNodes, isLoading, addNode, compilePost, setNodes, setSelectedNodes]);
};

// Hook for canvas events (inter-block communication)
export const useCanvasEvents = (addConnectedBlock, removeNode) => {
  useEffect(() => {
    const handleAddConnectedBlock = (event) => {
      const { blockType, sourceId } = event.detail;
      addConnectedBlock(blockType, sourceId);
    };
    
    const handleRemoveNode = (event) => {
      const { nodeId } = event.detail;
      removeNode(nodeId);
    };
    
    window.addEventListener(CANVAS_EVENTS.ADD_CONNECTED_BLOCK, handleAddConnectedBlock);
    window.addEventListener(CANVAS_EVENTS.REMOVE_NODE, handleRemoveNode);
    return () => {
      window.removeEventListener(CANVAS_EVENTS.ADD_CONNECTED_BLOCK, handleAddConnectedBlock);
      window.removeEventListener(CANVAS_EVENTS.REMOVE_NODE, handleRemoveNode);
    };
  }, [addConnectedBlock, removeNode]);
};

// Hook for post compilation
export const usePostCompilation = () => {
  const { toast } = useToast();
  const { session, clearDynamicContext } = useCanvasStore();

  const compilePost = useCallback(async () => {
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
    if (!hasContent) {
      toast({
        title: "No content to compile",
        description: "Generate some content in the blocks first",
        variant: "destructive",
      });
      return false;
    }
    
    try {
      // Start compilation process
      toast({
        title: "Compiling post...",
        description: "Assembling content from connected blocks",
      });
      
      // Compile final post content
      let finalContent = '';
      
      // Add hook if available
      const latestHook = hooks?.[hooks.length - 1];
      if (latestHook) {
        finalContent += latestHook.content.replace(/^Hook \d+: /, '') + '\n\n';
      }
      
      // Add main content
      const latestIdea = ideas?.[ideas.length - 1];
      const latestGeneratedContent = generatedContent?.[generatedContent.length - 1];
      
      if (latestGeneratedContent) {
        finalContent += latestGeneratedContent.content;
      } else if (latestIdea) {
        finalContent += latestIdea.content;
      }
      
      // Prepare post data for Post Forge
      const scheduleTime = new Date(Date.now() + SESSION_CONFIG.DEFAULT_SCHEDULE_DELAY_HOURS * 60 * 60 * 1000);
      const postData = {
        content: finalContent.trim(),
        scheduled_time: scheduleTime.toISOString(),
        day_of_week: scheduleTime.toLocaleDateString('en-US', { weekday: 'long' }),
        status: 'draft',
        platforms: { linkedin: true },
        scheduled: false,
        approver_id: null,
        ghostwriter_id: null,
        created_at: new Date().toISOString(),
        canvas_session_id: session.sessionId,
        compiled_from_blocks: {
          ideation: ideas?.length || 0,
          hooks: hooks?.length || 0,
          visuals: visuals?.length || 0,
          content: generatedContent?.length || 0,
          session_id: session.sessionId
        }
      };
      
      // Try to save to Post Forge database
      const success = await savePostToDatabase(postData, visuals, toast);
      
      if (success) {
        // Clear session context after successful compilation
        clearDynamicContext();
        
        toast({
          title: "Post compiled successfully!",
          description: "Your post has been saved to Post Forge",
        });
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Compilation failed:', error);
      toast({
        title: "Compilation failed",
        description: error.message || "Failed to save post to Post Forge",
        variant: "destructive",
      });
      return false;
    }
  }, [session, clearDynamicContext, toast]);

  return { compilePost };
};

// Helper function to save post to database
const savePostToDatabase = async (postData, visuals, toast) => {
  try {
    // Try main API endpoint first
    const response = await fetch(API_ENDPOINTS.POSTS_CREATE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });
    
    if (response.ok) {
      return true;
    }
    
    // Fallback to direct Supabase insertion
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData.user) {
      throw new Error('Please log in to save posts');
    }
    
    const { data: savedPost, error } = await supabase
      .from('posts')
      .insert({
        content: postData.content,
        scheduled_time: postData.scheduled_time,
        day_of_week: postData.day_of_week,
        status: postData.status,
        scheduled: postData.scheduled,
        user_id: userData.user.id,
        created_at: postData.created_at
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Handle media files if we have visuals
    const latestVisual = visuals?.[visuals.length - 1];
    if (latestVisual && savedPost) {
      try {
        await supabase
          .from('post_media')
          .insert({
            post_id: savedPost.id,
            media_urls: [latestVisual.url],
            created_at: new Date().toISOString()
          });
      } catch (mediaError) {
        console.warn('Failed to save media:', mediaError);
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('Failed to save post:', error);
    throw error;
  }
}; 