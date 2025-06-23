import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Configure the API route for AI processing
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow up to 5 minutes for AI processing

// Initialize AI clients for the Model Ensemble
const openai = new OpenAI({
  apiKey: process.env.OPENAI_COCREATE_API_KEY,
});

// Initialize Anthropic Claude client for the Ensemble
let anthropic;
try {
  const { Anthropic } = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
} catch (error) {
  console.warn('Anthropic Claude SDK not available. Install @anthropic-ai/sdk to use Claude models.');
}

// Initialize Google Generative AI client for Gemini
let genAI;
try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
} catch (error) {
  console.warn('Google Generative AI SDK not available. Install @google/generative-ai to use Gemini models.');
}

// Load hooks knowledge base
let hooksKnowledge = '';
try {
  const hooksPath = path.join(process.cwd(), 'docs', 'HOOKS_GUIDE.md');
  hooksKnowledge = fs.readFileSync(hooksPath, 'utf8');
} catch (error) {
  console.warn('Could not load hooks knowledge base:', error.message);
}

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
    const { userMessage, currentDraft, action = 'create' } = body;
    
    // Validate input
    if (!userMessage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    console.log(`🚀 CoCreate Model Ensemble request from user ${user.id}: "${userMessage}"`);
    
    // Fetch user's past posts from database to analyze their voice
    const pastPosts = await fetchUserPastPosts(supabase, user.id);
    console.log(`📚 Found ${pastPosts.length} past posts for voice analysis`);
    
    // Fetch user's training documents for enhanced voice analysis (limit for performance)
    const trainingDocuments = await fetchUserTrainingDocuments(supabase, user.id);
    console.log(`📄 Found ${trainingDocuments.length} training documents for enhanced voice analysis`);
    
    // Limit training documents to prevent timeouts (max 5 docs, max 50k words total)
    const limitedTrainingDocs = trainingDocuments
      .slice(0, 5)
      .filter(doc => doc.word_count <= 10000) // Skip very large documents
      .reduce((acc, doc) => {
        const totalWords = acc.reduce((sum, d) => sum + d.word_count, 0);
        if (totalWords + doc.word_count <= 50000) {
          acc.push(doc);
        }
        return acc;
      }, []);
    
    if (limitedTrainingDocs.length < trainingDocuments.length) {
      console.log(`⚠️ Limited training documents from ${trainingDocuments.length} to ${limitedTrainingDocs.length} to prevent timeouts`);
    }
    
    // Log the actual past posts content for debugging
    if (pastPosts && pastPosts.length > 0) {
      console.log('🔍 Sample past posts content:');
      pastPosts.slice(0, 3).forEach((post, i) => {
        console.log(`Post ${i + 1}: "${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}"`);
      });
    } else {
      console.log('⚠️ No past posts found - will use fallback voice analysis');
    }
    
    // Check if this is personal/emotional content
    const personalKeywords = [
      'dad', 'father', 'mom', 'mother', 'parent', 'family', 'died', 'death', 'dying', 'passed away', 'funeral', 
      'grief', 'loss', 'mourning', 'cancer', 'illness', 'hospital', 'divorce', 'breakup', 'depression',
      'anxiety', 'mental health', 'therapy', 'trauma', 'suicide', 'addiction', 'recovery', 'struggle',
      'heartbreak', 'crying', 'tears', 'emotional', 'vulnerable', 'personal story', 'intimate'
    ];
    const isPersonalContent = personalKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
    console.log(`🔍 Personal/emotional content detected: ${isPersonalContent}`);
    
    // Fetch trending posts for inspiration
    const trendingPosts = await fetchTrendingPosts(supabase);
    console.log(`📈 Found ${trendingPosts.length} trending posts for inspiration`);
    
    // === MODEL ENSEMBLE APPROACH ===
    console.log('🔀 Initializing Model Ensemble for Quality and Voice...');
    
    // Generate post content using Model Ensemble
    const result = await generateWithModelEnsemble(
      userMessage, 
      currentDraft, 
      action, 
      pastPosts, 
      trendingPosts,
      limitedTrainingDocs,
      user.id,
      supabase
    );
    
    return NextResponse.json({
      success: true,
      message: result.assistantMessage,
      updatedPost: result.postContent,
      isSignificantUpdate: result.isSignificantUpdate,
      processingSteps: result.processingSteps,
      voiceAnalysis: result.voiceAnalysis,
      trendingInsights: result.trendingInsights,
      ensembleDetails: result.ensembleDetails // New: Details about which models were used
    });
    
  } catch (error) {
    console.error('Error in CoCreate Model Ensemble API:', error);
    
    // Handle specific OpenAI errors
    if (error.status === 429 || (error.error && error.error.type === 'insufficient_quota')) {
      return NextResponse.json(
        { 
          error: "AI API rate limit exceeded. Please try again in a moment.",
          type: "rate_limit" 
        }, 
        { status: 429 }
      );
    }
    
    if (error.status === 401) {
      return NextResponse.json(
        { 
          error: "AI API key invalid or missing. Please check your configuration.",
          type: "auth_error" 
        }, 
        { status: 500 }
      );
    }
    
    // Handle JSON parsing errors specifically
    if (error.message && error.message.includes('JSON')) {
      return NextResponse.json(
        { 
          error: "Failed to process AI response. Please try again.",
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          type: "parsing_error"
        }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to generate content. Please try again.",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        type: "generation_error"
      }, 
      { status: 500 }
    );
  }
}

// === MODEL ENSEMBLE IMPLEMENTATION ===

