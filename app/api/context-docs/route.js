import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// Configure the API route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET - Fetch user's context guide and documents
 */
export async function GET(req) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    // Get URL parameters
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'all'; // 'guide', 'reference', 'all'

    // First, get the context guide from user preferences
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('settings, updated_at')
      .eq('user_id', userId)
      .single();
    
    const contextGuide = preferences?.settings?.contextGuide ? {
      id: 'context-guide',
      filename: 'Context Guide',
      type: 'guide',
      wordCount: preferences.settings.contextGuide.split(/\s+/).filter(w => w.length > 0).length,
      status: 'active',
      createdAt: preferences.updated_at,
      preview: preferences.settings.contextGuide.substring(0, 200) + '...',
      source: 'user_preferences',
      content: preferences.settings.contextGuide
    } : null;
    
    // If only requesting guide, return just the context guide
    if (type === 'guide') {
      return NextResponse.json({
        success: true,
        contextGuide,
        documents: contextGuide ? [contextGuide] : [],
        count: contextGuide ? 1 : 0,
        type: 'guide'
      });
    }
    
    // For reference documents or all, also fetch training documents
    let query = supabase
      .from('training_documents')
      .select('id, file_name, file_type, word_count, created_at, processing_status, extracted_text, metadata')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (type === 'reference') {
      query = query.in('file_type', ['pdf', 'doc', 'docx']);
    }
    
    const { data: docs, error } = await query;
    
    if (error) {
      console.error('Error fetching training documents:', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }
    
    // Process documents for response
    const processedDocs = docs.map(doc => ({
      id: doc.id,
      filename: doc.file_name,
      type: doc.file_type,
      wordCount: doc.word_count,
      status: doc.processing_status,
      createdAt: doc.created_at,
      preview: doc.extracted_text ? doc.extracted_text.substring(0, 200) + '...' : null,
      metadata: doc.metadata,
      source: 'training_documents'
    }));
    
    // Combine context guide with training documents
    const allDocuments = contextGuide ? [contextGuide, ...processedDocs] : processedDocs;
    
    return NextResponse.json({
      success: true,
      contextGuide,
      documents: allDocuments,
      count: allDocuments.length,
      type: type
    });
    
  } catch (error) {
    console.error('Error in context docs API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create/upload a new context document
 */
export async function POST(req) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;
    
    const body = await req.json();
    const { content, filename, type = 'guide', description } = body;
    
    // Validate input
    if (!content || !filename) {
      return NextResponse.json(
        { error: 'Content and filename are required' },
        { status: 400 }
      );
    }
    
    // Determine file type from filename or type parameter
    const fileExtension = filename.split('.').pop()?.toLowerCase() || 'md';
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    
    // Insert document into database
    const { data: doc, error: insertError } = await supabase
      .from('training_documents')
      .insert({
        user_id: userId,
        file_name: filename,
        file_type: fileExtension,
        file_size: content.length,
        file_url: `inline://context-docs/${userId}/${filename}`, // Inline content
        description: description || `${type === 'guide' ? 'Context guide' : 'Reference document'} created via API`,
        extracted_text: content,
        word_count: wordCount,
        processing_status: 'completed',
        is_active: true,
        metadata: {
          created_via: 'api',
          content_type: 'text/markdown',
          document_type: type,
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error inserting context document:', insertError);
      return NextResponse.json(
        { error: 'Failed to create context document' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.file_name,
        type: doc.file_type,
        wordCount: doc.word_count,
        status: doc.processing_status,
        createdAt: doc.created_at
      },
      message: 'Context document created successfully'
    });
    
  } catch (error) {
    console.error('Error creating context document:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update an existing context document
 */
export async function PUT(req) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;
    
    const body = await req.json();
    const { id, content, description, isActive } = body;
    
    // Validate input
    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }
    
    // Prepare update data
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (content !== undefined) {
      updateData.extracted_text = content;
      updateData.word_count = content.split(/\s+/).filter(word => word.length > 0).length;
      updateData.file_size = content.length;
    }
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    if (isActive !== undefined) {
      updateData.is_active = isActive;
    }
    
    // Update document
    const { data: doc, error: updateError } = await supabase
      .from('training_documents')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId) // Ensure user owns the document
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating context document:', updateError);
      return NextResponse.json(
        { error: 'Failed to update context document' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.file_name,
        type: doc.file_type,
        wordCount: doc.word_count,
        status: doc.processing_status,
        updatedAt: doc.updated_at
      },
      message: 'Context document updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating context document:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove a context document
 */
export async function DELETE(req) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;
    
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }
    
    // Delete document (soft delete by setting is_active to false)
    const { error: deleteError } = await supabase
      .from('training_documents')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId); // Ensure user owns the document
    
    if (deleteError) {
      console.error('Error deleting context document:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete context document' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Context document deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting context document:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
