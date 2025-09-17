import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Fish, X } from 'lucide-react';
import { NodeResizer, Handle, Position } from 'reactflow';
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { API_ENDPOINTS } from '@/lib/constants/canvasConfig';

const HookBlock = ({ data, id }) => {
  const [hooks, setHooks] = useState([]);
  const [selectedHook, setSelectedHook] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hookCategories, setHookCategories] = useState([]);
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
  
  // Hook patterns for categorizing generated hooks
  const hookPatterns = [
    "Insider's Take", "Good vs Bad", "Before & After", "Problem vs Solution",
    "Question Hook", "Competency", "Polarizing", "Pain Point", 
    "Personal Story", "Attention Grabber", "Misdirect", "Relatable"
  ];

  const generateHooks = async () => {
    // Check for connected ideation blocks using actual edge connections
    const connectedIdeationBlocks = data.edges?.filter(edge => 
      edge.target === id && 
      data.nodes?.find(node => node.id === edge.source && node.type === 'ideationBlock')
    ) || [];
    
    // Also check session context as fallback
    const hasIdeasInSession = session?.dynamicContext?.ideas?.length > 0;
    const hasGeneratedContent = session?.dynamicContext?.generatedContent?.length > 0;
    
    if (connectedIdeationBlocks.length === 0 && !hasIdeasInSession && !hasGeneratedContent) {
      toast({
        title: "No ideas found",
        description: "Connect to an ideation block first",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    
    try {
      // Get content from connected ideation blocks or session context
      let contentToUse = '';
      
      if (connectedIdeationBlocks.length > 0) {
        const sourceBlockId = connectedIdeationBlocks[0].source;
        if (session?.dynamicContext?.generatedContent?.length) {
          const sourceContent = session.dynamicContext.generatedContent.find(content => 
            content.blockId === sourceBlockId
          );
          contentToUse = sourceContent?.content || '';
        }
      }
      
      // Fallback to latest content from session
      if (!contentToUse && hasIdeasInSession) {
        const latestIdea = session.dynamicContext.ideas[session.dynamicContext.ideas.length - 1];
        contentToUse = latestIdea.content;
      } else if (!contentToUse && hasGeneratedContent) {
        const latestContent = session.dynamicContext.generatedContent[session.dynamicContext.generatedContent.length - 1];
        contentToUse = latestContent.content;
      }

      // Generate hooks using AI with the hook templates as context
      const response = await fetch(API_ENDPOINTS.COCREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: `Based on this content: "${contentToUse}"

Create 12 different actual hooks (not templates) using these proven patterns. Each hook must be a complete, ready-to-use opening line that targets one of the 4 eternal markets (Health, Wealth, Relationships, Happiness).

Return ONLY the hooks, numbered 1-12, one per line. Each hook should be a complete sentence that stops the scroll in 3 seconds.

Use these patterns but create ACTUAL HOOKS with real content:

1. Insider's Take: A harsh truth about the industry/topic
2. Good vs Bad: Contrast what people should stop vs start doing  
3. Before & After: A transformation story with specific timeframe
4. Problem vs Solution: Call out wrong approach, offer right way
5. Question Hook: Target pain point with specific threshold/outcome
6. Competency: Impressive achievement with specific timeframe
7. Polarizing: Controversial but confident opinion
8. Pain Point: Acknowledge struggle, promise solution
9. Personal Story: Specific story with lesson learned
10. Attention Grabber: Bold statement that reframes identity/approach
11. Misdirect: Challenge common belief, offer alternative
12. Relatable: Personal struggle overcome with specific tactics

EXAMPLE FORMAT:
1. The harsh truth about [topic]: [specific controversial statement]
2. Stop [bad behavior]. Start [good behavior] instead.
3. I went from [specific bad state] to [specific good state] in [timeframe]
etc.

RULES:
- Each hook must be ONE complete, compelling sentence
- Use specific numbers, timeframes, and details
- Target emotions: curiosity, shock, hope, anger, humor
- Be polarizing and confident
- Make solutions sound achievable
- Focus on the 4 eternal markets: Health, Wealth, Relationships, Happiness

Return ONLY the numbered hooks, nothing else.`,
          action: 'create'
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Parse the AI response to extract individual hooks
        const hookText = result.updatedPost || result.post || '';
        const hookLines = hookText.split('\n').filter(line => 
          line.trim() && line.match(/^\d+\./)
        );
        
        // Use the defined hook patterns for categorizing
        
        // Create hooks from AI response
        const generatedHooks = hookLines.slice(0, 12).map((line, index) => {
          const cleanText = line.replace(/^\d+\.\s*/, '').trim();
          return {
            id: `hook-${Date.now()}-${index}`,
            text: cleanText,
            category: hookPatterns[index] || hookPatterns[index % hookPatterns.length],
            pattern: hookPatterns[index] || hookPatterns[index % hookPatterns.length]
          };
        });
        
        // Fallback: if AI didn't generate enough hooks, create some basic ones
        if (generatedHooks.length === 0) {
          const fallbackHooks = [
            "The harsh truth about success: most people quit right before their breakthrough",
            "Stop chasing perfection. Start embracing progress instead.",
            "I went from broke and desperate to financially free in 18 months",
            "Everyone's doing content wrong. Here's the right way to build an audience:",
            "Under 1000 followers and want to monetize your expertise?",
            "I built a 6-figure business working 4 hours a day. Here's my system:",
            "Unpopular opinion: hustle culture is killing your creativity",
            "Building a personal brand is hard AF. Here's how I cracked the code:",
            "3 years ago I was stuck in a dead-end job. Here's what changed everything:",
            "Listen to me. You're not just an employee anymore, you're a brand.",
            "Everyone says 'follow your passion' is bad advice. They're wrong.",
            "I was burned out, broke, and bitter. Here's the 5 things that saved me:"
          ].map((text, index) => ({
            id: `hook-${Date.now()}-${index}`,
            text: text,
            category: hookPatterns[index],
            pattern: hookPatterns[index]
          }));
          
          setHooks(fallbackHooks);
        } else {
          setHooks(generatedHooks);
        }
        
        setHookCategories(hookPatterns);
        
        toast({
          title: `${generatedHooks.length > 0 ? generatedHooks.length : 12} hooks generated!`,
          description: "Choose your favorite hook to continue"
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

  const selectHook = (hook) => {
    setSelectedHook(hook);
    
    // Update session context with selected hook
    updateDynamicContext({
      hooks: [...(session?.dynamicContext?.hooks || []), {
        id: hook.id,
        content: hook.text,
        source: 'hook',
        blockId: id,
        category: hook.category,
        selected: true
      }]
    });
    
    toast({
      title: "Hook selected!",
      description: `"${hook.text.substring(0, 50)}..." is now active`
    });
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
      
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-green-500 border-2 border-white shadow-md hover:bg-green-600 transition-colors"
        style={{ left: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-white shadow-md hover:bg-green-600 transition-colors"
        style={{ right: -6 }}
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
        {selectedHook && (
          <div className="mb-4 p-3 bg-green-100 rounded-lg border-2 border-green-300">
            <div className="text-xs text-green-600 font-medium mb-1">SELECTED HOOK</div>
            <div className="text-sm text-green-800 font-medium">{selectedHook.text}</div>
            <div className="text-xs text-green-600 mt-1">Category: {selectedHook.category}</div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto mb-4 space-y-3 min-h-0">
          {hooks.map((hook) => (
            <div 
              key={hook.id} 
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                selectedHook?.id === hook.id 
                  ? 'bg-green-100 border-green-300 ring-2 ring-green-200' 
                  : 'bg-green-50 border-green-200 hover:bg-green-100'
              }`}
              onClick={() => selectHook(hook)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs text-green-600 font-medium mb-1">
                    {hook.category}
                  </div>
                  <div className="text-sm text-green-800 leading-relaxed">
                    {hook.text}
                  </div>
                </div>
                {selectedHook?.id === hook.id && (
                  <div className="ml-2 w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-1"></div>
                )}
              </div>
            </div>
          ))}
          {hooks.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              No hooks generated yet<br/>
              <span className="text-xs">Connect to an ideation block and click Generate</span>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Button
            onClick={generateHooks}
            disabled={isGenerating}
            className="w-full"
            variant="outline"
          >
            {isGenerating ? 'Generating 12 hooks...' : 'Generate Hooks'}
          </Button>
          {selectedHook && (
            <div className="text-xs text-center text-green-600">
              ✓ Hook selected and added to session
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default HookBlock; 