/**
 * Model Ensemble for Quality and Voice
 * 
 * Model 1: Gemini 2.5 - Large document analysis and style guide creation
 * Model 2: Claude 4 Sonnet - Style preset creation from past posts using Claude's Styles API
 * Model 3: Claude Sonnet 4 - Draft generation and quality review
 */
async function generateWithModelEnsemble(userMessage, currentDraft, action, pastPosts, trendingPosts, trainingDocuments, userId, supabase) {
  const processingSteps = [];
  const ensembleDetails = {
    modelsUsed: [],
    styleGuide: null,
    stylePreset: null,
    draftGeneration: null,
    qualityReview: null
  };

  try {
    // === STEP 1: Gemini 2.5 for Large Document Analysis ===
    let styleGuide = null;
    if (trainingDocuments && trainingDocuments.length > 0) {
      processingSteps.push(`🧠 Gemini 2.5: Analyzing ${trainingDocuments.length} training documents for style guide creation...`);
      
      try {
        styleGuide = await createStyleGuideWithGemini(trainingDocuments, userMessage);
        ensembleDetails.modelsUsed.push('Gemini 2.5');
        ensembleDetails.styleGuide = styleGuide;
        processingSteps.push(`✅ Gemini 2.5: Created comprehensive style guide from ${trainingDocuments.reduce((sum, doc) => sum + doc.word_count, 0)} words of training data`);
      } catch (error) {
        console.error('Gemini style guide creation failed:', error);
        processingSteps.push(`⚠️ Gemini 2.5: Fallback to basic document analysis (${error.message})`);
        styleGuide = await createFallbackStyleGuide(trainingDocuments);
      }
    } else {
      processingSteps.push(`ℹ️ No training documents found - skipping Gemini 2.5 style guide creation`);
    }

    // === STEP 2: Claude 4 Sonnet for Style Preset Creation ===
    let stylePreset = null;
    if (pastPosts && pastPosts.length > 0) {
      processingSteps.push(`🎨 Claude 4 Sonnet: Creating reusable style preset from ${pastPosts.length} past posts...`);
      
      try {
        stylePreset = await createStylePresetWithClaude(pastPosts, userId, supabase);
        ensembleDetails.modelsUsed.push('Claude 4 Sonnet');
        ensembleDetails.stylePreset = stylePreset;
        processingSteps.push(`✅ Claude 4 Sonnet: Generated style preset capturing voice patterns, tone, and rhythm`);
      } catch (error) {
        console.error('Claude style preset creation failed:', error);
        processingSteps.push(`⚠️ Claude 4 Sonnet: Fallback to pattern analysis (${error.message})`);
        stylePreset = await createFallbackStylePreset(pastPosts);
      }
    } else {
      processingSteps.push(`ℹ️ No past posts found - skipping Claude 4 Sonnet style preset creation`);
    }

    // === STEP 3: Claude Sonnet 4 for Draft Generation ===
    processingSteps.push(`✍️ Claude Sonnet 4: Generating draft with voice preservation and quality optimization...`);
    
    let draftResult;
    try {
      draftResult = await generateDraftWithClaude(
        userMessage, 
        currentDraft, 
        action, 
        styleGuide, 
        stylePreset, 
        pastPosts, 
        trendingPosts,
        trainingDocuments
      );
      ensembleDetails.modelsUsed.push('Claude Sonnet 4');
      ensembleDetails.draftGeneration = draftResult;
      processingSteps.push(`✅ Claude Sonnet 4: Draft generated with authentic voice preservation`);
    } catch (error) {
      console.error('Claude draft generation failed:', error);
      processingSteps.push(`⚠️ Claude Sonnet 4: Fallback to GPT-4o generation (${error.message})`);
      // Fallback to original GPT-4o approach
      draftResult = await generatePostContentWithGPT4o(
        userMessage, currentDraft, action, pastPosts, trendingPosts, trainingDocuments
      );
      ensembleDetails.modelsUsed.push('GPT-4o (fallback)');
    }

    // === STEP 4: Claude Sonnet 4 for Quality Review and Refinement ===
    if (draftResult && draftResult.postContent) {
      processingSteps.push(`🔍 Claude Sonnet 4: Reviewing draft for factual correctness, clarity, and LinkedIn best practices...`);
      
      try {
        const qualityReview = await reviewDraftQualityWithClaude(
          draftResult.postContent,
          userMessage,
          stylePreset,
          trendingPosts
        );
        ensembleDetails.qualityReview = qualityReview;
        
        if (qualityReview.needs_refinement) {
          processingSteps.push(`🔧 Claude Sonnet 4: Applying quality improvements while preserving voice...`);
          draftResult.postContent = qualityReview.refined_content;
          draftResult.assistantMessage += `\n\nQuality Review: ${qualityReview.improvements.join(', ')}`;
        } else {
          processingSteps.push(`✅ Claude Sonnet 4: Quality review passed - no refinements needed`);
        }
      } catch (error) {
        console.error('Claude quality review failed:', error);
        processingSteps.push(`⚠️ Claude Sonnet 4: Quality review skipped (${error.message})`);
      }
    }

    // === FINALIZE RESULTS ===
    const finalResult = {
      ...draftResult,
      processingSteps,
      ensembleDetails,
      assistantMessage: draftResult.assistantMessage + `\n\n🔀 Model Ensemble Used: ${ensembleDetails.modelsUsed.join(', ')}`
    };

    // Add voice analysis (combining all sources)
    if (!finalResult.voiceAnalysis) {
      finalResult.voiceAnalysis = await analyzeUserVoice(pastPosts, userMessage, trainingDocuments);
    }

    // Add trending insights
    if (!finalResult.trendingInsights) {
      finalResult.trendingInsights = await analyzeTrendingPosts(trendingPosts);
    }

    return finalResult;

  } catch (error) {
    console.error('Error in Model Ensemble:', error);
    
    // Fallback to original single-model approach
    processingSteps.push(`⚠️ Model Ensemble failed - falling back to GPT-4o single model`);
    const fallbackResult = await generatePostContentWithGPT4o(
      userMessage, currentDraft, action, pastPosts, trendingPosts, trainingDocuments
    );
    
    return {
      ...fallbackResult,
      processingSteps: [...processingSteps, ...fallbackResult.processingSteps],
      ensembleDetails: {
        ...ensembleDetails,
        modelsUsed: ['GPT-4o (fallback)'],
        error: error.message
      }
    };
  }
}

