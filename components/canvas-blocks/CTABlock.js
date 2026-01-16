import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Target, X } from 'lucide-react';
import { NodeResizer, Handle, Position } from 'reactflow';
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { DEFAULT_CTA_TEMPLATES, API_ENDPOINTS, CANVAS_SETTINGS } from '@/lib/constants/canvasConfig';

const CTABlock = ({ data, id }) => {
  const [ctas, setCtas] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { session, updateDynamicContext, addToHistory } = useCanvasStore();
  
  const handleClose = () => {
    if (data.onClose) {
      data.onClose();
    } else {
      window.dispatchEvent(new CustomEvent('removeNode', { detail: { nodeId: id } }));
    }
  };
  
  const generateCTA = async () => {
    if (!session?.dynamicContext?.ideas?.length) {
      toast({
        title: "No content found",
        description: "Connect to an ideation block first",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const latestIdea = session.dynamicContext.ideas[session.dynamicContext.ideas.length - 1];
      
      const response = await fetch(API_ENDPOINTS.COCREATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: `Create 3 compelling call-to-action options for this content: ${latestIdea.content}. Focus on engagement, connection, and driving action. Return ONLY the 3 CTAs, one per line.`,
          action: 'create',
          skipSufficiencyCheck: true,
          skipQualityReview: true
        }),
      });

      const result = await response.json();

      if (response.ok && result.success && result.content) {
        // Parse the generated CTAs from the content
        const ctaLines = result.content.split('\n').filter(line => line.trim());
        const generatedCTAs = ctaLines.slice(0, 3).map((text, idx) => ({
          id: idx + 1,
          text: text.trim()
        }));

        // Fall back to defaults if parsing failed
        const finalCTAs = generatedCTAs.length > 0 ? generatedCTAs : DEFAULT_CTA_TEMPLATES.map(template => ({
          id: template.id,
          text: template.text
        }));

        setCtas(finalCTAs);

        // Update session context
        updateDynamicContext({
          ctas: [...(session?.dynamicContext?.ctas || []), ...finalCTAs.map(c => ({
            id: `cta-${Date.now()}-${c.id}`,
            content: c.text,
            source: 'cta',
            blockId: id
          }))]
        });

        toast({
          title: "CTAs generated!",
          description: `${finalCTAs.length} new call-to-action options added`
        });
      } else if (result.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error generating CTAs:', error);
      toast({
        title: "Error",
        description: "Failed to generate CTAs",
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
        lineClassName="border-red-500/30"
        handleClassName="w-3 h-3 bg-red-500/80 hover:bg-red-600 transition-all rounded-sm border border-white/50"
      />
      
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-red-500 border-2 border-white shadow-md hover:bg-red-600 transition-colors"
        style={{ left: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-red-500 border-2 border-white shadow-md hover:bg-red-600 transition-colors"
        style={{ right: -6 }}
      />
      
      <div className={`bg-white shadow-lg border-2 border-red-200 w-full h-full overflow-auto flex flex-col`}>
      <div className="flex items-center gap-2 p-3 bg-red-50 border-b">
        <Target className="h-5 w-5 text-red-600" />
        <span className="font-medium text-red-800">Call-to-Action</span>
        <button
          onClick={handleClose}
          className="ml-auto p-1 hover:bg-red-100 rounded-full transition-colors"
          title="Close block"
        >
          <X className="h-4 w-4 text-red-600" />
        </button>
      </div>
      
      <div className="p-4 flex-1 flex flex-col min-h-0">
        <div className="space-y-3 mb-4">
          {ctas.map((cta) => (
            <div key={cta.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="text-sm text-red-800">{cta.text}</div>
            </div>
          ))}
          {ctas.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              No CTAs generated yet
            </div>
          )}
        </div>
        
        <Button
          onClick={generateCTA}
          disabled={isGenerating}
          className="w-full"
          variant="outline"
        >
          {isGenerating ? 'Generating...' : 'Generate CTAs'}
        </Button>
      </div>
      </div>
    </>
  );
};

export default CTABlock; 