import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export const maxDuration = 60; // Allow more time for synthesis

export async function POST(req) {
  const startTime = Date.now();
  
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
    
    console.log(`🧠 Context guide synthesis request from user ${user.id}`);
    
    // Gather all training data
    const trainingData = await gatherAllTrainingData(supabase, user.id);
    
    // Synthesize context guide using Claude
    const synthesizedGuide = await synthesizeContextGuide(trainingData, user.id);
    
    // Save to user preferences
    await saveContextGuide(supabase, user.id, synthesizedGuide);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      contextGuide: synthesizedGuide,
      processingTimeMs: processingTime,
      dataAnalyzed: {
        trendingPosts: trainingData.trendingPosts.length,
        documents: trainingData.documents.length,
        myPosts: trainingData.myPosts.length,
        totalDataPoints: trainingData.trendingPosts.length + trainingData.documents.length + trainingData.myPosts.length
      }
    });
    
  } catch (error) {
    console.error('Error in Context Guide Synthesis API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to synthesize context guide' },
      { status: 500 }
    );
  }
}

/**
 * Gather all training data from different sources
 */
async function gatherAllTrainingData(supabase, userId) {
  console.log('📊 Gathering training data...');
  
  // Get trending posts (training data)
  const { data: trendingPosts } = await supabase
    .from('trending_posts')
    .select('content, author_name, likes, comments, shares, engagement_rate, created_at')
    .eq('is_active', true)
    .order('engagement_rate', { ascending: false })
    .limit(20);

  // Get context documents
  const { data: documents } = await supabase
    .from('training_documents')
    .select('file_name, extracted_text, file_type, word_count, description')
    .eq('user_id', userId)
    .eq('processing_status', 'completed')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get user's LinkedIn posts
  const { data: myPosts } = await supabase
    .from('linkedin_posts')
    .select('content, engagement_metrics, created_at, post_url')
    .eq('user_id', userId)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(15);

  console.log(`📈 Found: ${trendingPosts?.length || 0} trending posts, ${documents?.length || 0} documents, ${myPosts?.length || 0} user posts`);

  return {
    trendingPosts: trendingPosts || [],
    documents: documents || [],
    myPosts: myPosts || []
  };
}

/**
 * Synthesize context guide using Claude
 */
