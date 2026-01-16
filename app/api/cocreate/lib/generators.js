import { anthropic } from './clients.js';
import { analyzeUserVoice, analyzeTrendingPosts } from './analysis.js';
import { calculateTextSimilarity } from './utils.js';

/**
 * Generate post content using Claude Sonnet 4
 */
export async function generatePostContentWithClaude(userMessage, currentDraft, action, pastPosts, trendingPosts, trainingDocuments, targetUserId, supabase) {
  if (!anthropic) {
    throw new Error('Claude API not available');
  }

  const processingSteps = [];
  processingSteps.push('🚀 Starting Claude Sonnet 4 content generation...');

  try {
    // Get user's context guide instead of training documents
    let contextGuide = null;
    if (targetUserId) {
      processingSteps.push(`📖 Fetching context guide for user ${targetUserId}...`);

      const { data: prefsData, error: prefsError } = await supabase
        .from('user_preferences')
        .select('settings')
        .eq('user_id', targetUserId)
        .single();

      if (prefsError && prefsError.code !== 'PGRST116') {
        console.error('Error fetching user preferences:', prefsError);
      } else if (prefsData?.settings?.contextGuide) {
        contextGuide = prefsData.settings.contextGuide;
        processingSteps.push('✅ Context guide loaded successfully');
      } else {
        processingSteps.push('⚠️ No context guide found for user');
      }
    }

    // Analyze voice from past posts
    let voiceAnalysis = null;
    if (pastPosts && pastPosts.length > 0) {
      processingSteps.push(`🎯 Analyzing voice from ${pastPosts.length} past posts...`);
      voiceAnalysis = await analyzeUserVoice(pastPosts, trainingDocuments);
      processingSteps.push('✅ Voice analysis completed');
    }

    // Analyze trending posts for inspiration
    let trendingInsights = null;
    if (trendingPosts && trendingPosts.length > 0) {
      processingSteps.push(`📈 Analyzing ${trendingPosts.length} trending posts for insights...`);
      trendingInsights = await analyzeTrendingPosts(trendingPosts);
      processingSteps.push('✅ Trending analysis completed');
    }

    // Build the prompt for Claude
    let prompt = `You are an expert LinkedIn content creator specializing in personalized post generation.

USER REQUEST: "${userMessage}"

`;

    // Add context guide if available
    if (contextGuide) {
      prompt += `PERSONAL CONTEXT GUIDE (Primary Reference for Voice & Style):
This is the user's carefully crafted personal context guide that defines their unique voice, expertise, and content approach:

${contextGuide}

IMPORTANT: Use this context guide as your PRIMARY reference for understanding how they write and what they care about.

`;
    }

    // Add voice analysis if available
    if (voiceAnalysis) {
      prompt += `VOICE ANALYSIS FROM PAST POSTS:
Style: ${voiceAnalysis.style}
Tone: ${voiceAnalysis.tone}
Common Topics: ${voiceAnalysis.commonTopics.join(', ')}
Average Length: ${voiceAnalysis.avgLength} characters
Uses Emojis: ${voiceAnalysis.usesEmojis}
Uses Hashtags: ${voiceAnalysis.usesHashtags}
Preferred Formats: ${voiceAnalysis.preferredFormats.join(', ')}

`;
    }

    // Add trending insights if available
    if (trendingInsights) {
      prompt += `TRENDING POST INSIGHTS (For Inspiration):
${trendingInsights}

`;
    }

    // Add current draft context if this is an edit
    if (currentDraft && action === 'edit') {
      prompt += `CURRENT DRAFT TO EDIT:
${currentDraft}

`;
    }

    prompt += `TASK:
Create a complete LinkedIn post that directly addresses the user's request while matching their personal voice and style.

Requirements:
1. **VOICE MATCH**: Mirror the writing style, tone, and approach from the context guide and voice analysis
2. **EXPERTISE ALIGNMENT**: Focus on topics and perspectives that match the user's documented areas
3. **ADDRESS THE REQUEST**: Directly respond to what the user is asking for
4. **OPTIMIZE FOR LINKEDIN**: Include engaging hook, clear value, and call-to-action
5. **BE COMPLETE**: Provide a full, ready-to-post LinkedIn post
6. **MATCH LENGTH**: Aim for approximately ${voiceAnalysis?.avgLength || 800} characters based on user's typical post length

CRITICAL RULES - DO NOT VIOLATE:
- NEVER invent, fabricate, or make up stories, experiences, anecdotes, or personal narratives
- NEVER create fictional scenarios or imaginary examples presented as real
- NEVER attribute quotes, statistics, or facts that weren't provided by the user
- If the user asks for a story or personal experience, ask them to provide the details - do NOT make one up
- Only use information explicitly provided by the user in their request
- If you need more details to write authentically, indicate what information would help

${action === 'create' ? 'Create a brand new post.' : 'Edit and improve the existing draft.'}

Return the complete post content as plain text. Do not include any JSON, formatting, or additional explanations - just the post content that can be copied and pasted directly to LinkedIn. If you cannot write the post without making up content, instead return a message asking the user for the specific details you need.`;

    processingSteps.push('🤖 Sending request to Claude Sonnet 4...');

    // Call Claude with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Claude API timeout')), 45000);
    });

    const message = await Promise.race([
      anthropic.messages.create({
        model: process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: prompt
        }]
      }),
      timeoutPromise
    ]);

    const postContent = message.content[0].text.trim();
    processingSteps.push('✅ Content generated successfully');

    // Determine if this is a significant update
    const isSignificantUpdate = action === 'create' || (currentDraft && calculateTextSimilarity(currentDraft, postContent) < 0.7);

    return {
      postContent,
      assistantMessage: `I've created a ${action === 'create' ? 'new' : 'revised'} LinkedIn post ${contextGuide ? 'using your personal context guide' : 'based on your voice analysis'} and ${trendingPosts?.length || 0} trending posts for inspiration.`,
      isSignificantUpdate,
      processingSteps,
      voiceAnalysis,
      trendingInsights,
      contextGuideUsed: !!contextGuide,
      model: 'Claude 3.5 Sonnet'
    };

  } catch (error) {
    console.error('Error in generatePostContentWithClaude:', error);

    if (error.message.includes('timeout')) {
      throw new Error('Content generation is taking longer than expected. Please try with a shorter request.');
    } else if (error.message.includes('rate limit')) {
      throw new Error('AI service rate limit exceeded. Please try again in a moment.');
    } else {
      throw new Error(`Claude API error: ${error.message || 'Unknown error'}`);
    }
  }
} 