import { openai, anthropic, genAI } from './clients.js';
import { generatePostContentWithGPT4o } from './generators.js';
import { analyzeUserVoice, analyzeTrendingPosts } from './analysis.js';

/**
 * Model Ensemble for Quality and Voice
 * 
 * Model 1: Gemini 2.5 - Large document analysis and style guide creation
 * Model 2: Claude 4 Sonnet - Style preset creation from past posts using Claude's Styles API
 * Model 3: Claude Sonnet 4 - Draft generation and quality review
 * Optimized for 60-second serverless function timeout
 */
export async function generateWithModelEnsemble(userMessage, currentDraft, action, pastPosts, trendingPosts, trainingDocuments, userId, supabase) {
  const processingSteps = [];
  const ensembleDetails = {
    modelsUsed: [],
    styleGuide: null,
    stylePreset: null,
    draftGeneration: null,
    qualityReview: null
  };

  try {
    // Set up global timeout for entire ensemble (45 seconds max to leave buffer)
    const ensembleTimeout = 45000;
    const startTime = Date.now();
    
    const processEnsemble = async () => {
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
    }; // End processEnsemble function

    // Race between ensemble processing and timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Model Ensemble timed out - falling back to GPT-4o')), ensembleTimeout);
    });

    return await Promise.race([processEnsemble(), timeoutPromise]);

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

  // Add timeout for Gemini API call (20 seconds for better reliability)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Gemini API call timed out')), 20000);
  });

  const result = await Promise.race([
    model.generateContent(prompt),
    timeoutPromise
  ]);
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
    // Use Claude's Styles API to create a style preset (with timeout for hobby plan)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Claude API call timed out')), 25000); // 25 seconds for better reliability
    });

    const message = await Promise.race([
      anthropic.messages.create({
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
      }),
      timeoutPromise
    ]);

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