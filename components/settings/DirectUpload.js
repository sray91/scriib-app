import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';

const DirectUpload = ({ onUploadComplete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const supabase = createClientComponentClient();
  const { toast } = useToast();

  const handleDirectUpload = async (file) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Starting upload...');

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Validate file type
      const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.md', '.csv'];
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      
      if (!allowedTypes.includes(fileExtension)) {
        throw new Error('Unsupported file type. Allowed: PDF, DOC, DOCX, TXT, MD, CSV');
      }

      // Validate file size (50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('File too large. Maximum size is 50MB.');
      }

      setUploadStatus('Uploading to storage...');
      setUploadProgress(25);

      // Generate unique filename
      const uniqueId = uuidv4();
      const fileName = `${uniqueId}${fileExtension}`;
      const storagePath = `training-documents/${user.id}/${fileName}`;

      // Upload directly to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('context-docs')
        .upload(storagePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setUploadProgress(50);
      setUploadStatus('Processing file content...');

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('context-docs')
        .getPublicUrl(storagePath);

      // Extract text content
      let extractedText = '';
      let wordCount = 0;
      let processingStatus = 'pending';

      try {
        extractedText = await extractTextFromFile(file, fileExtension);
        wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;
        processingStatus = 'completed';
        setUploadProgress(75);
        setUploadStatus('Saving to database...');
      } catch (extractError) {
        console.error('Text extraction error:', extractError);
        processingStatus = 'failed';
        extractedText = '[Content extraction failed - file uploaded but text not available]';
      }

      // Store document metadata in database
      const documentData = {
        user_id: user.id,
        file_name: file.name,
        file_type: fileExtension.substring(1), // Remove the dot
        file_size: file.size,
        file_url: publicUrl,
        extracted_text: extractedText,
        word_count: wordCount,
        processing_status: processingStatus,
        is_active: true,
        metadata: {
          original_name: file.name,
          upload_date: new Date().toISOString(),
          content_type: file.type
        }
      };

      const { data: documentRecord, error: dbError } = await supabase
        .from('training_documents')
        .insert(documentData)
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        // Clean up uploaded file
        await supabase.storage.from('context-docs').remove([storagePath]);
        throw new Error(`Database error: ${dbError.message}`);
      }

      setUploadProgress(100);
      setUploadStatus('Upload complete!');

      toast({
        title: 'Upload successful',
        description: `${file.name} uploaded and processed successfully (${wordCount.toLocaleString()} words)`,
      });

      // Call callback to refresh the document list
      if (onUploadComplete) {
        onUploadComplete(documentRecord);
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  // Extract text from different file types (client-side)
  const extractTextFromFile = async (file, fileExtension) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          switch (fileExtension.toLowerCase()) {
            case '.txt':
            case '.md':
            case '.csv':
              resolve(e.target.result);
              break;
            case '.pdf':
              resolve('[PDF content - text extraction available on server]');
              break;
            case '.doc':
            case '.docx':
              resolve('[Word document content - text extraction available on server]');
              break;
            default:
              reject(new Error(`Unsupported file type: ${fileExtension}`));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (files.length === 0) return;

    // Process files one by one
    for (let i = 0; i < files.length; i++) {
      await handleDirectUpload(files[i]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
        <div className="mx-auto w-12 h-12 mb-4 text-muted-foreground">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">Direct Upload (Bypasses Server Limits)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload large files directly to storage. Supports files up to 50MB.
        </p>
        
        <input
          type="file"
          id="direct-upload"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md,.csv"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
        />
        
        <Button
          onClick={() => document.getElementById('direct-upload').click()}
          disabled={isUploading}
          className="mx-auto"
        >
          {isUploading ? 'Uploading...' : 'Choose Files for Direct Upload'}
        </Button>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{uploadStatus}</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}
    </div>
  );
};

export default DirectUpload; 