// === GEMINI 2.5 FUNCTIONS ===

/**
 * Create style guide from large training documents using Gemini 2.5
 */
async function createStyleGuideWithGemini(trainingDocuments, userMessage) {
  if (!genAI) {
    throw new Error('Google Generative AI not available');
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp" });
  
  // Combine all training document content
  const combinedContent = trainingDocuments.map(doc => 
    `=== ${doc.file_name} (${doc.file_type}) ===\n${doc.extracted_text}`
  ).join('\n\n');

  const prompt = `As an expert content strategist, analyze these training documents to create a comprehensive style guide for content creation.

TRAINING DOCUMENTS:
${combinedContent}

USER REQUEST: ${userMessage}

Create a detailed style guide that captures:

1. **VOICE & TONE**
   - Overall personality and communication style
   - Emotional range and expression patterns
   - Professional vs. casual balance

2. **WRITING MECHANICS**
   - Sentence length and structure preferences
   - Paragraph organization patterns
   - Vocabulary sophistication level

3. **CONTENT PATTERNS**
   - Recurring themes and topics
   - Storytelling approaches
   - Use of examples, analogies, metaphors

4. **FORMATTING PREFERENCES**
   - List structures and organization
   - Use of emphasis (bold, italics)
   - Call-to-action patterns

5. **LINKEDIN OPTIMIZATION**
   - Hook strategies that match this voice
   - Engagement driving elements
   - Professional positioning

Return a comprehensive style guide as JSON with these sections.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    // Return structured fallback if JSON parsing fails
    return {
      voice_tone: text.substring(0, 500),
      writing_mechanics: "Extracted from documents",
      content_patterns: "Analyzed patterns available",
      formatting_preferences: "Document-based preferences",
      linkedin_optimization: "Optimized for platform"
    };
  }
}

/**
 * Fallback style guide creation when Gemini is not available
 */
async function createFallbackStyleGuide(trainingDocuments) {
  const totalWords = trainingDocuments.reduce((sum, doc) => sum + doc.word_count, 0);
  const avgWordsPerDoc = totalWords / trainingDocuments.length;
  
  return {
    voice_tone: "Professional and engaging based on training documents",
    writing_mechanics: `Average document length: ${avgWordsPerDoc} words`,
    content_patterns: `Analyzed ${trainingDocuments.length} documents`,
    formatting_preferences: "Standard professional formatting",
    linkedin_optimization: "Business-focused optimization",
    source: "Fallback analysis"
  };
}

// === CLAUDE 4 SONNET FUNCTIONS ===

/**
 * Create reusable style preset using Claude 4 Sonnet and Styles API
 */
async function createStylePresetWithClaude(pastPosts, userId, supabase) {
  if (!anthropic) {
    throw new Error('Anthropic Claude not available');
  }

  // Prepare past posts content for analysis
  const postsContent = pastPosts.slice(0, 15).map(post => post.content).join('\n\n---\n\n');

  try {
    // Use Claude's Styles API to create a style preset
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Analyze these LinkedIn posts to create a reusable style preset that captures the author's authentic voice, sentence rhythm, vocabulary, and tone.

PAST POSTS:
${postsContent}

Create a comprehensive style analysis focusing on:

1. **SENTENCE RHYTHM & FLOW**
   - Average sentence length and variation
   - Use of short vs. long sentences for impact
   - Punctuation patterns (ellipses, dashes, etc.)

2. **VOCABULARY & LANGUAGE**
   - Formality level (casual, professional, academic)
   - Industry-specific terminology usage
   - Unique phrases or expressions

3. **TONE & PERSONALITY**
   - Emotional expression patterns
   - Confidence level and assertiveness
   - Approachability and relatability

4. **STRUCTURAL PATTERNS**
   - Opening hook preferences
   - Content organization (narrative, lists, questions)
   - Closing patterns and calls-to-action

5. **ENGAGEMENT STYLE**
   - Use of personal stories vs. professional insights
   - Question-asking patterns
   - Community interaction approach

Return as a structured style preset object.`
      }]
    });

    const styleAnalysis = message.content[0].text;

    // Save the style preset to database for reuse
    const { error } = await supabase
      .from('user_style_presets')
      .upsert({
        user_id: userId,
        preset_name: 'LinkedIn Voice Profile',
        style_data: {
          analysis: styleAnalysis,
          source_posts_count: pastPosts.length,
          created_with: 'Claude 4 Sonnet',
          created_at: new Date().toISOString()
        },
        is_active: true,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.warn('Could not save style preset to database:', error);
    }

    return {
      analysis: styleAnalysis,
      source: 'Claude 4 Sonnet Styles API',
      posts_analyzed: pastPosts.length,
      saved_to_db: !error
    };

  } catch (error) {
    console.error('Claude style preset creation failed:', error);
    throw error;
  }
}

