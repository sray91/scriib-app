import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

// Import modular functions
import { fetchUserPastPosts, fetchUserTrainingDocuments, fetchTrendingPosts, validateUserAccess } from './lib/database.js';
import { generatePostContentWithClaude } from './lib/generators.js';

// Configure the API route for AI processing
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Maximum allowed for hobby plan (60 seconds)

export async function POST(req) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    // Parse request body
    const body = await req.json();
    const { userMessage, currentDraft, action = 'create', contextUserId } = body;

    // Validate input
    if (!userMessage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Determine which user's context to use (current user or contextUserId)
    let targetUserId = userId;

    if (contextUserId && contextUserId !== userId) {
      // Validate that current user has access to the contextUserId's data
      const hasAccess = await validateUserAccess(supabase, userId, contextUserId);

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied: You do not have permission to use this user\'s context data' },
          { status: 403 }
        );
      }

      targetUserId = contextUserId;
      console.log(`🔐 Access validated: User ${user.id} can access context from user ${contextUserId}`);
    }

    console.log(`🚀 CoCreate Model Ensemble request from user ${user.id} using context from user ${targetUserId}: "${userMessage}"`);

    // Fetch target user's past posts from database to analyze their voice
    const pastPosts = await fetchUserPastPosts(supabase, targetUserId);
    console.log(`📚 Found ${pastPosts.length} past posts for voice analysis from user ${targetUserId}`);

    // Fetch target user's training documents for enhanced voice analysis (limit for performance)
    const trainingDocuments = await fetchUserTrainingDocuments(supabase, targetUserId);
    console.log(`📄 Found ${trainingDocuments.length} training documents for enhanced voice analysis from user ${targetUserId}`);
    
    // Limit training documents to prevent timeouts (max 8 docs, max 100k words total)
    const limitedTrainingDocs = trainingDocuments
      .slice(0, 8)
      .filter(doc => doc.word_count <= 25000)
      .reduce((acc, doc) => {
        const totalWords = acc.reduce((sum, d) => sum + d.word_count, 0);
        if (totalWords + doc.word_count <= 100000) {
          acc.push(doc);
        }
        return acc;
      }, []);
    
    console.log(`📊 Training document filtering:`, {
      originalCount: trainingDocuments.length,
      afterSlice: Math.min(trainingDocuments.length, 8),
      afterWordFilter: trainingDocuments.filter(doc => doc.word_count <= 25000).length,
      finalCount: limitedTrainingDocs.length,
      skippedDocs: trainingDocuments.filter(doc => doc.word_count > 25000).map(d => ({ name: d.file_name, words: d.word_count }))
    });
    
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
    
    // === CLAUDE SONNET 4 APPROACH ===
    console.log('🔀 Initializing Claude Sonnet 4 for content generation...');
    
    // Generate post content using Claude Sonnet 4
    const result = await generatePostContentWithClaude(
      userMessage,
      currentDraft,
      action,
      pastPosts,
      trendingPosts,
      limitedTrainingDocs,
      targetUserId,
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
      contextGuideUsed: result.contextGuideUsed,
      model: result.model
    });
    
  } catch (error) {
    console.error('Error in CoCreate Claude API:', error);
    
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