// Utility functions for CoCreate API

// Parse GPT response to extract post content, hook type, and explanation
export function parseGPTResponse(response) {
  const parts = response.split('---');
  
  if (parts.length >= 2) {
    let postContent = parts[0].trim();
    let explanationPart = parts[1].trim();
    
    // Remove [POST CONTENT] prefix if it exists
    postContent = postContent.replace(/^\[POST CONTENT\]\s*/, '');
    
    // Clean up asterisk formatting in lists (convert **text**: to text:)
    postContent = postContent.replace(/\*\*(.*?)\*\*:/g, '$1:');
    
    // Extract hook type from explanation
    let hookType = null;
    const hookTypeMatch = explanationPart.match(/HOOK_TYPE:\s*([^\n]+)/i);
    if (hookTypeMatch) {
      hookType = hookTypeMatch[1].trim();
      // Remove the HOOK_TYPE line from explanation
      explanationPart = explanationPart.replace(/HOOK_TYPE:\s*[^\n]+\n?/i, '').trim();
    }
    
    return {
      postContent,
      explanation: explanationPart,
      hookType
    };
  }
  
  // Fallback if no separator found
  let postContent = response;
  
  // Remove [POST CONTENT] prefix if it exists
  postContent = postContent.replace(/^\[POST CONTENT\]\s*/, '');
  
  // Clean up asterisk formatting in lists
  postContent = postContent.replace(/\*\*(.*?)\*\*:/g, '$1:');
  
  return {
    postContent,
    explanation: "I've created a post optimized for engagement based on your request and writing style.",
    hookType: null
  };
}

// Calculate text similarity (simple implementation)
export function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
} 