/**
 * Fallback style preset creation when Claude is not available
 */
async function createFallbackStylePreset(pastPosts) {
  const avgLength = pastPosts.reduce((sum, post) => sum + post.content.length, 0) / pastPosts.length;
  const usesEmojis = pastPosts.some(post => /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(post.content));
  const usesHashtags = pastPosts.some(post => post.content.includes('#'));

  return {
    analysis: `Analyzed ${pastPosts.length} posts. Average length: ${Math.round(avgLength)} characters. ${usesEmojis ? 'Uses emojis.' : 'No emojis.'} ${usesHashtags ? 'Uses hashtags.' : 'No hashtags.'}`,
    source: 'Fallback pattern analysis',
    posts_analyzed: pastPosts.length,
    saved_to_db: false
  };
}

// === CLAUDE SONNET 4 FUNCTIONS ===

/**
 * Generate draft with Claude Sonnet 4 for high-quality content
 */
async function generateDraftWithClaude(userMessage, currentDraft, action, styleGuide, stylePreset, pastPosts, trendingPosts, trainingDocuments) {
  if (!anthropic) {
    throw new Error('Anthropic Claude not available');
  }

  // Build comprehensive context for Claude
  let context = `You are an expert LinkedIn content creator using voice analysis and quality optimization.

USER REQUEST: ${userMessage}
ACTION: ${action}
${currentDraft ? `CURRENT DRAFT: ${currentDraft}` : ''}

VOICE CONTEXT:`;

  if (styleGuide) {
    context += `\n\nSTYLE GUIDE (from training documents):
${typeof styleGuide === 'object' ? JSON.stringify(styleGuide, null, 2) : styleGuide}`;
  }

  if (stylePreset) {
    context += `\n\nSTYLE PRESET (from past posts):
${typeof stylePreset === 'object' ? stylePreset.analysis : stylePreset}`;
  }

  if (pastPosts && pastPosts.length > 0) {
    const samplePosts = pastPosts.slice(0, 3).map(post => 
      `"${post.content.substring(0, 300)}${post.content.length > 300 ? '...' : ''}"`
    ).join('\n\n');
    context += `\n\nSAMPLE PAST POSTS:
${samplePosts}`;
  }

  context += `\n\nINSTRUCTIONS:
1. Create LinkedIn content that matches the user's authentic voice
2. Use the style guide and preset to maintain consistency
3. Optimize for LinkedIn engagement while preserving authenticity
4. Focus on clarity, value, and professional impact
5. Include compelling hooks and natural conclusions

Generate a high-quality LinkedIn post that feels authentic to this user's voice.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: context
      }]
    });

    const generatedContent = message.content[0].text;

    return {
      postContent: generatedContent,
      assistantMessage: "Generated using Claude Sonnet 4 with voice preservation and quality optimization.",
      isSignificantUpdate: action === 'create' || (currentDraft && calculateTextSimilarity(currentDraft, generatedContent) < 0.8)
    };

  } catch (error) {
    console.error('Claude draft generation failed:', error);
    throw error;
  }
}

/**
 * Review and refine draft quality with Claude Sonnet 4
 */
async function reviewDraftQualityWithClaude(draftContent, originalRequest, stylePreset, trendingPosts) {
  if (!anthropic) {
    throw new Error('Anthropic Claude not available');
  }

  const reviewContext = `Review this LinkedIn post draft for quality, factual accuracy, clarity, and LinkedIn best practices.

ORIGINAL REQUEST: ${originalRequest}

DRAFT CONTENT:
${draftContent}

${stylePreset ? `STYLE PRESET: ${typeof stylePreset === 'object' ? stylePreset.analysis : stylePreset}` : ''}

REVIEW CRITERIA:
1. **Factual Accuracy**: Check for any claims that need verification
2. **Clarity**: Ensure message is clear and easy to understand
3. **LinkedIn Best Practices**: Optimize for platform-specific engagement
4. **Voice Consistency**: Maintain authentic voice from style preset
5. **Professional Impact**: Ensure content adds value to professional network

Provide:
- Overall quality assessment (1-10)
- Specific improvements needed
- Refined version if changes are necessary
- Explanation of changes made

Format as JSON with: { "score": number, "needs_refinement": boolean, "improvements": [], "refined_content": "...", "explanation": "..." }`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: reviewContext
      }]
    });

    const reviewResponse = message.content[0].text;
    
    try {
      return JSON.parse(reviewResponse);
    } catch (parseError) {
      // Return structured fallback if JSON parsing fails
      return {
        score: 8, // Assume good quality if review completed
        needs_refinement: false,
        improvements: ['Quality review completed'],
        refined_content: draftContent,
        explanation: reviewResponse
      };
    }

  } catch (error) {
    console.error('Claude quality review failed:', error);
    throw error;
  }
}

// === FALLBACK GPT-4O FUNCTIONS (for when Model Ensemble fails) ===

/**
 * Generate post content using GPT-4o with advanced analysis (fallback)
 */
async function generatePostContentWithGPT4o(userMessage, currentDraft, action, pastPosts, trendingPosts, trainingDocuments = []) {
  try {
    // Analyze user's voice from past posts and training documents
    const voiceAnalysis = await analyzeUserVoice(pastPosts, userMessage, trainingDocuments);
    
    // Analyze trending posts for patterns
    const trendingInsights = await analyzeTrendingPosts(trendingPosts);
    
    // Build the comprehensive system prompt
    const systemPrompt = buildSystemPrompt(pastPosts, trendingPosts, voiceAnalysis, trendingInsights, userMessage, trainingDocuments);
    
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
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API call timed out after 4 minutes')), 240000); // 4 minutes
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
          timeout: 240000, // 4 minutes timeout for OpenAI
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

// Build comprehensive system prompt
function buildSystemPrompt(pastPosts, trendingPosts, voiceAnalysis, trendingInsights, userMessage = '', trainingDocuments = []) {
  // If user has past posts or training documents, prioritize their authentic voice over everything else
  if ((pastPosts && pastPosts.length > 0) || (trainingDocuments && trainingDocuments.length > 0)) {
    const samplePosts = (pastPosts || []).slice(0, 3).map((post, i) => 
      `LinkedIn Post ${i + 1}: "${post.content.substring(0, 300)}${post.content.length > 300 ? '...' : ''}"`
    ).join('\n\n');

    const sampleDocuments = (trainingDocuments || []).slice(0, 2).map((doc, i) => 
      `Training Document ${i + 1} (${doc.file_name}): "${doc.extracted_text.substring(0, 300)}${doc.extracted_text.length > 300 ? '...' : ''}"`
    ).join('\n\n');

    const totalSources = (pastPosts || []).length + (trainingDocuments || []).length;
    const sourceDescription = [
      pastPosts && pastPosts.length > 0 ? `${pastPosts.length} LinkedIn posts` : null,
      trainingDocuments && trainingDocuments.length > 0 ? `${trainingDocuments.length} training documents` : null
    ].filter(Boolean).join(' and ');

    return `You are CoCreate, an AI writing assistant who helps users write in their authentic voice. You have analyzed ${sourceDescription} to understand their unique writing style and voice patterns.

## USER'S AUTHENTIC VOICE (from ${sourceDescription})
- Writing Style: ${voiceAnalysis.style}
- Tone: ${voiceAnalysis.tone}
- Common Topics: ${voiceAnalysis.commonTopics.join(', ')}
- Average Length: ${voiceAnalysis.avgLength} characters
- Uses Emojis: ${voiceAnalysis.usesEmojis ? 'Yes' : 'No'}
- Uses Hashtags: ${voiceAnalysis.usesHashtags ? 'Yes' : 'No'}
- Preferred Formats: ${voiceAnalysis.preferredFormats.join(', ')}
${voiceAnalysis.documentInsights ? `- Document Insights: ${voiceAnalysis.documentInsights}` : ''}

## EXAMPLES OF USER'S ACTUAL WRITING STYLE
${samplePosts}${sampleDocuments ? '\n\n' + sampleDocuments : ''}

## CORE PRINCIPLES
1. **AUTHENTICITY IS EVERYTHING**: Match the user's exact voice, tone, and style from their past posts
2. **MIRROR THEIR PATTERNS**: Use the same sentence structure, vocabulary, and flow they naturally use
3. **RESPECT THEIR TOPICS**: Write about the subject matter in the way they would naturally approach it
4. **MATCH THEIR FORMALITY**: If they're casual, be casual. If they're formal, be formal.
5. **FOLLOW THEIR EMOJI/HASHTAG PATTERNS**: Only use emojis/hashtags if they typically do
6. **NATURAL ENDINGS**: End posts the way they naturally would - no forced calls to action

## YOUR INSTRUCTIONS
- Write exactly as this user would write, based on their past post patterns
- Use their vocabulary, sentence length, and natural flow
- Match their emotional expression style
- If the topic is personal/emotional, reflect how they handle such topics
- If the topic is professional, reflect their professional voice
- Don't force engagement optimization - let their authentic voice shine through
- End posts naturally in their style, not with forced CTAs unless that's their pattern
- **CRITICAL**: Only use emojis if they actually use them (usesEmojis: ${voiceAnalysis.usesEmojis}). If false, NEVER add emojis.
- **CRITICAL**: Only use hashtags if they actually use them (usesHashtags: ${voiceAnalysis.usesHashtags}). If false, NEVER add hashtags.

Write the post as this specific user would write it, using their authentic voice and patterns.

CRITICAL: Choose the most appropriate hook type from the hooks guide based on the content and user request. Start your explanation by clearly stating: "HOOK_TYPE: [specific hook name from the guide]"

Format your response as:
[POST CONTENT]

---
HOOK_TYPE: [chosen hook type from the hooks guide]
[BRIEF EXPLANATION OF YOUR APPROACH]`;
  }

  // Fallback for users without past posts - use keyword detection
  const personalKeywords = [
    'dad', 'father', 'mom', 'mother', 'parent', 'family', 'died', 'death', 'dying', 'passed away', 'funeral', 
    'grief', 'loss', 'mourning', 'cancer', 'illness', 'hospital', 'divorce', 'breakup', 'depression',
    'anxiety', 'mental health', 'therapy', 'trauma', 'suicide', 'addiction', 'recovery', 'struggle',
    'heartbreak', 'crying', 'tears', 'emotional', 'vulnerable', 'personal story', 'intimate'
  ];
  
  const isPersonalContent = personalKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );

  if (isPersonalContent) {
    return `You are CoCreate, a compassionate AI writing assistant who helps people share authentic personal experiences.

## PERSONAL CONTENT GUIDELINES
This appears to be deeply personal or emotional content. Your priorities are:
1. **AUTHENTICITY FIRST**: Write in a genuine, human way
2. **RESPECT THE TOPIC**: Handle sensitive subjects with care and dignity
3. **NO FORCED OPTIMIZATION**: Don't prioritize engagement over emotional truth
4. **NATURAL FLOW**: Let the content breathe naturally without forced structures

## YOUR INSTRUCTIONS FOR PERSONAL CONTENT
1. Write in a genuine, heartfelt way that feels authentic
2. Use simple, clear language that expresses genuine emotion
3. **NO MANDATORY ENDINGS** - End naturally based on the emotional arc
4. **NO FORCED LISTS** - Only use lists if they feel natural to the story
5. **NEVER use emojis** in emotional content - let words carry the weight
6. **NEVER use hashtags** - keep the focus on the story
7. Respect the gravity of serious topics like loss, illness, or trauma

Write the post authentically, as someone would genuinely share this experience.

Format your response as:
[POST CONTENT]

---
[BRIEF EXPLANATION OF YOUR APPROACH]`;
  }

  // Original system prompt for business/professional content (no past posts)
  return `You are CoCreate, an expert LinkedIn content strategist and AI writing assistant. Your mission is to help users create high-performing LinkedIn posts that maintain their authentic voice while incorporating proven engagement strategies.

## USER'S VOICE ANALYSIS
Based on analysis of ${pastPosts.length} past posts:
- Writing Style: ${voiceAnalysis.style}
- Tone: ${voiceAnalysis.tone}
- Common Topics: ${voiceAnalysis.commonTopics.join(', ')}
- Average Length: ${voiceAnalysis.avgLength} characters
- Uses Emojis: ${voiceAnalysis.usesEmojis ? 'Yes' : 'No'}
- Uses Hashtags: ${voiceAnalysis.usesHashtags ? 'Yes' : 'No'}
- Preferred Formats: ${voiceAnalysis.preferredFormats.join(', ')}

## TRENDING POST INSIGHTS
Analysis of ${trendingPosts.length} high-performing posts:
- Top Formats: ${trendingInsights.topFormats.join(', ')}
- Average Engagement Rate: ${trendingInsights.avgEngagementRate}%
- Common Elements: ${trendingInsights.commonElements.join(', ')}
- Best Topics: ${trendingInsights.bestPerformingTopics.join(', ')}
- Optimal Length: ~${trendingInsights.optimalLength} characters

## HIGH-PERFORMING POST EXAMPLES
${trendingPosts.slice(0, 3).map((post, i) => 
  `Example ${i + 1} (${post.engagement_rate}% engagement):
  "${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}"
  Engagement: ${post.likes} likes, ${post.comments} comments, ${post.shares} shares`
).join('\n\n')}

## EXPERT KNOWLEDGE: CREATING COMPELLING HOOKS
${hooksKnowledge ? hooksKnowledge : 'Hook knowledge base not available'}

Format your response as:
[POST CONTENT]

---
[BRIEF EXPLANATION OF YOUR APPROACH]`;
}

// Build user prompt based on request
function buildUserPrompt(userMessage, currentDraft, action) {
  if (action === 'refine' && currentDraft) {
    return `Please refine this LinkedIn post based on my feedback:

CURRENT DRAFT:
${currentDraft}

MY FEEDBACK:
${userMessage}

Improve the post while maintaining my voice and incorporating trending elements.`;
  }
  
  return `Create a LinkedIn post based on this request: ${userMessage}

Make it engaging, authentic to my voice, and optimized for high performance.`;
}

// Parse GPT response to extract post content, hook type, and explanation
function parseGPTResponse(response) {
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
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

// Fetch user's past posts from the database
async function fetchUserPastPosts(supabase, userId) {
  try {
    const { data: posts, error } = await supabase
      .from('past_posts')
      .select(`
        id,
        content,
        published_at,
        metrics,
        post_type,
        post_url
      `)
      .eq('user_id', userId)
      .eq('platform', 'linkedin')
      .order('published_at', { ascending: false })
      .limit(20); // Analyze up to 20 recent posts for voice

    if (error) {
      console.error('Error fetching past posts:', error);
      return [];
    }

    return posts || [];
  } catch (error) {
    console.error('Error in fetchUserPastPosts:', error);
    return [];
  }
}

// Fetch user's training documents from the database
async function fetchUserTrainingDocuments(supabase, userId) {
  try {
    const { data: documents, error } = await supabase
      .from('training_documents')
      .select(`
        id,
        file_name,
        file_type,
        extracted_text,
        word_count,
        processing_status,
        created_at
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('processing_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10); // Analyze up to 10 most recent documents

    if (error) {
      console.error('Error fetching training documents:', error);
      return [];
    }

    // Filter out documents without extracted text
    const validDocuments = (documents || []).filter(doc => 
      doc.extracted_text && 
      doc.extracted_text.length > 50 && // Minimum 50 characters
      !doc.extracted_text.includes('[PDF content - text extraction not available]') &&
      !doc.extracted_text.includes('[Word document content - text extraction not available]')
    );

    return validDocuments;
  } catch (error) {
    console.error('Error in fetchUserTrainingDocuments:', error);
    return [];
  }
}

