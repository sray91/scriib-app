# Documentation

This folder contains knowledge base files that are used by the CoCreate AI system to enhance post generation.

## Files

### HOOKS_GUIDE.md
Contains expert knowledge about creating compelling hooks for LinkedIn posts. This content is automatically loaded by the CoCreate API and included in the AI's system prompt.

**To update with your Google Doc content:**

1. Open your Google Doc about creating hooks
2. Go to File → Download → Plain text (.txt) or Markdown (.md)
3. Copy the content
4. Replace the content in `HOOKS_GUIDE.md` with your Google Doc content
5. The changes will automatically be picked up by the CoCreate API

**Important:** The AI system loads this file at startup, so you may need to restart your development server after making changes.

## Adding New Knowledge Base Files

To add additional knowledge base files:

1. Create a new `.md` file in this folder
2. Add the file loading logic in `app/api/cocreate/route.js`
3. Include the content in the `buildSystemPrompt` function

## File Format

Knowledge base files should be in Markdown format for best readability and structure. The AI can understand and work with:
- Headers (# ## ###)
- Lists (- or 1.)
- Bold/italic text (**bold** *italic*)
- Code blocks (```code```)
- Tables
- Links 