-- Add CSV support to training_documents table
-- Drop the existing constraint
ALTER TABLE public.training_documents DROP CONSTRAINT IF EXISTS training_documents_file_type_check;

-- Add the new constraint with CSV included
ALTER TABLE public.training_documents ADD CONSTRAINT training_documents_file_type_check 
CHECK (file_type = ANY (ARRAY['pdf'::text, 'doc'::text, 'docx'::text, 'txt'::text, 'md'::text, 'csv'::text]));

-- Update the table comment
COMMENT ON TABLE public.training_documents IS 'Stores uploaded context documents for AI voice analysis and training. Supports PDF, DOC, DOCX, TXT, MD, and CSV files.'; 