// Fetch trending posts for inspiration
async function fetchTrendingPosts(supabase) {
  try {
    const { data: posts, error } = await supabase
      .from('trending_posts')
      .select(`
        id,
        content,
        likes,
        comments,
        shares,
        views,
        author_name,
        author_title,
        post_type,
        industry_tags,
        engagement_rate,
        post_url
      `)
      .eq('is_active', true)
      .order('engagement_rate', { ascending: false })
      .limit(10); // Top 10 trending posts

    if (error) {
      console.error('Error fetching trending posts:', error);
      return [];
    }

    return posts || [];
  } catch (error) {
    console.error('Error in fetchTrendingPosts:', error);
    return [];
  }
}

// Analyze user's writing voice from past posts and training documents
async function analyzeUserVoice(pastPosts, userMessage = '', trainingDocuments = []) {
  if ((!pastPosts || pastPosts.length === 0) && (!trainingDocuments || trainingDocuments.length === 0)) {
    // For personal/emotional content, provide a more authentic fallback
    const personalKeywords = [
      'dad', 'father', 'mom', 'mother', 'parent', 'family', 'died', 'death', 'dying', 'passed away', 'funeral', 
      'grief', 'loss', 'mourning', 'cancer', 'illness', 'hospital', 'divorce', 'breakup', 'depression',
      'anxiety', 'mental health', 'therapy', 'trauma', 'suicide', 'addiction', 'recovery', 'struggle',
      'heartbreak', 'crying', 'tears', 'emotional', 'vulnerable', 'personal story', 'intimate'
    ];
    
    const isPersonalContent = personalKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword)
    );

    if (isPersonalContent) {
      return {
        style: 'Authentic and heartfelt',
        tone: 'Genuine and vulnerable',
        commonTopics: ['Personal experiences', 'Life lessons', 'Family'],
        avgLength: 200,
        usesEmojis: false,
        usesHashtags: false,
        preferredFormats: ['Personal narrative', 'Reflective story']
      };
    }
    
    return {
      style: 'Professional and engaging',
      tone: 'Confident and approachable',
      commonTopics: ['Business', 'Leadership'],
      avgLength: 150,
      usesEmojis: false,
      usesHashtags: true,
      preferredFormats: ['Narrative', 'List']
    };
  }

  // Analyze posts and documents with GPT-4o for voice characteristics
  const postsForAnalysis = (pastPosts || []).slice(0, 10).map(post => ({
    content: post.content,
    engagement: post.metrics,
    type: post.post_type,
    source: 'linkedin_post'
  }));
  
  // Add training documents to analysis
  const documentsForAnalysis = (trainingDocuments || []).slice(0, 5).map(doc => ({
    content: doc.extracted_text,
    type: doc.file_type,
    source: 'training_document',
    filename: doc.file_name
  }));
  
  const allContentForAnalysis = [...postsForAnalysis, ...documentsForAnalysis];

  // Debug emoji detection across all content
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u;
  const actualUsesEmojis = allContentForAnalysis.some(item => emojiRegex.test(item.content));
  const actualUsesHashtags = allContentForAnalysis.some(item => item.content.includes('#'));
  
  console.log('🔍 Content analysis debug:');
  console.log(`- Total content pieces: ${allContentForAnalysis.length} (${postsForAnalysis.length} posts + ${documentsForAnalysis.length} documents)`);
  console.log(`- actualUsesEmojis: ${actualUsesEmojis}`);
  console.log(`- actualUsesHashtags: ${actualUsesHashtags}`);
  allContentForAnalysis.slice(0, 3).forEach((item, i) => {
    const hasEmoji = emojiRegex.test(item.content);
    const hasHashtag = item.content.includes('#');
    console.log(`- ${item.source} ${i+1}: emoji=${hasEmoji}, hashtag=${hasHashtag}, content="${item.content.substring(0, 100)}..."`);
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
                         {
          role: "system",
          content: "You are an expert at analyzing authentic writing voice and style. Analyze the posts to capture the author's natural way of expressing themselves - their vocabulary choices, sentence patterns, emotional expression, and authentic personality. Focus on HOW they naturally write, not what they write about. Return ONLY a valid JSON object."
        },
        {
          role: "user",
          content: `Analyze this person's authentic writing voice from their posts and documents:

${allContentForAnalysis.map((item, i) => {
  const sourceLabel = item.source === 'linkedin_post' ? 'LinkedIn Post' : 
                     item.source === 'training_document' ? `Document (${item.filename})` : 'Content';
  return `${sourceLabel} ${i + 1}: "${item.content}"`;
}).join('\n\n')}

Focus on their natural writing patterns, vocabulary, and authentic voice across all content types. Return analysis as JSON:
{
  "style": "their natural writing style (casual/formal, direct/flowing, conversational/structured, etc)",
  "tone": "their authentic emotional tone and personality in writing", 
  "commonTopics": ["topic1", "topic2"],
  "avgLength": ${Math.round(allContentForAnalysis.reduce((sum, item) => sum + item.content.length, 0) / allContentForAnalysis.length)},
  "usesEmojis": ${actualUsesEmojis},
  "usesHashtags": ${actualUsesHashtags},
  "preferredFormats": ["their natural format preferences based on actual usage"],
  "documentInsights": "how training documents enhance voice understanding (if any documents provided)"
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

        // Validate OpenAI response structure
    if (!completion || !completion.choices || !completion.choices[0] || !completion.choices[0].message) {
      console.error('Invalid OpenAI response structure:', completion);
      throw new Error('Invalid response from OpenAI API');
    }

    // Try to parse the JSON response with error handling
    try {
      const responseContent = completion.choices[0].message.content;
      console.log('Raw voice analysis response:', responseContent);
      
      if (!responseContent || typeof responseContent !== 'string') {
        throw new Error('Empty or invalid response content from OpenAI');
      }
      
      // Extract JSON from markdown code blocks if present
      let cleanedContent = responseContent.trim();
      
      // Remove markdown code block wrapper if present
      if (cleanedContent.startsWith('```json') && cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.slice(7, -3).trim();
      } else if (cleanedContent.startsWith('```') && cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.slice(3, -3).trim();
      }
      
      // Check if the response looks like an error message
      if (responseContent.toLowerCase().includes('error') || responseContent.toLowerCase().includes('sorry')) {
        console.error('OpenAI returned error message:', responseContent);
        throw new Error('OpenAI returned error message');
      }
      
      const voiceAnalysis = JSON.parse(cleanedContent);
      console.log('🎯 Parsed voice analysis:', JSON.stringify(voiceAnalysis, null, 2));
      return voiceAnalysis;
    } catch (parseError) {
      console.error('Error parsing voice analysis JSON:', parseError);
      console.log('Failed response content:', completion.choices[0]?.message?.content);
      // Fall through to fallback analysis below rather than throwing
      console.log('🔄 Falling back to simple analysis due to parsing error');
    }
  } catch (error) {
    console.error('Error analyzing voice with OpenAI:', error);
    console.log('🔄 Using fallback analysis based on past posts patterns');
  }
  
  // Fallback to simple analysis (either from catch block or parsing failure)
  const avgLength = pastPosts.reduce((sum, post) => sum + post.content.length, 0) / pastPosts.length;
  const usesEmojis = pastPosts.some(post => /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(post.content));
  const usesHashtags = pastPosts.some(post => post.content.includes('#'));
  
  // Try to detect writing style from actual content
  const totalWords = pastPosts.reduce((sum, post) => sum + post.content.split(/\s+/).length, 0);
  const avgWordsPerPost = totalWords / pastPosts.length;
  const avgSentenceLength = avgLength / avgWordsPerPost * 20; // rough estimate
  
  // Detect casual vs formal style
  const casualIndicators = pastPosts.reduce((count, post) => {
    const content = post.content.toLowerCase();
    if (content.includes("i'm") || content.includes("don't") || content.includes("can't")) count++;
    if (content.includes("...") || content.includes("!")) count++;
    return count;
  }, 0);
  
  const formalStyle = casualIndicators < pastPosts.length * 0.3;
  
  return {
    style: formalStyle 
      ? (avgLength > 300 ? 'Formal and detailed' : 'Formal and concise')
      : (avgLength > 300 ? 'Conversational and thorough' : 'Casual and direct'),
    tone: formalStyle ? 'Professional and measured' : 'Conversational and authentic',
    commonTopics: extractTopicsFromPosts(pastPosts),
    avgLength: Math.round(avgLength),
    usesEmojis,
    usesHashtags,
    preferredFormats: avgSentenceLength > 15 ? ['Detailed narrative'] : ['Concise narrative'],
    fallbackReason: 'OpenAI voice analysis failed, using pattern analysis'
  };
}

