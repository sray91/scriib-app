-- Training Documents table for storing uploaded context files for voice analysis
DROP TABLE IF EXISTS public.training_documents CASCADE;

CREATE TABLE public.training_documents (
    id UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_url TEXT NOT NULL, -- Supabase storage URL
    description TEXT NULL,
    extracted_text TEXT NULL, -- extracted content from the document
    word_count INTEGER NOT NULL DEFAULT 0,
    processing_status TEXT NOT NULL DEFAULT 'pending',
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NULL, -- store additional file metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Primary key
    CONSTRAINT training_documents_pkey PRIMARY KEY (id),
    
    -- Foreign key to auth.users
    CONSTRAINT training_documents_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    
    -- File type constraint (includes CSV)
    CONSTRAINT training_documents_file_type_check CHECK (
        file_type = ANY (ARRAY['pdf'::text, 'doc'::text, 'docx'::text, 'txt'::text, 'md'::text, 'csv'::text])
    ),
    
    -- Processing status constraint
    CONSTRAINT training_documents_processing_status_check CHECK (
        processing_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])
    )
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS training_documents_user_id_idx 
    ON public.training_documents USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS training_documents_created_at_idx 
    ON public.training_documents USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS training_documents_processing_status_idx 
    ON public.training_documents USING btree (processing_status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS training_documents_active_idx 
    ON public.training_documents USING btree (is_active) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS training_documents_user_active_idx 
    ON public.training_documents USING btree (user_id, is_active) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS training_documents_file_type_idx 
    ON public.training_documents USING btree (file_type) TABLESPACE pg_default;

-- Full-text search index on extracted_text (for AI content search)
CREATE INDEX IF NOT EXISTS training_documents_extracted_text_idx 
    ON public.training_documents USING gin (to_tsvector('english', extracted_text));

-- Enable Row Level Security (RLS)
ALTER TABLE public.training_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own training documents
CREATE POLICY "Users can view their own training documents" 
    ON public.training_documents
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own training documents
CREATE POLICY "Users can insert their own training documents" 
    ON public.training_documents
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own training documents
CREATE POLICY "Users can update their own training documents" 
    ON public.training_documents
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- Users can delete their own training documents
CREATE POLICY "Users can delete their own training documents" 
    ON public.training_documents
    FOR DELETE 
    USING (auth.uid() = user_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_training_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_training_documents_updated_at_trigger
    BEFORE UPDATE ON public.training_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_training_documents_updated_at();

-- Add comments to the table and columns
COMMENT ON TABLE public.training_documents IS 'Stores uploaded context documents for AI voice analysis and training. Supports PDF, DOC, DOCX, TXT, MD, and CSV files.';

COMMENT ON COLUMN public.training_documents.id IS 'Unique identifier for the training document';
COMMENT ON COLUMN public.training_documents.user_id IS 'Reference to the user who uploaded the document';
COMMENT ON COLUMN public.training_documents.file_name IS 'Original filename of the uploaded document';
COMMENT ON COLUMN public.training_documents.file_type IS 'File extension without dot (pdf, doc, docx, txt, md, csv)';
COMMENT ON COLUMN public.training_documents.file_size IS 'File size in bytes';
COMMENT ON COLUMN public.training_documents.file_url IS 'Supabase storage public URL for the file';
COMMENT ON COLUMN public.training_documents.description IS 'Optional user-provided description of the document';
COMMENT ON COLUMN public.training_documents.extracted_text IS 'Text content extracted from the uploaded document for AI processing';
COMMENT ON COLUMN public.training_documents.word_count IS 'Number of words in the extracted text';
COMMENT ON COLUMN public.training_documents.processing_status IS 'Status of document processing: pending, processing, completed, failed';
COMMENT ON COLUMN public.training_documents.is_active IS 'Whether this document should be used for AI training';
COMMENT ON COLUMN public.training_documents.metadata IS 'Additional metadata about the file (original_name, upload_date, content_type, etc.)';
COMMENT ON COLUMN public.training_documents.created_at IS 'Timestamp when the document was uploaded';
COMMENT ON COLUMN public.training_documents.updated_at IS 'Timestamp when the document was last modified';

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON public.training_documents TO authenticated;
-- GRANT USAGE ON SEQUENCE training_documents_id_seq TO authenticated; 