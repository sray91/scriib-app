import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Play, Plus, Brain, Fish, Image as ImageIcon, Target } from 'lucide-react';
import { NodeResizer, Handle, Position } from 'reactflow';
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { API_ENDPOINTS, CANVAS_SETTINGS } from '@/lib/constants/canvasConfig';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// iMessage-like typing indicator component
const TypingIndicator = () => {
  return (
    <div className="bg-gray-200 text-gray-800 mr-4 p-4 rounded-2xl text-sm flex items-center justify-center max-w-[80px] shadow-sm">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
      </div>
    </div>
  );
};

const IdeationBlock = ({ data, id }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedModel, setSelectedModel] = useState(process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929');
  const { toast } = useToast();
  const { session, updateDynamicContext, addToHistory } = useCanvasStore();
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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
      // Call the dedicated Ideation API (Claude + Context Docs)
      const response = await fetch('/api/cocreate/ideation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage,
          contextType: 'guide',
          model: selectedModel
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Display the post content directly
        const postContent = result.post || 'Post generated successfully!';

        const contextInfo = result.contextUsed
          ? `✅ Used your personal context guide to match your voice and expertise`
          : `⚠️ No personal context guide found - create one in Settings > Context Guide to get personalized posts that match your voice`;

        const assistantMessage = `${contextInfo}\n\n${postContent}`;

        // Add AI response to block
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: assistantMessage
        }]);

        // Update session context with the generated post
        const newPost = {
          id: `post-${Date.now()}`,
          content: postContent,
          source: 'ideation',
          blockId: id,
          contextUsed: result.contextUsed,
          model: selectedModel
        };

        // Store in both generatedContent and ideas for backward compatibility
        updateDynamicContext({
          generatedContent: [...(session?.dynamicContext?.generatedContent || []), newPost],
          ideas: [...(session?.dynamicContext?.ideas || []), newPost]
        });

        // Add to history
        addToHistory({
          blockId: id,
          blockType: 'ideation',
          input: userMessage,
          output: assistantMessage,
          context: session?.intrinsicContext,
          postGenerated: true,
          model: selectedModel
        });

        // Update block data
        data.onUpdate?.({
          content: assistantMessage,
          lastGenerated: new Date().toISOString(),
          postGenerated: true,
          contextUsed: result.contextUsed,
          model: selectedModel
        });

        toast({
          title: "Post generated!",
          description: result.contextUsed
            ? "Personalized using your context guide"
            : "Generic post - add a context guide in Settings for personalization"
        });
      } else {
        throw new Error(result.error || 'Failed to generate ideas');
      }
    } catch (error) {
      console.error('Error generating ideas:', error);
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
        minWidth={450}
        minHeight={400}
        isVisible={true}
        lineClassName="border-blue-500/30"
        handleClassName="w-3 h-3 bg-blue-500/80 hover:bg-blue-600 transition-all rounded-sm border border-white/50"
      />

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-blue-500 border-2 border-white shadow-md hover:bg-blue-600 transition-colors"
        style={{ left: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-blue-500 border-2 border-white shadow-md hover:bg-blue-600 transition-colors"
        style={{ right: -6 }}
      />

      <div className="bg-white shadow-lg border-2 border-blue-200 w-full h-full relative flex flex-col">
        <div className="flex items-center gap-2 p-3 bg-blue-50 border-b flex-shrink-0 justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-800">Ideation</span>
          </div>

          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-white border-blue-200">
              <SelectValue placeholder="Model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929"}>Sonnet 4.5</SelectItem>
              <SelectItem value={process.env.NEXT_PUBLIC_ANTHROPIC_OPUS_MODEL || "claude-opus-4-5-20251101"}>Opus 4.5</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Plus Button */}
        <div className="absolute -right-4 top-1/2 transform -translate-y-1/2 z-20">
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
                  <ImageIcon className="h-4 w-4 text-purple-600" />
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
          <div
            className="flex-1 overflow-y-scroll mb-4 space-y-2 pr-2 nowheel"
            style={{
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch'
            }}
            onWheel={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const delta = e.deltaY;
              e.currentTarget.scrollTop += delta;
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {messages.map((message, index) => (
              <div key={index} className={`p-3 rounded text-sm break-words ${message.role === 'user'
                ? 'bg-blue-100 text-blue-800 ml-4 font-sans'
                : 'bg-gray-100 text-gray-800 mr-4 font-serif'
                }`}>
                {message.role === 'assistant' ? (
                  <div className="space-y-3">
                    {message.content.split('\n').map((line, lineIndex) => {
                      if (line.trim() === '') return <div key={lineIndex} className="h-2"></div>;
                      if (line.includes('Used your personal context guide') || line.includes('No context guide found')) {
                        return (
                          <div key={lineIndex} className="text-xs bg-white p-2 rounded border-l-4 border-blue-400 mb-3 break-words">
                            {line}
                          </div>
                        );
                      }
                      return (
                        <div key={lineIndex} className="leading-relaxed break-words whitespace-pre-wrap">
                          {line}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="break-words whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
            ))}

            {/* Show typing indicator when loading */}
            {isLoading && <TypingIndicator />}

            {messages.length === 0 && !isLoading && (
              <div className="text-center text-gray-500 text-sm py-8">
                Let&apos;s create some content with {selectedModel === (process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929') ? 'Sonnet 4.5' : 'Opus 4.5'}...
              </div>
            )}

            {/* Auto-scroll target */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 flex-shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              onKeyDown={(e) => {
                // Prevent global keyboard shortcuts when typing in this input
                e.stopPropagation();
              }}
              placeholder="Write me a post about..."
              className="flex-1 px-3 py-2 border rounded-md text-sm"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              size="sm"
            >
              {isLoading ? (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              ) : (
                'Send'
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default IdeationBlock; 