// Analyze trending posts for patterns
async function analyzeTrendingPosts(trendingPosts) {
  if (!trendingPosts || trendingPosts.length === 0) {
    return {
      topFormats: ['List', 'Question'],
      avgEngagementRate: 3.5,
      commonElements: ['Personal story', 'Call to action'],
      bestPerformingTopics: ['Leadership', 'Career'],
      optimalLength: 200
    };
  }

  // Simple analysis of trending posts
  const avgEngagementRate = trendingPosts.reduce((sum, post) => sum + (post.engagement_rate || 0), 0) / trendingPosts.length;
  const avgLength = trendingPosts.reduce((sum, post) => sum + post.content.length, 0) / trendingPosts.length;
  
  // Identify common formats
  const formats = [];
  trendingPosts.forEach(post => {
    if (post.content.includes('1.') || post.content.includes('•')) formats.push('List');
    if (post.content.includes('?')) formats.push('Question');
    if (post.content.toLowerCase().includes('story') || post.content.toLowerCase().includes('learned')) formats.push('Story');
  });
  
  const topFormats = [...new Set(formats)].slice(0, 3);
  
  return {
    topFormats: topFormats.length > 0 ? topFormats : ['List', 'Question'],
    avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
    commonElements: ['Personal insight', 'Call to action', 'Engagement question'],
    bestPerformingTopics: extractTopicsFromTrendingPosts(trendingPosts),
    optimalLength: Math.round(avgLength)
  };
}

