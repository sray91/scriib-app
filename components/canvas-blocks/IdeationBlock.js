import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Play, Plus, Brain, Fish, Image, Target } from 'lucide-react';
import { NodeResizer } from 'reactflow';
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { API_ENDPOINTS, CANVAS_SETTINGS } from '@/lib/constants/canvasConfig';

const IdeationBlock = ({ data, id }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();
  const { session, updateDynamicContext, addToHistory } = useCanvasStore();
  
  // Function to add connected block
  const addConnectedBlock = (blockType) => {
    // We'll need to access the canvas functions from here
    // For now, we'll trigger an event that the parent canvas can listen to
    const event = new CustomEvent('addConnectedBlock', {
      detail: { blockType, sourceId: id }
    });
    window.dispatchEvent(event);
    setShowDropdown(false);
  };
  
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    setIsLoading(true);
    const userMessage = input.trim();
    setInput('');
    
    // Add user message to block
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    
    try {
      // Call the CoCreate API
      const response = await fetch(API_ENDPOINTS.COCREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage,
          action: 'create'
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Add AI response to block
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: result.message 
        }]);
        
        // Update session context
        updateDynamicContext({
          ideas: [...(session?.dynamicContext?.ideas || []), {
            id: `idea-${Date.now()}`,
            content: result.updatedPost,
            source: 'ideation',
            blockId: id
          }]
        });
        
        // Add to history
        addToHistory({
          blockId: id,
          blockType: 'ideation',
          input: userMessage,
          output: result.updatedPost,
          context: session?.intrinsicContext
        });
        
        // Update block data
        data.onUpdate?.({ 
          content: result.updatedPost,
          lastGenerated: new Date().toISOString()
        });
        
        toast({
          title: "Idea generated!",
          description: "Content has been added to session context"
        });
      } else {
        throw new Error(result.error || 'Failed to generate content');
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <NodeResizer
        minWidth={350}
        minHeight={300}
        isVisible={true}
        lineClassName="border-blue-400"
        handleClassName="bg-blue-500"
      />
      <div className="bg-white rounded-lg shadow-lg border-2 border-blue-200 w-full h-full relative flex flex-col">
      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-t-lg border-b">
        <Brain className="h-5 w-5 text-blue-600" />
        <span className="font-medium text-blue-800">Ideation</span>
      </div>
      
      {/* Plus Button */}
      <div className="absolute -right-4 top-1/2 transform -translate-y-1/2">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors shadow-lg"
          >
            <Plus className="h-4 w-4" />
          </button>
          
          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute left-10 top-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
              <button
                onClick={() => addConnectedBlock('visual')}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
              >
                <Image className="h-4 w-4 text-purple-600" />
                Visual
              </button>
              <button
                onClick={() => addConnectedBlock('hook')}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
              >
                <Fish className="h-4 w-4 text-green-600" />
                Hook
              </button>
              <button
                onClick={() => addConnectedBlock('cta')}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
              >
                <Target className="h-4 w-4 text-red-600" />
                CTA
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col min-h-0">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-2 min-h-0">
          {messages.map((message, index) => (
            <div key={index} className={`p-2 rounded text-sm ${
              message.role === 'user' 
                ? 'bg-blue-100 text-blue-800 ml-4' 
                : 'bg-gray-100 text-gray-800 mr-4'
            }`}>
              {message.content}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              Start brainstorming ideas...
            </div>
          )}
        </div>
        
        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="What do you want to create?"
            className="flex-1 px-3 py-2 border rounded-md text-sm"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            size="sm"
          >
            {isLoading ? '...' : 'Send'}
          </Button>
        </div>
      </div>
      </div>
    </>
  );
};

export default IdeationBlock; 