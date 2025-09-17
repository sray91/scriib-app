import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { anthropic } from '../lib/clients.js';

// Configure the API route for ideation-specific AI processing
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Shorter timeout for ideation

export async function POST(req) {
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
    
    // Parse request body
    const body = await req.json();
    const { userMessage, contextType = 'guide' } = body;
    
    // Validate input
    if (!userMessage) {
      return NextResponse.json({ error: "Missing user message" }, { status: 400 });
    }
    
    console.log(`🧠 Ideation request from user ${user.id}: "${userMessage}"`);
    
    // Fetch user's context document (markdown guide)
    const contextDoc = await fetchUserContextDocument(supabase, user.id, contextType);
    console.log(`📄 Context document found: ${contextDoc ? 'Yes' : 'No'}`);
    
    // Fetch viral posts as reference (placeholder for future)
    const viralPosts = await fetchViralPostsReference(supabase, 5);
    console.log(`🔥 Viral posts reference: ${viralPosts.length} posts`);
    
    // Generate ideas using Claude with context document
    const result = await generateIdeasWithClaude(
      userMessage,
      contextDoc,
      viralPosts,
      user.id
    );
    
    return NextResponse.json({
      success: true,
      ideas: result.ideas,
      message: result.message,
      contextUsed: !!contextDoc,
      viralPostsCount: viralPosts.length,
      processingDetails: result.processingDetails
    });
    
  } catch (error) {
    console.error('Error in Ideation API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate ideas' },
      { status: 500 }
    );
  }
}

/**
 * Fetch user's context guide from user preferences
 */
async function fetchUserContextDocument(supabase, userId, contextType = 'guide') {
  try {
    // First try to get context guide from user_preferences
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('settings')
      .eq('user_id', userId)
      .single();
    
    if (!prefError && preferences?.settings?.contextGuide) {
      const guide = preferences.settings.contextGuide;
      return {
        filename: 'Context Guide',
        content: guide,
        wordCount: guide.split(/\s+/).filter(word => word.length > 0).length,
        type: 'guide',
        source: 'user_preferences'
      };
    }
    
    // Fallback: Look for markdown files in training documents
    const { data: docs, error } = await supabase
      .from('training_documents')
      .select('file_name, extracted_text, word_count, file_type')
      .eq('user_id', userId)
      .eq('processing_status', 'completed')
      .eq('is_active', true)
      .in('file_type', ['md', 'txt'])
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error fetching context document:', error);
      return null;
    }
    
    if (!docs || docs.length === 0) {
      console.log('No context guide found for user');
      return null;
    }
    
    const doc = docs[0];
    return {
      filename: doc.file_name,
      content: doc.extracted_text,
      wordCount: doc.word_count,
      type: doc.file_type,
      source: 'training_documents'
    };
    
  } catch (error) {
    console.error('Error in fetchUserContextDocument:', error);
    return null;
  }
}

/**
 * Fetch viral posts as reference material (placeholder for future enhancement)
 */
async function fetchViralPostsReference(supabase, limit = 5) {
  try {
    const { data: posts, error } = await supabase
      .from('viral_posts')
      .select('content, likes_count, comments_count, viral_score, author_name')
      .eq('is_viral', true)
      .order('viral_score', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching viral posts:', error);
      return [];
    }
    
    return posts || [];
  } catch (error) {
    console.error('Error in fetchViralPostsReference:', error);
    return [];
  }
}

/**
 * Generate ideas using Claude with context document as primary reference
 */
async function generateIdeasWithClaude(userMessage, contextDoc, viralPosts, userId) {
  if (!anthropic) {
    throw new Error('Claude API not available');
  }
  
  // Build context-focused prompt
  let prompt = `You are an expert content ideation assistant helping to generate LinkedIn post ideas based on a user's specific context and voice.

USER REQUEST: "${userMessage}"

`;

  // Add context document if available
  if (contextDoc) {
    prompt += `CONTEXT GUIDE (Primary Reference):
This is the user's personal context guide that defines their voice, expertise, and content approach:

=== ${contextDoc.filename} ===
${contextDoc.content}

`;
  } else {
    prompt += `NOTE: No personal context guide available. Generate ideas based on best practices for LinkedIn content.

`;
  }
  
  // Add viral posts reference (placeholder)
  if (viralPosts && viralPosts.length > 0) {
    prompt += `VIRAL POSTS REFERENCE (Inspiration Only):
Here are some high-performing LinkedIn posts for inspiration on format and engagement:

`;
    viralPosts.forEach((post, index) => {
      prompt += `${index + 1}. "${post.content.substring(0, 200)}..." (${post.likes_count} likes, Score: ${post.viral_score})

`;
    });
    prompt += `
`;
  }
  
  prompt += `TASK:
Generate 3-5 specific, actionable LinkedIn post ideas that:

1. **ALIGN WITH CONTEXT**: Use the context guide to match the user's voice, expertise, and content style
2. **ADDRESS THE REQUEST**: Directly respond to what the user is asking for
3. **OPTIMIZE FOR LINKEDIN**: Include engaging hooks, clear value propositions, and call-to-actions
4. **PROVIDE VARIETY**: Offer different content formats (story, tips, insight, question, etc.)
5. **BE SPECIFIC**: Include specific angles, examples, or frameworks rather than generic concepts

For each idea, provide:
- **Hook**: An attention-grabbing opening line
- **Content Angle**: The main message or story
- **Format**: Type of post (story, tips list, insight, question, etc.)
- **CTA**: Suggested call-to-action
- **Key Points**: 2-3 specific points to cover

Return as a structured JSON object with an array of ideas.`;

  try {
    // Call Claude with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Claude API timeout')), 25000);
    });

    const message = await Promise.race([
      anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: prompt
        }]
      }),
      timeoutPromise
    ]);

    const response = message.content[0].text;
    
    // Try to parse as JSON, fallback to structured text
    let ideas;
    try {
      const parsed = JSON.parse(response);
      ideas = parsed.ideas || parsed;
    } catch (parseError) {
      // If JSON parsing fails, create structured response from text
      ideas = [{
        hook: "Generated idea based on your request",
        contentAngle: response.substring(0, 300) + "...",
        format: "insight",
        cta: "What are your thoughts?",
        keyPoints: ["AI-generated content", "Based on context", "Optimized for LinkedIn"]
      }];
    }

    return {
      ideas: Array.isArray(ideas) ? ideas : [ideas],
      message: "Ideas generated using Claude with your personal context guide",
      processingDetails: {
        model: "Claude 3.5 Sonnet",
        contextDocUsed: !!contextDoc,
        viralPostsReferenced: viralPosts.length,
        responseLength: response.length
      }
    };

  } catch (error) {
    console.error('Claude ideation generation failed:', error);
    throw new Error(`Failed to generate ideas: ${error.message}`);
  }
}
