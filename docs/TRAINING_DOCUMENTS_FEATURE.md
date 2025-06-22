# Training Documents Feature for Enhanced Voice Analysis

## Overview

The Training Documents feature allows users to upload context documents (emails, transcripts, writing samples, etc.) to enhance the AI's understanding of their writing voice and style. This data is used by the CoCreate agent to generate more authentic and personalized LinkedIn posts.

## Key Features

### 📄 Document Upload System
- **Supported Formats**: PDF, DOC, DOCX, TXT, MD
- **File Size Limit**: 10MB per file
- **Storage**: Supabase blob storage with organized folder structure
- **Text Extraction**: Automatic content extraction for supported formats
- **Status Tracking**: Processing status monitoring (pending → processing → completed/failed)

### 🧠 Enhanced Voice Analysis
- **Multi-Source Analysis**: Combines LinkedIn posts + training documents for comprehensive voice understanding
- **Context Awareness**: Uses document content to understand professional communication patterns
- **Improved Authenticity**: More accurate voice replication based on broader writing samples

### 🎯 CoCreate Integration
- **Seamless Enhancement**: Automatically incorporates document insights into post generation
- **Debug Information**: Detailed breakdown of content sources and analysis results
- **Processing Steps**: Real-time feedback showing document usage in voice analysis

## Technical Implementation

### Database Schema

```sql
-- Training Documents table
CREATE TABLE public.training_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'doc', 'docx', 'txt', 'md')),
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL, -- Supabase storage URL
  description TEXT,
  extracted_text TEXT, -- Extracted content from document
  word_count INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB, -- Additional file metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
```

### API Endpoints

#### Upload Document
```
POST /api/training-data/upload
```
- Validates file type and size
- Uploads to Supabase storage (`training-documents/{user_id}/{filename}`)
- Extracts text content
- Stores metadata in database
- Returns processing status

#### CoCreate Integration
- `fetchUserTrainingDocuments()`: Retrieves active, processed documents
- Enhanced `analyzeUserVoice()`: Includes document content in voice analysis
- Updated system prompts with document insights

### File Processing

```javascript
// Text extraction by file type
switch (fileExtension) {
  case '.txt':
  case '.md':
    return buffer.toString('utf-8');
  
  case '.pdf':
    // Uses pdf-parse library (optional dependency)
    const data = await pdfParse(buffer);
    return data.text;
  
  case '.doc':
  case '.docx':
    // Requires mammoth or similar library
    // Currently marked as processing required
    return '[Word document - processing required]';
}
```

## User Interface

### Settings Tab Structure
```
Settings → Training Data → Context Documents
├── Document Upload Area (Drag & Drop)
├── Upload Status Display
├── Uploaded Documents List
│   ├── File information
│   ├── Processing status
│   ├── Word count
│   └── Active/Inactive toggle
└── Feature Benefits Explanation
```

### CoCreate Debug Information
- Shows count of training documents used
- Displays sample document content in debug panel
- Enhanced system mode indicators (ENHANCED_VOICE vs AUTHENTIC_VOICE vs FALLBACK)

## Voice Analysis Enhancement

### Before (Posts Only)
```javascript
const voiceAnalysis = await analyzeUserVoice(pastPosts, userMessage);
```

### After (Posts + Documents)
```javascript
const voiceAnalysis = await analyzeUserVoice(pastPosts, userMessage, trainingDocuments);
```

### Enhanced Analysis Includes
- **Broader Writing Samples**: Professional emails, meeting transcripts, reports
- **Communication Patterns**: Formal vs informal styles across different contexts
- **Vocabulary Analysis**: Technical terms, industry language, personal expressions
- **Document Insights**: How different content types inform voice understanding

## Processing Flow

1. **Document Upload**
   - User uploads file via drag-and-drop or file picker
   - File validation (type, size)
   - Upload to Supabase storage
   - Text extraction attempt
   - Database record creation

2. **Voice Analysis Enhancement**
   - CoCreate fetches active, processed documents
   - Combines document text with LinkedIn posts
   - Sends enriched content to GPT-4o for analysis
   - Returns enhanced voice profile

3. **Post Generation**
   - Uses enhanced voice analysis for more authentic content
   - Shows processing steps including document usage
   - Provides debug information about content sources

## Benefits

### For Users
- **More Authentic Posts**: AI understands writing style from multiple sources
- **Professional Context**: Includes business communication patterns
- **Flexibility**: Upload various document types for comprehensive analysis
- **Control**: Enable/disable documents as needed

### For Content Quality
- **Improved Voice Matching**: Better replication of authentic writing style
- **Context Awareness**: Understanding of professional vs casual communication
- **Vocabulary Expansion**: Access to broader range of user's expressions
- **Pattern Recognition**: Identifies consistent writing habits across mediums

## Security & Privacy

- **User Isolation**: Documents are user-specific via RLS policies
- **Secure Storage**: Files stored in Supabase with proper access controls
- **Data Processing**: Text extraction happens server-side
- **Content Protection**: Extracted text stored securely, original files remain private

## Future Enhancements

### Planned Improvements
- **Advanced PDF Processing**: Better text extraction for complex PDFs
- **Word Document Support**: Full .doc/.docx processing with formatting
- **Document Categories**: Tag documents by type (emails, reports, presentations)
- **Bulk Upload**: Multiple file upload with progress tracking
- **Document Search**: Find and reference specific uploaded content

### Integration Possibilities
- **Email Import**: Direct integration with email providers
- **Google Docs Sync**: Import from Google Drive
- **Slack Export**: Include team communication patterns
- **Meeting Transcripts**: Automatic upload from video call platforms

## Usage Recommendations

### Ideal Document Types
1. **Email Samples**: Professional communication style
2. **Meeting Transcripts**: Speaking patterns and vocabulary
3. **Reports/Articles**: Formal writing structure
4. **Presentations**: Key messaging and tone
5. **Internal Communications**: Authentic voice patterns

### Best Practices
- Upload 3-5 representative documents for optimal results
- Include various communication styles (formal/informal)
- Ensure documents contain substantial text content (50+ words)
- Regularly review and update active documents
- Use descriptive filenames for better organization

This feature significantly enhances the CoCreate AI's ability to generate authentic, personalized LinkedIn content by providing a richer understanding of the user's unique writing voice and communication patterns. 