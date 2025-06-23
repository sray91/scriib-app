import fs from 'fs';
import path from 'path';
import { openai } from './clients.js';
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
          timeout: 45000, // 45 seconds timeout for OpenAI
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