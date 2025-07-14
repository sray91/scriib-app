import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Type, X } from 'lucide-react';
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
    <div className={`bg-white rounded-lg shadow-lg border-2 border-orange-200 resize overflow-auto`}
         style={{ minWidth: `${CANVAS_SETTINGS.MIN_BLOCK_WIDTH}px` }}>
      <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-t-lg border-b">
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
      
      <div className="p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Compiled content will appear here..."
          className="w-full p-3 border rounded-md text-sm resize-none"
          style={{ height: `${CANVAS_SETTINGS.CHAT_HEIGHT}px` }}
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
  );
};

export default ContentBlock; 