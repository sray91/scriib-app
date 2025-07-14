import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Fish, X } from 'lucide-react';
import { NodeResizer } from 'reactflow';
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { API_ENDPOINTS } from '@/lib/constants/canvasConfig';

const HookBlock = ({ data, id }) => {
  const [hooks, setHooks] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { session, updateDynamicContext, addToHistory } = useCanvasStore();
  
  const handleClose = () => {
    if (data.onClose) {
      data.onClose();
    } else {
      // Fallback: dispatch custom event
      window.dispatchEvent(new CustomEvent('removeNode', { detail: { nodeId: id } }));
    }
  };
  
  const generateHooks = async () => {
    if (!session?.dynamicContext?.ideas?.length) {
      toast({
        title: "No ideas found",
        description: "Connect to an ideation block first",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // Use the latest idea from connected ideation blocks
      const latestIdea = session.dynamicContext.ideas[session.dynamicContext.ideas.length - 1];
      
      const response = await fetch(API_ENDPOINTS.COCREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: `Create 3 compelling hooks for this content: ${latestIdea.content}`,
          action: 'create'
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Parse hooks from response (simplified)
        const generatedHooks = [
          { id: 1, text: "Hook 1: " + result.updatedPost.substring(0, 100) + "..." },
          { id: 2, text: "Hook 2: " + result.updatedPost.substring(100, 200) + "..." },
          { id: 3, text: "Hook 3: " + result.updatedPost.substring(200, 300) + "..." }
        ];
        
        setHooks(generatedHooks);
        
        // Update session context
        updateDynamicContext({
          hooks: [...(session?.dynamicContext?.hooks || []), ...generatedHooks.map(h => ({
            id: `hook-${Date.now()}-${h.id}`,
            content: h.text,
            source: 'hook',
            blockId: id
          }))]
        });
        
        toast({
          title: "Hooks generated!",
          description: "3 new hooks added to session context"
        });
      }
    } catch (error) {
      console.error('Error generating hooks:', error);
      toast({
        title: "Error",
        description: "Failed to generate hooks",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <>
      <NodeResizer
        minWidth={350}
        minHeight={200}
        isVisible={true}
        lineClassName="border-green-500/30"
        handleClassName="w-3 h-3 bg-green-500/80 hover:bg-green-600 transition-all rounded-sm border border-white/50"
      />
      <div className="bg-white shadow-lg border-2 border-green-200 w-full h-full overflow-auto flex flex-col">
      <div className="flex items-center gap-2 p-3 bg-green-50 border-b">
        <Fish className="h-5 w-5 text-green-600" />
        <span className="font-medium text-green-800">Hook Generator</span>
        <button
          onClick={handleClose}
          className="ml-auto p-1 hover:bg-green-100 rounded-full transition-colors"
          title="Close block"
        >
          <X className="h-4 w-4 text-green-600" />
        </button>
      </div>
      
      <div className="p-4 flex-1 flex flex-col min-h-0">
        <div className="space-y-3 mb-4">
          {hooks.map((hook) => (
            <div key={hook.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm text-green-800">{hook.text}</div>
            </div>
          ))}
          {hooks.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              No hooks generated yet
            </div>
          )}
        </div>
        
        <Button
          onClick={generateHooks}
          disabled={isGenerating}
          className="w-full"
          variant="outline"
        >
          {isGenerating ? 'Generating...' : 'Generate Hooks'}
        </Button>
      </div>
      </div>
    </>
  );
};

export default HookBlock; 