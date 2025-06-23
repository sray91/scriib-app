import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Import modular functions
import { fetchUserPastPosts, fetchUserTrainingDocuments, fetchTrendingPosts } from './lib/database.js';
import { generateWithModelEnsemble } from './lib/ensemble.js';

// Configure the API route for AI processing
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Maximum allowed for hobby plan (60 seconds)

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