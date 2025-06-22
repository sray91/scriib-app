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

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_COCREATE_API_KEY,
});

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
    
    console.log(`🚀 CoCreate request from user ${user.id}: "${userMessage}"`);
    
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
    
    // Generate post content using GPT-4o
    const result = await generatePostContentWithGPT4o(
      userMessage, 
      currentDraft, 
      action, 
      pastPosts, 
      trendingPosts,
      limitedTrainingDocs
    );
    
    return NextResponse.json({
      success: true,
      message: result.assistantMessage,
      updatedPost: result.postContent,
      isSignificantUpdate: result.isSignificantUpdate,
      processingSteps: result.processingSteps,
      voiceAnalysis: result.voiceAnalysis,
      trendingInsights: result.trendingInsights
    });
    
  } catch (error) {
    console.error('Error in CoCreate API:', error);
    
    // Handle specific OpenAI errors
    if (error.status === 429 || (error.error && error.error.type === 'insufficient_quota')) {
      return NextResponse.json(
        { 
          error: "OpenAI API rate limit exceeded. Please try again in a moment.",
          type: "rate_limit" 
        }, 
        { status: 429 }
      );
    }
    
    if (error.status === 401) {
      return NextResponse.json(
        { 
          error: "OpenAI API key invalid or missing. Please check your configuration.",
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

// Generate post content using GPT-4o with advanced analysis
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

## TIM FERRISS CONCLUSION STYLE GUIDE
Tim Ferriss is known for ending his content with practical, actionable conclusions. Key characteristics:

**Structure Patterns:**
- "The bottom line:" + practical takeaway
- "Try this:" + specific experiment or action
- "Here's the experiment:" + step-by-step challenge
- "Your move:" + direct call to action
- "The 80/20:" + focusing on the most impactful elements

**Style Elements:**
- Direct, no-fluff language
- Specific timeframes ("next 30 days", "this week")
- Measurable actions ("track X for 7 days", "try Y technique 3 times")
- Often includes frameworks or systems
- Challenges conventional wisdom
- Emphasizes experimentation and testing

**Example Tim Ferriss Conclusions:**
- "The bottom line: Most productivity advice is garbage. Try this instead: Pick ONE task tomorrow that scares you most. Do it first. Track how you feel at noon."
- "Here's the experiment: For the next 7 days, end every meeting 5 minutes early. Use those minutes to immediately capture your next action. Measure the difference."
- "Your move: Stop planning. Start testing. Pick one idea from this post and implement it before Thursday. Then tell me what happened."

## YOUR INSTRUCTIONS
1. MAINTAIN the user's authentic voice and style
2. INCORPORATE proven engagement elements from trending posts
3. OPTIMIZE for LinkedIn's algorithm (engagement, comments, shares)
4. STRUCTURE content for readability (line breaks, formatting)
5. **NEVER use emojis** - keep the content clean and professional
6. **NEVER use hashtags** - focus on organic reach through quality content
7. **CRITICAL**: Always start with a compelling hook using the expert knowledge above. Choose the hook style that best matches the user's voice and the content topic.
8. **LIST FORMATTING**: When creating numbered or bulleted lists, write each point as a unified thought in 2-3 complete sentences. NEVER use the "Title: Description" format. Instead, write flowing, cohesive thoughts that stand alone.

   WRONG: "1. Fear of Failure: Embrace mistakes as stepping stones for growth."
   RIGHT: "1. Many leaders avoid taking risks because they fear making mistakes. This mindset actually limits growth and innovation. The most successful leaders I know treat failures as essential learning experiences that build resilience."
9. **CONCLUSION STYLE**: End every post with a Tim Ferriss-style conclusion that is:
   - Direct and actionable
   - Includes a specific challenge, experiment, or next step
   - Uses his signature style of practical frameworks
   - Often includes phrases like "Try this:", "The bottom line:", "Here's the experiment:", or "Your move:"

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
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = new Set([...words1, ...words2]).size;
  
  return commonWords.length / totalWords;
}