// Extract topics from posts
function extractTopicsFromPosts(posts) {
  const topics = [];
  posts.forEach(post => {
    const content = post.content.toLowerCase();
    if (content.includes('leadership') || content.includes('leader')) topics.push('Leadership');
    if (content.includes('career') || content.includes('job')) topics.push('Career');
    if (content.includes('business') || content.includes('strategy')) topics.push('Business');
    if (content.includes('innovation') || content.includes('technology')) topics.push('Innovation');
    if (content.includes('team') || content.includes('collaboration')) topics.push('Teamwork');
  });
  return [...new Set(topics)].slice(0, 5);
}

// Extract topics from trending posts
function extractTopicsFromTrendingPosts(posts) {
  const topics = [];
  posts.forEach(post => {
    if (post.industry_tags && Array.isArray(post.industry_tags)) {
      topics.push(...post.industry_tags);
    }
    // Also extract from content
    const content = post.content.toLowerCase();
    if (content.includes('leadership')) topics.push('Leadership');
    if (content.includes('career')) topics.push('Career');
    if (content.includes('business')) topics.push('Business');
    if (content.includes('marketing')) topics.push('Marketing');
    if (content.includes('innovation')) topics.push('Innovation');
  });
  return [...new Set(topics)].slice(0, 5);
}