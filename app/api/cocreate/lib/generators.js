import fs from 'fs';
import path from 'path';
import { openai, anthropic } from './clients.js';
import { analyzeUserVoice, analyzeTrendingPosts } from './analysis.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';
import { parseGPTResponse, calculateTextSimilarity } from './utils.js';

// Load hooks knowledge base
let hooksKnowledge = '';
try {
  const hooksPath = path.join(process.cwd(), 'docs', 'HOOKS_GUIDE.md');
  hooksKnowledge = fs.readFileSync(hooksPath, 'utf8');
} catch (error) {
  console.warn('Could not load hooks knowledge base:', error.message);
}

/**
 * Generate post content using GPT-4o with advanced analysis (fallback)
 */
export async function generatePostContentWithGPT4o(userMessage, currentDraft, action, pastPosts, trendingPosts, trainingDocuments = []) {
  try {
    // Analyze user's voice from past posts and training documents
    const voiceAnalysis = await analyzeUserVoice(pastPosts, userMessage, trainingDocuments);
    
    // Analyze trending posts for patterns
    const trendingInsights = await analyzeTrendingPosts(trendingPosts);
    
    // Build the comprehensive system prompt
    const systemPrompt = buildSystemPrompt(pastPosts, trendingPosts, voiceAnalysis, trendingInsights, userMessage, trainingDocuments, hooksKnowledge);
    
    // Debug: Log which system prompt path is being used
    if (pastPosts && pastPosts.length > 0) {
      console.log('✅ Using AUTHENTIC VOICE prompt with past posts data');
    } else {
      console.log('⚠️ Using FALLBACK prompt - no past posts available');
    }
    
    // Build the user prompt based on action
    const userPrompt = buildUserPrompt(userMessage, currentDraft, action);
    
    // Call GPT-4o with better error handling and timeout
    let completion;
    try {
      // Create a timeout promise (reduced for hobby plan limits)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API call timed out after 45 seconds')), 45000); // 45 seconds to leave buffer
      });

      // Race between the OpenAI call and timeout
      completion = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o", // Using GPT-4o as requested
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
        timeoutPromise
      ]);
    } catch (openaiError) {
      console.error('OpenAI API Error:', openaiError);
      
      // Handle specific OpenAI errors
      if (openaiError.status === 401) {
        throw new Error('OpenAI API key is invalid or missing. Please check your configuration.');
      } else if (openaiError.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
      } else if (openaiError.status === 402) {
        throw new Error('OpenAI API quota exceeded. Please check your billing.');
      } else if (openaiError.code === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded. Please check your billing.');
      } else if (openaiError.message && openaiError.message.includes('timed out')) {
        throw new Error('AI processing is taking longer than expected. Please try with a shorter request.');
      } else {
        throw new Error(`OpenAI API error: ${openaiError.message || 'Unknown error'}`);
      }
    }
    
    const assistantResponse = completion.choices[0].message.content;
    
    // Parse the response to extract post content, hook type, and explanation
    const { postContent, explanation, hookType } = parseGPTResponse(assistantResponse);
    
    // Determine if this is a significant update
    const isSignificantUpdate = action === 'create' || 
      (currentDraft && calculateTextSimilarity(currentDraft, postContent) < 0.8);
    
    // Generate dynamic processing steps based on what actually happened
    const dynamicSteps = [];
    
    // Step 1: Past posts and documents analysis
    const totalContentSources = pastPosts.length + trainingDocuments.length;
    if (totalContentSources > 0) {
      if (pastPosts.length > 0) {
        dynamicSteps.push(`✅ Found ${pastPosts.length} past posts in database`);
      }
      if (trainingDocuments.length > 0) {
        dynamicSteps.push(`📄 Found ${trainingDocuments.length} training documents (${trainingDocuments.reduce((sum, doc) => sum + doc.word_count, 0)} total words)`);
      }
      dynamicSteps.push(`🔍 Analyzed your writing: "${voiceAnalysis.style}" style, "${voiceAnalysis.tone}" tone`);
      dynamicSteps.push(`📝 Detected patterns: ${voiceAnalysis.usesEmojis ? 'Uses emojis' : 'No emojis'}, ${voiceAnalysis.usesHashtags ? 'Uses hashtags' : 'No hashtags'}`);
      if (voiceAnalysis.fallbackReason) {
        dynamicSteps.push(`⚠️ Voice analysis fallback: ${voiceAnalysis.fallbackReason}`);
      } else {
        dynamicSteps.push(`🎯 Enhanced voice analysis with ${totalContentSources} content sources`);
      }
    } else {
      dynamicSteps.push(`⚠️ No past posts or training documents found - using generic voice profile`);
    }
    
    // Step 2: Content mode detection
    const personalKeywords = ['dad', 'father', 'mom', 'mother', 'parent', 'family', 'died', 'death', 'dying', 'passed away', 'funeral', 'grief', 'loss', 'mourning'];
    const isPersonalContent = personalKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
    
    if (pastPosts.length > 0) {
      dynamicSteps.push(`🎭 Mode: AUTHENTIC VOICE (using your real writing patterns)`);
      if (isPersonalContent) {
        dynamicSteps.push(`💙 Personal content detected - prioritizing authenticity over engagement`);
      }
    } else if (isPersonalContent) {
      dynamicSteps.push(`💙 Mode: PERSONAL FALLBACK (no past posts, but detected emotional content)`);
    } else {
      dynamicSteps.push(`💼 Mode: BUSINESS OPTIMIZATION (no past posts, professional content)`);
    }
    
    // Step 3: Trending analysis (only if using optimization mode)
    if (pastPosts.length === 0 && !isPersonalContent) {
      dynamicSteps.push(`📈 Analyzed ${trendingPosts.length} trending posts for engagement patterns`);
      dynamicSteps.push(`🔥 Top formats: ${trendingInsights.topFormats.join(', ')}`);
    } else {
      dynamicSteps.push(`🚫 Skipping engagement optimization - prioritizing authentic voice`);
    }
    
    // Step 4: Content generation approach
    if (pastPosts.length > 0) {
      dynamicSteps.push(`✍️ Writing in YOUR voice: ${voiceAnalysis.avgLength} avg chars, ${voiceAnalysis.preferredFormats.join(', ')} format`);
    } else {
      dynamicSteps.push(`✍️ Generating with ${isPersonalContent ? 'authentic personal' : 'professional'} approach`);
    }
    
    // Step 5: Hook selection (added after generation)
    if (hookType) {
      dynamicSteps.push(`🎣 Hook chosen: "${hookType}" (from hooks guide)`);
    }

    return {
      assistantMessage: explanation,
      postContent,
      isSignificantUpdate,
      processingSteps: dynamicSteps,
      voiceAnalysis,
      trendingInsights,
      debugInfo: {
        pastPostsCount: pastPosts.length,
        pastPostsSample: pastPosts.slice(0, 3).map(post => ({
          content: post.content,
          length: post.content.length,
          published_at: post.published_at,
          post_type: post.post_type
        })),
        trainingDocumentsSample: trainingDocuments.slice(0, 3).map(doc => ({
          filename: doc.file_name,
          file_type: doc.file_type,
          word_count: doc.word_count,
          content_preview: doc.extracted_text.substring(0, 200)
        })),
        systemPromptMode: (pastPosts.length > 0 || trainingDocuments.length > 0) ? 'ENHANCED_VOICE' : 'FALLBACK',
        trainingDocumentsCount: trainingDocuments.length,
        voiceAnalysisGenerated: voiceAnalysis,
        userMessage: userMessage,
        hookTypeChosen: hookType
      }
    };
    
  } catch (error) {
    console.error('Error in generatePostContentWithGPT4o:', error);
    throw error;
  }
}

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

${action === 'create' ? 'Create a brand new post.' : 'Edit and improve the existing draft.'}

Return the complete post content as plain text. Do not include any JSON, formatting, or additional explanations - just the post content that can be copied and pasted directly to LinkedIn.`;

    processingSteps.push('🤖 Sending request to Claude Sonnet 4...');

    // Call Claude with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Claude API timeout')), 45000);
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