async function synthesizeContextGuide(trainingData, userId) {
  if (!anthropic) {
    throw new Error('Claude API not available');
  }

  const { trendingPosts, documents, myPosts } = trainingData;
  const hasData = trendingPosts.length > 0 || documents.length > 0 || myPosts.length > 0;

  let prompt = `You are an expert content strategist tasked with creating a personalized LinkedIn content creation guide. Your goal is to analyze the provided data and create a comprehensive context guide that captures the user's unique voice, style, and content strategy.

`;

  if (hasData) {
    prompt += `TRAINING DATA TO ANALYZE:

`;

    // Add trending posts analysis
    if (trendingPosts.length > 0) {
      prompt += `HIGH-PERFORMING POSTS (for inspiration and format analysis):
${trendingPosts.map((post, i) => 
  `${i + 1}. Author: ${post.author_name || 'Unknown'}
Content: "${post.content.substring(0, 300)}${post.content.length > 300 ? '...' : ''}"
Engagement: ${post.likes} likes, ${post.comments} comments, ${post.shares} shares
Engagement Rate: ${post.engagement_rate || 'N/A'}%
---`
).join('\n\n')}

`;
    }

    // Add user's own posts
    if (myPosts.length > 0) {
      prompt += `USER'S OWN POSTS (primary voice and style reference):
${myPosts.map((post, i) => 
  `${i + 1}. "${post.content.substring(0, 400)}${post.content.length > 400 ? '...' : ''}"
Engagement: ${post.engagement_metrics ? JSON.stringify(post.engagement_metrics) : 'N/A'}
Date: ${new Date(post.created_at).toLocaleDateString()}
---`
).join('\n\n')}

`;
    }

    // Add documents analysis
    if (documents.length > 0) {
      prompt += `CONTEXT DOCUMENTS (voice and expertise reference):
${documents.map((doc, i) => 
  `${i + 1}. File: ${doc.file_name} (${doc.file_type.toUpperCase()}, ${doc.word_count} words)
${doc.description ? `Description: ${doc.description}` : ''}
Content Sample: "${doc.extracted_text.substring(0, 500)}${doc.extracted_text.length > 500 ? '...' : ''}"
---`
).join('\n\n')}

`;
    }

    prompt += `TASK: Analyze the above data and create a comprehensive context guide that:

1. **CAPTURES VOICE & TONE**: Identify the user's unique communication style from their posts and documents
2. **IDENTIFIES THEMES**: Extract the main topics and expertise areas the user covers
3. **ANALYZES FORMATS**: Note preferred content structures and formats from successful posts
4. **DEFINES AUDIENCE**: Infer target audience based on content and engagement patterns
5. **EXTRACTS STRATEGIES**: Identify what makes content successful based on high-performing examples
6. **PERSONALIZES APPROACH**: Create specific guidelines that reflect the user's unique perspective

`;
  } else {
    prompt += `NO TRAINING DATA AVAILABLE - CREATE GENERIC BUT EFFECTIVE GUIDE

Since no specific training data is available, create a comprehensive context guide that follows LinkedIn best practices and will help generate high-quality, engaging posts. Focus on proven strategies that work across industries and audiences.

TASK: Create a professional context guide that:

1. **ESTABLISHES PROFESSIONAL VOICE**: Clear, confident, and authentic tone
2. **COVERS VERSATILE THEMES**: Business insights, professional development, industry trends
3. **INCLUDES PROVEN FORMATS**: Stories, tips, insights, questions that drive engagement
4. **TARGETS PROFESSIONALS**: Business professionals, entrepreneurs, industry experts
5. **FOLLOWS BEST PRACTICES**: Proven LinkedIn content strategies and engagement tactics

`;
  }

  prompt += `OUTPUT FORMAT: Create a detailed context guide in markdown format with these sections:

# My Content Creation Guide

## Voice & Tone
[Specific voice characteristics, tone preferences, communication style]

## Content Themes
[Main topics, expertise areas, subject matter focus]

## Writing Style
[Sentence structure, vocabulary, formatting preferences, storytelling approach]

## Target Audience
[Detailed audience description, professional level, interests, pain points]

## Content Formats I Prefer
[Specific post types, structures, and formats that work best]

## Topics I Cover
[Specific subject areas, industry insights, expertise domains]

## Engagement Strategy
[How to start posts, call-to-action preferences, interaction style]

## Content Calendar Approach
[Posting frequency, content mix, seasonal considerations]

## Unique Perspective
[What makes this voice distinctive, unique angles, personal brand elements]

## Topics to Avoid
[Any content areas to stay away from, tone to avoid]

Make this guide specific, actionable, and comprehensive. Include concrete examples where possible. The guide should be detailed enough that an AI can use it to generate content that sounds authentically like this person.

Return only the markdown content guide, no additional commentary.`;

  try {
    console.log('🤖 Calling Claude for context guide synthesis...');
    
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const synthesizedGuide = response.content[0].text;
    console.log(`✅ Context guide synthesized (${synthesizedGuide.length} characters)`);
    
    return synthesizedGuide;

  } catch (error) {
    console.error('Error calling Claude:', error);
    throw new Error(`Failed to synthesize context guide: ${error.message}`);
  }
}

/**
 * Save context guide to user preferences
 */
async function saveContextGuide(supabase, userId, contextGuide) {
  try {
    // Get existing preferences
    const { data: existingPrefs } = await supabase
      .from('user_preferences')
      .select('settings')
      .eq('user_id', userId)
      .single();

    const updatedSettings = {
      ...(existingPrefs?.settings || {}),
      contextGuide: contextGuide.trim(),
      lastTrainingDate: new Date().toISOString()
    };

    // Upsert the preferences
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        settings: updatedSettings,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    console.log('💾 Context guide saved to user preferences');
    
  } catch (error) {
    console.error('Error saving context guide:', error);
    throw new Error(`Failed to save context guide: ${error.message}`);
  }
}

