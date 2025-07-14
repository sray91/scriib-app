import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Image, X } from 'lucide-react';
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { VISUAL_TEMPLATES, API_ENDPOINTS, CANVAS_SETTINGS } from '@/lib/constants/canvasConfig';

const VisualBlock = ({ data, id }) => {
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [step, setStep] = useState(0); // 0: template selection, 1: content input, 2: generated result
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const { toast } = useToast();
  const { session, updateDynamicContext } = useCanvasStore();
  
  const handleClose = () => {
    if (data.onClose) {
      data.onClose();
    } else {
      window.dispatchEvent(new CustomEvent('removeNode', { detail: { nodeId: id } }));
    }
  };
  
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    
    // Auto-populate content from connected ideation blocks
    if (session?.dynamicContext?.ideas?.length) {
      const latestIdea = session.dynamicContext.ideas[session.dynamicContext.ideas.length - 1];
      setContent(latestIdea.content.substring(0, 500));
      setContext('LinkedIn post visual');
    }
    
    setStep(1);
  };
  
  const generateVisual = async () => {
    if (!content.trim()) {
      toast({
        title: "Content required",
        description: "Please provide content for the visual",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const response = await fetch(API_ENDPOINTS.INFOGEN_GENERATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          context: context || 'LinkedIn post visual',
          templateId: selectedTemplate?.id || 5
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setGeneratedImage(result.imageUrl);
        
        // Update session context
        updateDynamicContext({
          visuals: [...(session?.dynamicContext?.visuals || []), {
            id: `visual-${Date.now()}`,
            url: result.imageUrl,
            type: 'infographic',
            source: 'visual',
            blockId: id,
            templateId: selectedTemplate?.id,
            templateName: selectedTemplate?.title
          }]
        });
        
        setStep(2);
        
        toast({
          title: "Visual generated!",
          description: "Infographic added to session context"
        });
      } else {
        throw new Error(result.error || 'Failed to generate visual');
      }
    } catch (error) {
      console.error('Error generating visual:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate visual",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const resetToTemplateSelection = () => {
    setStep(0);
    setSelectedTemplate(null);
    setContent('');
    setContext('');
    setGeneratedImage(null);
  };
  
  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 border-purple-200 resize overflow-auto`} 
         style={{ width: `${CANVAS_SETTINGS.VISUAL_BLOCK_WIDTH}px` }}>
      <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-t-lg border-b">
        <Image className="h-5 w-5 text-purple-600" />
        <span className="font-medium text-purple-800">Visual Generator</span>
        {step > 0 && (
          <button
            onClick={resetToTemplateSelection}
            className="text-xs text-purple-600 hover:text-purple-800"
          >
            ← Back to templates
          </button>
        )}
        <button
          onClick={handleClose}
          className="ml-auto p-1 hover:bg-purple-100 rounded-full transition-colors"
          title="Close block"
        >
          <X className="h-4 w-4 text-purple-600" />
        </button>
      </div>
      
      <div className="p-4">
        {/* Template Selection */}
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700">Choose a Template</h3>
            <div className={`grid grid-cols-${CANVAS_SETTINGS.TEMPLATES_GRID_COLS} gap-2`} 
                 style={{ maxHeight: `${CANVAS_SETTINGS.TEMPLATES_MAX_HEIGHT}px` }}>
              {VISUAL_TEMPLATES.map((template) => (
                <div 
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200 bg-white"
                >
                  <div className="relative h-20">
                    {template.imageSrc ? (
                      <img 
                        src={template.imageSrc} 
                        alt={template.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <div className="text-center p-1">
                          <div className="text-gray-500 text-lg">📄</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <h3 className="font-medium text-gray-900 text-xs leading-tight">{template.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Content Input */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Template: <span className="font-medium">{selectedTemplate?.title}</span>
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                rows={CANVAS_SETTINGS.TEXTAREA_ROWS}
                placeholder="Enter content for your visual..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Context (optional)
              </label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="e.g., LinkedIn post visual"
              />
            </div>
            
            <Button
              onClick={generateVisual}
              disabled={isGenerating || !content.trim()}
              className="w-full"
              variant="outline"
            >
              {isGenerating ? 'Generating...' : 'Generate Visual'}
            </Button>
          </div>
        )}
        
        {/* Generated Result */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              {generatedImage ? (
                <img 
                  src={generatedImage} 
                  alt="Generated visual" 
                  className="w-full h-auto rounded"
                />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <div className="text-sm">Visual generation in progress...</div>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={resetToTemplateSelection}
                variant="outline"
                className="flex-1"
              >
                New Visual
              </Button>
              {generatedImage && (
                <Button
                  onClick={() => window.open(generatedImage, '_blank')}
                  className="flex-1"
                >
                  Download
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualBlock; 