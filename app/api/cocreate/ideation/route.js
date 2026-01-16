import { NextResponse } from 'next/server';
import { anthropic } from '../lib/clients.js';
import { requireAuth } from '@/lib/api-auth';

// Configure the API route for ideation-specific AI processing
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Shorter timeout for ideation

export async function POST(req) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    // Parse request body
    const body = await req.json();
    const { userMessage, contextType = 'guide', model = 'claude-sonnet-4-5-20250929' } = body;

    // Validate input
    if (!userMessage) {
      return NextResponse.json({ error: "Missing user message" }, { status: 400 });
    }

    console.log(`🧠 Ideation request from user ${userId}: "${userMessage}" [Model: ${model}]`);

    // Fetch user's context document (markdown guide)
    const contextDoc = await fetchUserContextDocument(supabase, userId, contextType);
    console.log(`📄 Context document found: ${contextDoc ? 'Yes' : 'No'}`);

    // Fetch viral posts as reference (placeholder for future)
    const viralPosts = await fetchViralPostsReference(supabase, 5);
    console.log(`🔥 Viral posts reference: ${viralPosts.length} posts`);

    // Generate ideas using Claude with context document
    const result = await generateIdeasWithClaude(
      userMessage,
      contextDoc,
      viralPosts,
      userId,
      model
    );

    return NextResponse.json({
      success: true,
      post: result.post,
      contextUsed: result.contextUsed,
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
 * Fetch user's context guide from user preferences ONLY
 * Training documents are not used directly - they should only be used to create/update the context guide
 */
async function fetchUserContextDocument(supabase, userId, contextType = 'guide') {
  try {
    // Get context guide from user_preferences only
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('settings')
      .eq('user_id', userId)
      .single();

    if (prefError) {
      console.log(`No user preferences found for user ${userId}:`, prefError.message);
      return null;
    }

    if (!preferences?.settings?.contextGuide) {
      console.log(`No context guide found in user preferences for user ${userId}`);
      return null;
    }

    const guide = preferences.settings.contextGuide;
    return {
      filename: 'Personal Context Guide',
      content: guide,
      wordCount: guide.split(/\s+/).filter(word => word.length > 0).length,
      type: 'guide',
      source: 'user_preferences'
    };

  } catch (error) {
    console.error('Error fetching context guide from user preferences:', error);
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
async function generateIdeasWithClaude(userMessage, contextDoc, viralPosts, userId, modelId = 'claude-sonnet-4-5-20250929') {
  if (!anthropic) {
    throw new Error('Claude API not available');
  }

  // Validate model ID to ensure security
  const validModels = [
    process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
    process.env.NEXT_PUBLIC_ANTHROPIC_OPUS_MODEL || 'claude-opus-4-5-20251101'
  ];
  const cleanModelId = validModels.includes(modelId)
    ? modelId
    : (process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929');

  // Build context-focused prompt with anti-fabrication rules
  let prompt = `You are an expert LinkedIn content creator specializing in personalized post generation using the user's personal context guide.

⚠️ CRITICAL ANTI-FABRICATION RULES (NEVER VIOLATE):
- NEVER invent or fabricate stories, anecdotes, experiences, or examples
- NEVER create fictional scenarios and present them as real
- NEVER attribute quotes, statistics, or facts that aren't from the context guide
- NEVER use phrases like "I once..." or "A client of mine..." unless EXPLICITLY documented in the context guide
- If you need an example, use clearly hypothetical language: "Imagine if..." or "Consider a scenario where..."
- If the user's request requires specific experiences you don't have documented, ASK for them or state the limitation

USER REQUEST: "${userMessage}"

`;

  // Add context document if available
  if (contextDoc) {
    prompt += `PERSONAL CONTEXT GUIDE (Your ONLY Reference for Voice & Style):
This is the user's carefully crafted personal context guide that defines their unique voice, expertise, and content approach. This is your SOLE reference for understanding how they write and what they care about:

=== ${contextDoc.filename} ===
${contextDoc.content}

IMPORTANT: Use ONLY this context guide to understand the user's voice, style, and expertise. Do not make assumptions beyond what's provided here.

`;
  } else {
    prompt += `⚠️ NO PERSONAL CONTEXT GUIDE FOUND
The user has not yet created their personal context guide. Without this guide, I cannot match their unique voice and expertise.

Please generate a generic LinkedIn post based on best practices, but note that it will lack the user's personal voice and specific expertise areas.

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
Create a complete LinkedIn post that directly addresses the user's request while strictly adhering to their personal context guide.

Requirements:
1. **NEVER FABRICATE**: Do NOT invent stories, experiences, client examples, or specific events unless explicitly documented in the context guide. Use hypothetical framing ("Imagine...", "Consider...") for examples instead of presenting fiction as fact.
2. **CONTEXT GUIDE ONLY**: Use ONLY the personal context guide above for voice, style, and expertise - no other assumptions
3. **EXACT VOICE MATCH**: Mirror the writing style, tone, and approach defined in the context guide
4. **EXPERTISE ALIGNMENT**: Focus on topics and perspectives that match the user's documented expertise areas
5. **ADDRESS THE REQUEST**: Directly respond to what the user is asking for
6. **OPTIMIZE FOR LINKEDIN**: Include engaging hook, clear value, and call-to-action
7. **BE COMPLETE**: Provide a full, ready-to-post LinkedIn post

Return the complete post content as plain text. Do not include any JSON, formatting, or additional explanations - just the post content that can be copied and pasted directly to LinkedIn.`;

  try {
    // Call Claude with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Claude API timeout')), 45000); // Increased timeout for Opus
    });

    const message = await Promise.race([
      anthropic.messages.create({
        model: cleanModelId,
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: prompt
        }]
      }),
      timeoutPromise
    ]);

    const response = message.content[0].text;
    console.log('Claude raw response:', response.substring(0, 200) + '...');

    // Return the post content directly
    return {
      post: response.trim(),
      contextUsed: !!contextDoc,
      processingDetails: {
        model: cleanModelId === 'claude-opus-4-5-20251101' ? "Claude 4.5 Opus" : "Claude 4.5 Sonnet",
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
