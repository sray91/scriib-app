/**
 * CoCreate v2 API Route
 *
 * World-class post generation using the new pipeline architecture:
 * - Unified voice profiles
 * - Sufficiency checks before generation
 * - Quality gates with review
 * - Anti-fabrication safeguards
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { generatePost, refineContent } from '@/lib/generation/pipeline';
import { fetchUserPastPosts, fetchUserTrainingDocuments, validateUserAccess } from '../lib/database.js';

// Configure the API route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req) {
  const startTime = Date.now();

  try {
    // Authenticate
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    // Parse request
    const body = await req.json();
    const {
      userMessage,
      currentDraft,
      action = 'create',
      contextUserId,
      // New v2 options
      skipSufficiencyCheck = false,
      skipQualityReview = false,
      proceedWithoutQuestions = false,
      forceVoiceUpdate = false
    } = body;

    // Validate input
    if (!userMessage) {
      return NextResponse.json(
        { error: 'Missing required field: userMessage' },
        { status: 400 }
      );
    }

    // Determine target user (for ghostwriter support)
    let targetUserId = userId;
    if (contextUserId && contextUserId !== userId) {
      const hasAccess = await validateUserAccess(supabase, userId, contextUserId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied: You do not have permission to use this user\'s voice' },
          { status: 403 }
        );
      }
      targetUserId = contextUserId;
    }

    console.log(`🚀 CoCreate v2: User ${userId} generating with voice of ${targetUserId}`);

    // Gather sources
    const [pastPosts, trainingDocs, contextGuideResult] = await Promise.all([
      fetchUserPastPosts(supabase, targetUserId),
      fetchUserTrainingDocuments(supabase, targetUserId),
      supabase
        .from('user_preferences')
        .select('settings')
        .eq('user_id', targetUserId)
        .single()
    ]);

    const contextGuide = contextGuideResult.data?.settings?.contextGuide || null;

    // Limit training docs to prevent timeouts
    const limitedTrainingDocs = trainingDocs
      .slice(0, 8)
      .filter(doc => doc.word_count <= 25000)
      .reduce((acc, doc) => {
        const totalWords = acc.reduce((sum, d) => sum + d.word_count, 0);
        if (totalWords + doc.word_count <= 100000) acc.push(doc);
        return acc;
      }, []);

    console.log(`📊 Sources: ${pastPosts.length} posts, ${limitedTrainingDocs.length} docs, ${contextGuide ? 'has guide' : 'no guide'}`);

    // Run the generation pipeline
    const result = await generatePost({
      userRequest: userMessage,
      userId,
      targetUserId,
      supabase,
      sources: {
        pastPosts,
        trainingDocs: limitedTrainingDocs,
        contextGuide
      },
      currentDraft,
      action,
      options: {
        skipSufficiencyCheck,
        skipQualityReview,
        proceedWithoutQuestions,
        forceVoiceUpdate
      }
    });

    // Handle result
    if (!result.success) {
      console.error('Generation failed:', result.error);
      return NextResponse.json(
        {
          error: result.error,
          steps: result.steps
        },
        { status: 500 }
      );
    }

    // If we need more info from the user
    if (result.needsMoreInfo) {
      return NextResponse.json({
        success: true,
        needsMoreInfo: true,
        questions: result.questions,
        contentType: result.contentType,
        draftContent: result.draftContent || null,
        voiceProfile: result.voiceProfile,
        steps: result.steps,
        duration: result.duration
      });
    }

    // Success - return generated content
    return NextResponse.json({
      success: true,
      content: result.content,
      confidence: result.confidence,
      missingInfo: result.missingInfo,
      qualityScore: result.qualityScore,
      qualityVerdict: result.qualityVerdict,
      voiceProfile: result.voiceProfile,
      steps: result.steps,
      duration: result.duration,
      metadata: result.metadata,

      // Legacy field mappings for backwards compatibility
      updatedPost: result.content,
      message: `Generated ${action === 'create' ? 'new' : 'refined'} post with ${result.confidence} confidence`,
      isSignificantUpdate: action === 'create' || result.confidence !== 'low'
    });

  } catch (error) {
    console.error('CoCreate v2 error:', error);

    // Handle specific errors
    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.', type: 'rate_limit' },
        { status: 429 }
      );
    }

    if (error.status === 401) {
      return NextResponse.json(
        { error: 'API authentication failed.', type: 'auth_error' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate content. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        type: 'generation_error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for voice profile status
 */
export async function GET(req) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { userId, supabase } = auth;

    // Get voice profile
    const { data: profile, error } = await supabase
      .from('user_voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Get source counts
    const [postsResult, docsResult, prefsResult] = await Promise.all([
      supabase.from('past_posts').select('id', { count: 'exact' }).eq('user_id', userId),
      supabase.from('training_documents').select('id', { count: 'exact' }).eq('user_id', userId).eq('is_active', true),
      supabase.from('user_preferences').select('settings').eq('user_id', userId).single()
    ]);

    return NextResponse.json({
      hasProfile: !!profile,
      profileVersion: profile?.version || 0,
      lastUpdated: profile?.updated_at || null,
      sources: {
        pastPosts: postsResult.count || 0,
        trainingDocs: docsResult.count || 0,
        hasContextGuide: !!prefsResult.data?.settings?.contextGuide
      },
      voiceProfile: profile ? {
        writingStyle: profile.writing_style,
        tone: profile.tone,
        formatting: profile.formatting
      } : null
    });

  } catch (error) {
    console.error('Voice profile GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voice profile status' },
      { status: 500 }
    );
  }
}
