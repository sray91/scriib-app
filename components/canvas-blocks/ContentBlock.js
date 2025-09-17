import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Type, X } from 'lucide-react';
import { NodeResizer, Handle, Position } from 'reactflow';
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { CANVAS_SETTINGS } from '@/lib/constants/canvasConfig';

const ContentBlock = ({ data, id }) => {
  const [content, setContent] = useState('');
  const { session, updateDynamicContext } = useCanvasStore();
  
  const handleClose = () => {
    if (data.onClose) {
      data.onClose();
    } else {
      window.dispatchEvent(new CustomEvent('removeNode', { detail: { nodeId: id } }));
    }
  };
  
  const compileContent = () => {
    if (!session?.dynamicContext) return;
    
    const { ideas, hooks } = session.dynamicContext;
    let ideaContent = ideas?.[ideas.length - 1]?.content || '';
    const latestHook = hooks?.[hooks.length - 1]?.content || '';
    
    // Remove existing hooks from the idea content to prevent duplication
    // Look for common hook patterns at the beginning of content
    if (ideaContent && latestHook) {
      // Split content into lines and remove potential hook lines from the beginning
      const lines = ideaContent.split('\n');
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
      ideaContent = lines.slice(contentStartIndex).join('\n').trim();
    }
    
    const compiledContent = latestHook ? `${latestHook}\n\n${ideaContent}`.trim() : ideaContent;
    setContent(compiledContent);
    
    // Update session context
    updateDynamicContext({
      generatedContent: [...(session?.dynamicContext?.generatedContent || []), {
        id: `content-${Date.now()}`,
        content: compiledContent,
        source: 'content',
        blockId: id
      }]
    });
  };
  
  return (
    <>
      <NodeResizer
        minWidth={350}
        minHeight={250}
        isVisible={true}
        lineClassName="border-orange-500/30"
        handleClassName="w-3 h-3 bg-orange-500/80 hover:bg-orange-600 transition-all rounded-sm border border-white/50"
      />
      
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-orange-500 border-2 border-white shadow-md hover:bg-orange-600 transition-colors"
        style={{ left: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-orange-500 border-2 border-white shadow-md hover:bg-orange-600 transition-colors"
        style={{ right: -6 }}
      />
      
      <div className={`bg-white shadow-lg border-2 border-orange-200 w-full h-full overflow-auto flex flex-col`}>
      <div className="flex items-center gap-2 p-3 bg-orange-50 border-b">
        <Type className="h-5 w-5 text-orange-600" />
        <span className="font-medium text-orange-800">Content Editor</span>
        <button
          onClick={handleClose}
          className="ml-auto p-1 hover:bg-orange-100 rounded-full transition-colors"
          title="Close block"
        >
          <X className="h-4 w-4 text-orange-600" />
        </button>
      </div>
      
      <div className="p-4 flex-1 flex flex-col min-h-0">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Compiled content will appear here..."
          className="w-full flex-1 p-3 border rounded-md text-sm resize-none min-h-0"
        />
        
        <div className="flex gap-2 mt-4">
          <Button
            onClick={compileContent}
            className="flex-1"
            variant="outline"
          >
            Compile From Blocks
          </Button>
        </div>
      </div>
      </div>
    </>
  );
};

export default ContentBlock; 