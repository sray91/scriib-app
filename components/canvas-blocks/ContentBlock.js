import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Type, X } from 'lucide-react';
import { NodeResizer } from 'reactflow';
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
    const latestIdea = ideas?.[ideas.length - 1]?.content || '';
    const latestHook = hooks?.[hooks.length - 1]?.content || '';
    
    const compiledContent = `${latestHook}\n\n${latestIdea}`;
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