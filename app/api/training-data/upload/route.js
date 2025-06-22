import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.md'];
    const fileExtension = path.extname(file.name).toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: PDF, DOC, DOCX, TXT, MD' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    console.log(`📄 Processing document upload for user ${user.id}: ${file.name} (${file.size} bytes)`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const uniqueId = uuidv4();
    const fileName = `${uniqueId}${fileExtension}`;
    const storagePath = `training-documents/${user.id}/${fileName}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('context-docs')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('context-docs')
      .getPublicUrl(storagePath);

    // Extract text content from the file
    let extractedText = '';
    let wordCount = 0;
    let processingStatus = 'pending';

    try {
      extractedText = await extractTextFromFile(buffer, fileExtension, file.type);
      wordCount = extractedText.split(/\s+/).filter(word => word.length > 0).length;
      processingStatus = 'completed';
      console.log(`✅ Text extraction successful: ${wordCount} words extracted`);
    } catch (extractError) {
      console.error('Text extraction error:', extractError);
      processingStatus = 'failed';
      extractedText = '';
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
      // Try to clean up the uploaded file
      await supabase.storage
        .from('context-docs')
        .remove([storagePath]);
      
      return NextResponse.json({ 
        error: 'Failed to save document to database',
        details: dbError.message 
      }, { status: 500 });
    }

    console.log(`✅ Successfully stored training document: ${documentRecord.id}`);

    return NextResponse.json({
      success: true,
      message: 'Document uploaded and processed successfully',
      data: {
        id: documentRecord.id,
        file_name: documentRecord.file_name,
        file_type: documentRecord.file_type,
        word_count: documentRecord.word_count,
        processing_status: documentRecord.processing_status
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

// Extract text content from different file types
async function extractTextFromFile(buffer, fileExtension, contentType) {
  switch (fileExtension.toLowerCase()) {
    case '.txt':
    case '.md':
      return buffer.toString('utf-8');
    
    case '.pdf':
      // For PDF files, we'll use a simple text extraction
      // In production, you might want to use a library like pdf-parse
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text;
      } catch (error) {
        console.warn('PDF parsing not available, storing as binary reference');
        return '[PDF content - text extraction not available]';
      }
    
    case '.doc':
    case '.docx':
      // For Word documents, you would typically use mammoth or similar
      // For now, we'll mark it as requiring processing
      console.warn('Word document text extraction not implemented');
      return '[Word document content - text extraction not available]';
    
    default:
      throw new Error(`Unsupported file type: ${fileExtension}`);
  }
} 