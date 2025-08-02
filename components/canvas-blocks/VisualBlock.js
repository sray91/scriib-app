import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Image as ImageIcon, X, FileImage, Grid3X3, Upload } from 'lucide-react';
import Image from 'next/image';
import { NodeResizer } from 'reactflow';
import { useCanvasStore } from '@/lib/stores/canvasStore';
import { VISUAL_TEMPLATES, API_ENDPOINTS, CANVAS_SETTINGS } from '@/lib/constants/canvasConfig';

const VisualBlock = ({ data, id }) => {
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);
  const [step, setStep] = useState(0); // 0: mode selection, 1: template/upload, 2: content input, 3: generated result
  const [mode, setMode] = useState(null); // 'prompt', 'template', 'upload'
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { session, updateDynamicContext } = useCanvasStore();
  
  const handleClose = () => {
    if (data.onClose) {
      data.onClose();
    } else {
      window.dispatchEvent(new CustomEvent('removeNode', { detail: { nodeId: id } }));
    }
  };

  const handleModeSelect = (selectedMode) => {
    setMode(selectedMode);
    
    // Auto-populate content from connected ideation blocks for all modes
    if (session?.dynamicContext?.ideas?.length) {
      const latestIdea = session.dynamicContext.ideas[session.dynamicContext.ideas.length - 1];
      setContent(latestIdea.content.substring(0, 500));
      setContext('LinkedIn post visual');
    }

    if (selectedMode === 'prompt') {
      // Skip to content input for prompt mode
      setStep(2);
    } else {
      // Go to template selection or upload for other modes
      setStep(1);
    }
  };
  
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setStep(2);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(API_ENDPOINTS.INFOGEN_UPLOAD, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setReferenceImage(result.filePath);
        setStep(2); // Move to content input
        toast({
          title: "Reference uploaded!",
          description: "Image uploaded successfully",
        });
      } else {
        throw new Error(result.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
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
      const requestBody = {
        content: content.trim(),
        context: context || 'LinkedIn post visual',
      };

      // Add mode-specific parameters
      if (mode === 'template' && selectedTemplate) {
        requestBody.templateId = selectedTemplate.id;
      } else if (mode === 'upload' && referenceImage) {
        requestBody.referenceImage = referenceImage;
      }

      const response = await fetch(API_ENDPOINTS.INFOGEN_GENERATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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
            mode: mode,
            templateId: selectedTemplate?.id,
            templateName: selectedTemplate?.title,
            referenceImage: referenceImage
          }]
        });
        
        setStep(3);
        
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
  
  const resetToModeSelection = () => {
    setStep(0);
    setMode(null);
    setSelectedTemplate(null);
    setReferenceImage(null);
    setContent('');
    setContext('');
    setGeneratedImage(null);
  };
  
  return (
    <>
      <NodeResizer
        minWidth={350}
        minHeight={300}
        isVisible={true}
        lineClassName="border-purple-500/30"
        handleClassName="w-3 h-3 bg-purple-500/80 hover:bg-purple-600 transition-all rounded-sm border border-white/50"
      />
      <div className={`bg-white shadow-lg border-2 border-purple-200 w-full h-full overflow-auto flex flex-col`}>
        <div className="flex items-center gap-2 p-3 bg-purple-50 border-b">
          <ImageIcon className="h-5 w-5 text-purple-600" />
          <span className="font-medium text-purple-800">Visual Generator</span>
          {step > 0 && (
            <button
              onClick={resetToModeSelection}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              ← Back to options
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
        
        <div className="p-4 flex-1 flex flex-col min-h-0">
          {/* Mode Selection */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Choose Generation Method</h3>
              <div className="grid gap-3">
                <button
                  onClick={() => handleModeSelect('prompt')}
                  className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <FileImage className="h-6 w-6 text-purple-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Generate via Prompt</div>
                    <div className="text-sm text-gray-500">Create infographic from text description</div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleModeSelect('template')}
                  className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <Grid3X3 className="h-6 w-6 text-purple-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Use Template</div>
                    <div className="text-sm text-gray-500">Choose from predefined layouts</div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleModeSelect('upload')}
                  className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <Upload className="h-6 w-6 text-purple-600" />
                  <div className="text-left">
                    <div className="font-medium text-gray-900">Upload Reference</div>
                    <div className="text-sm text-gray-500">Use your own image as reference</div>
                  </div>
                </button>
              </div>
            </div>
          )}
          
          {/* Template Selection */}
          {step === 1 && mode === 'template' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Choose a Template</h3>
              <div className={`grid grid-cols-${CANVAS_SETTINGS.TEMPLATES_GRID_COLS} gap-2 max-h-full overflow-y-auto`}>
                {VISUAL_TEMPLATES.map((template) => (
                  <div 
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200 bg-white"
                  >
                    <div className="relative h-20">
                      {template.imageSrc ? (
                        <Image 
                          src={template.imageSrc} 
                          alt={template.title}
                          fill
                          className="object-cover"
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

          {/* Upload Interface */}
          {step === 1 && mode === 'upload' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Upload Reference Image</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  disabled={isUploading}
                />
                <label 
                  htmlFor="file-upload" 
                  className={`cursor-pointer ${isUploading ? 'opacity-50' : ''}`}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <div className="text-sm text-gray-600">
                    {isUploading ? 'Uploading...' : 'Click to upload an image'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    PNG, JPG, GIF up to 10MB
                  </div>
                </label>
              </div>
              {referenceImage && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Uploaded Reference:</div>
                  <Image 
                    src={referenceImage} 
                    alt="Reference" 
                    width={400}
                    height={128}
                    className="w-full max-h-32 object-contain border rounded"
                  />
                </div>
              )}
            </div>
          )}
          
          {/* Content Input */}
          {step === 2 && (
            <div className="space-y-4">
              {mode === 'template' && selectedTemplate && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Template: <span className="font-medium">{selectedTemplate.title}</span>
                  </p>
                </div>
              )}
              {mode === 'upload' && referenceImage && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Mode: <span className="font-medium">Reference Upload</span>
                  </p>
                </div>
              )}
              {mode === 'prompt' && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Mode: <span className="font-medium">Prompt Generation</span>
                  </p>
                </div>
              )}
              
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
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                {generatedImage ? (
                  <Image 
                    src={generatedImage} 
                    alt="Generated visual" 
                    width={400}
                    height={300}
                    className="w-full h-auto rounded"
                  />
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">Visual generation in progress...</div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={resetToModeSelection}
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
    </>
  );
};

export default VisualBlock; 