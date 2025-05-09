'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import TemplateCard from '@/components/info-gen/TemplateCard';

export default function InfographicGenerator() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState(0); // 0: Select mode, 1: Upload, 2: Content, 3: Generate
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [generatedResult, setGeneratedResult] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const router = useRouter();

  const templates = [
    { id: 1, title: "Myth vs. Fact", imageSrc: "/images/templates/myth-vs-fact.png" },
    { id: 2, title: "12 Info Blocks", imageSrc: "/images/templates/info-blocks.png" },
    { id: 3, title: "Cheat Sheet", imageSrc: "/images/templates/cheat-sheet.png" },
    { id: 4, title: "10 Brutal Truths", imageSrc: "/images/templates/brutal-truths.png" },
    { id: 5, title: "Listicle", imageSrc: "/images/templates/listicle.png" },
    { id: 6, title: "8 Radial Options", imageSrc: "/images/templates/radial-options.png" },
    { id: 7, title: "5 Lessons", imageSrc: "/images/templates/lessons.png" },
    { id: 8, title: "Roadmap", imageSrc: "/images/templates/roadmap.png" },
    { id: 9, title: "7 Things About Archetype", imageSrc: "/images/templates/archetype.png" },
  ];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/infogen/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        setStep(2);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setStep(2);
  };

  const handleContentSubmit = async () => {
    if (!content || !context) return;
    
    try {
      const response = await fetch('/api/infogen/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          context,
          referenceImage: previewUrl,
          templateId: selectedTemplate ? selectedTemplate.id : null,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setGeneratedResult(data);
        setStep(3);
      }
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  const selectUploadMode = () => {
    setSelectedTemplate(null);
    setStep(1);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Infographic Generator</h1>
        
        {step === 0 && (
          <div className="space-y-8">
            <div className="flex justify-center space-x-4">
              <button
                onClick={selectUploadMode}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Upload Your Own Infographic
              </button>
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold mb-4">Or Choose a Template</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {templates.map((template) => (
                  <TemplateCard 
                    key={template.id}
                    title={template.title}
                    imageSrc={template.imageSrc}
                    onClick={() => handleTemplateSelect(template)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="mb-4">
              <button 
                onClick={() => setStep(0)} 
                className="text-blue-500 hover:underline flex items-center"
              >
                ← Back to options
              </button>
            </div>
            <h2 className="text-xl font-semibold">Upload Reference Infographic</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer block"
              >
                <div className="text-gray-600">
                  {previewUrl ? (
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      width={500}
                      height={500}
                      className="max-h-96 mx-auto"
                    />
                  ) : (
                    <p>Click to upload an 8.5x11&quot; infographic</p>
                  )}
                </div>
              </label>
            </div>
            {file && (
              <button
                onClick={handleUpload}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Continue
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="mb-4">
              <button 
                onClick={() => setStep(0)} 
                className="text-blue-500 hover:underline flex items-center"
              >
                ← Back to options
              </button>
            </div>
            <h2 className="text-xl font-semibold">Provide Content and Context</h2>
            
            {selectedTemplate && (
              <div className="mb-4">
                <p className="text-gray-700">Selected template: <span className="font-medium">{selectedTemplate.title}</span></p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Content
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={4}
                  placeholder="Enter the content you want in the infographic..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Context
                </label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={4}
                  placeholder="Provide any additional context or specific requirements..."
                />
              </div>
              <button
                onClick={handleContentSubmit}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Generate Infographic
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="mb-4">
              <button 
                onClick={() => setStep(0)} 
                className="text-blue-500 hover:underline flex items-center"
              >
                ← Start a new infographic
              </button>
            </div>
            <h2 className="text-xl font-semibold">Generated Infographic</h2>
            <div className="border rounded-lg p-4">
              {!generatedResult ? (
                <p className="text-gray-600">Your infographic is being generated...</p>
              ) : (
                <div className="space-y-4">
                  <Image
                    src={generatedResult.imageUrl}
                    alt="Generated Infographic"
                    width={800}
                    height={1100}
                    className="w-full max-w-2xl mx-auto"
                  />
                  <a
                    href={generatedResult.imageUrl}
                    download
                    className="inline-block mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Download Infographic
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 