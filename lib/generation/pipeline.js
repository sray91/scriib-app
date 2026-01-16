/**
 * Generation Pipeline
 *
 * Orchestrates the complete post generation flow:
 * 1. Voice Profile Loading/Update
 * 2. Sufficiency Check
 * 3. Content Draft Generation
 * 4. Quality Review
 * 5. Final Output
 */

import Anthropic from '@anthropic-ai/sdk';
import { getVoiceProfile, getVoiceProfileWithAccess } from '../voice/profile-store.js';
import { analyzeAndUpdateVoiceProfile, getSimplifiedVoice } from '../voice/analyzer.js';
import { checkSufficiency, shouldAskQuestions, formatQuestionsForUser } from './sufficiency-check.js';
import { reviewQuality, passesQualityGate, getBestContent, quickAuthenticityCheck } from './quality-gate.js';
import { buildSystemPrompt, buildStagePrompt } from '../prompts/builder.js';

let anthropic;
try {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
} catch (error) {
  console.warn('Anthropic SDK not available:', error.message);
}

/**
 * Main generation pipeline
 * @param {object} params - Generation parameters
 * @param {string} params.userRequest - What the user wants to write about
 * @param {string} params.userId - User making the request
 * @param {string} params.targetUserId - User whose voice to use (for ghostwriters)
 * @param {object} params.supabase - Supabase client
 * @param {object} params.sources - Content sources { pastPosts, trainingDocs, contextGuide }
 * @param {string} params.currentDraft - Existing draft (for refinement)
 * @param {string} params.action - 'create' or 'refine'
 * @param {object} params.options - Additional options
 * @returns {object} Generation result
 */
export async function generatePost(params) {
  const {
    userRequest,
    userId,
    targetUserId = userId,
    supabase,
    sources = {},
    currentDraft = null,
    action = 'create',
    options = {}
  } = params;

  const steps = [];
  const startTime = Date.now();

  try {
    // ========== STAGE 1: Voice Profile ==========
    steps.push({ stage: 'voice_profile', status: 'started', timestamp: Date.now() });

    let voiceProfile;

    // Check access if using someone else's voice
    if (targetUserId !== userId) {
      voiceProfile = await getVoiceProfileWithAccess(supabase, userId, targetUserId);
      if (!voiceProfile) {
        return {
          success: false,
          error: 'Access denied to target user voice profile',
          steps
        };
      }
    } else {
      voiceProfile = await getVoiceProfile(supabase, userId);
    }

    // Update voice profile if we have new sources
    if (sources.pastPosts?.length || sources.trainingDocs?.length || sources.contextGuide) {
      voiceProfile = await analyzeAndUpdateVoiceProfile(
        supabase,
        targetUserId,
        sources,
        options.forceVoiceUpdate || false
      );
      steps.push({ stage: 'voice_profile', status: 'updated', timestamp: Date.now() });
    } else if (!voiceProfile) {
      // No sources and no profile - create minimal profile
      voiceProfile = await analyzeAndUpdateVoiceProfile(supabase, targetUserId, {});
      steps.push({ stage: 'voice_profile', status: 'created_default', timestamp: Date.now() });
    } else {
      steps.push({ stage: 'voice_profile', status: 'loaded_existing', timestamp: Date.now() });
    }

    const simplifiedVoice = getSimplifiedVoice(voiceProfile);

    // ========== STAGE 2: Sufficiency Check ==========
    if (!options.skipSufficiencyCheck) {
      steps.push({ stage: 'sufficiency_check', status: 'started', timestamp: Date.now() });

      const sufficiency = await checkSufficiency(userRequest, {
        contextGuide: sources.contextGuide,
        pastPostsCount: sources.pastPosts?.length || 0,
        additionalContext: currentDraft ? `Current draft: ${currentDraft}` : null
      });

      steps.push({
        stage: 'sufficiency_check',
        status: 'completed',
        result: sufficiency,
        timestamp: Date.now()
      });

      // If we should ask questions, return them instead of generating
      if (shouldAskQuestions(sufficiency) && !options.proceedWithoutQuestions) {
        const questions = formatQuestionsForUser(sufficiency);
        return {
          success: true,
          needsMoreInfo: true,
          questions,
          contentType: sufficiency.detected_content_type,
          steps,
          voiceProfile: simplifiedVoice,
          duration: Date.now() - startTime
        };
      }
    }

    // ========== STAGE 3: Content Generation ==========
    steps.push({ stage: 'content_generation', status: 'started', timestamp: Date.now() });

    const generationResult = await generateDraft({
      userRequest,
      voiceProfile,
      contextGuide: sources.contextGuide,
      postExamples: sources.pastPosts?.slice(0, 5).map(p => p.content),
      currentDraft,
      action,
      targetLength: voiceProfile?.content_preferences?.typical_post_length || 800
    });

    steps.push({
      stage: 'content_generation',
      status: 'completed',
      confidence: generationResult.confidence,
      timestamp: Date.now()
    });

    // Quick authenticity check
    const quickCheck = quickAuthenticityCheck(generationResult.content, userRequest);
    if (!quickCheck.passed) {
      steps.push({
        stage: 'quick_auth_check',
        status: 'flags_detected',
        flags: quickCheck.flags,
        timestamp: Date.now()
      });
    }

    // ========== STAGE 4: Quality Review ==========
    let finalContent = generationResult.content;
    let qualityResult = null;

    if (!options.skipQualityReview) {
      steps.push({ stage: 'quality_review', status: 'started', timestamp: Date.now() });

      qualityResult = await reviewQuality(
        generationResult.content,
        userRequest,
        voiceProfile
      );

      steps.push({
        stage: 'quality_review',
        status: 'completed',
        verdict: qualityResult.verdict,
        score: qualityResult.weighted_score,
        timestamp: Date.now()
      });

      // Use revised content if available
      finalContent = getBestContent(generationResult.content, qualityResult);

      // If quality gate fails badly, indicate we need user input
      if (qualityResult.verdict === 'NEEDS_USER_INPUT') {
        return {
          success: true,
          needsMoreInfo: true,
          questions: qualityResult.fabrication_flags?.length > 0
            ? "I noticed I might be making assumptions. Could you provide more specific details about your experience?"
            : "To make this post more authentic, could you share more specific details?",
          draftContent: finalContent,
          qualityIssues: qualityResult.issues,
          steps,
          voiceProfile: simplifiedVoice,
          duration: Date.now() - startTime
        };
      }
    }

    // ========== STAGE 5: Return Result ==========
    return {
      success: true,
      content: finalContent,
      confidence: generationResult.confidence,
      missingInfo: generationResult.missingInfo,
      qualityScore: qualityResult?.weighted_score || null,
      qualityVerdict: qualityResult?.verdict || 'NOT_REVIEWED',
      steps,
      voiceProfile: simplifiedVoice,
      duration: Date.now() - startTime,
      metadata: {
        action,
        targetUserId,
        voiceProfileVersion: voiceProfile?.version || 1,
        contentType: generationResult.contentType
      }
    };

  } catch (error) {
    console.error('Generation pipeline error:', error);
    steps.push({
      stage: 'error',
      error: error.message,
      timestamp: Date.now()
    });

    return {
      success: false,
      error: error.message,
      steps,
      duration: Date.now() - startTime
    };
  }
}

/**
 * Generate content draft using Claude
 * @param {object} params - Generation parameters
 * @returns {object} Draft result { content, confidence, missingInfo }
 */
async function generateDraft(params) {
  const {
    userRequest,
    voiceProfile,
    contextGuide,
    postExamples,
    currentDraft,
    action,
    targetLength
  } = params;

  if (!anthropic) {
    throw new Error('Anthropic client not initialized');
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt(voiceProfile);

  const userPrompt = buildStagePrompt('content-draft', {
    userRequest,
    currentDraft,
    userFeedback: action === 'refine' ? userRequest : null,
    contextGuide,
    postExamples,
    targetLength
  });

  // Generate content
  const message = await anthropic.messages.create({
    model: process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  const responseText = message.content[0].text;

  // Parse the structured response
  return parseGenerationResponse(responseText);
}

/**
 * Parse the generation response to extract content and metadata
 * @param {string} response - Raw response from Claude
 * @returns {object} Parsed result
 */
function parseGenerationResponse(response) {
  let content = response;
  let confidence = 'medium';
  let missingInfo = [];

  // Try to extract structured sections
  const contentMatch = response.match(/\[POST_CONTENT\]([\s\S]*?)\[\/POST_CONTENT\]/);
  if (contentMatch) {
    content = contentMatch[1].trim();
  }

  const confidenceMatch = response.match(/\[CONFIDENCE\]\s*(high|medium|low)\s*.*?\[\/CONFIDENCE\]/i);
  if (confidenceMatch) {
    confidence = confidenceMatch[1].toLowerCase();
  }

  const missingMatch = response.match(/\[MISSING_INFO\]([\s\S]*?)\[\/MISSING_INFO\]/);
  if (missingMatch) {
    const missingText = missingMatch[1].trim();
    if (!missingText.toLowerCase().includes('none')) {
      missingInfo = missingText
        .split('\n')
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 0);
    }
  }

  // Check for [NEEDS: ...] markers in content
  const needsMatches = content.match(/\[NEEDS:\s*([^\]]+)\]/g);
  if (needsMatches) {
    missingInfo = [...missingInfo, ...needsMatches.map(m => m.replace(/\[NEEDS:\s*|\]/g, ''))];
  }

  return {
    content,
    confidence,
    missingInfo: missingInfo.length > 0 ? missingInfo : null
  };
}

/**
 * Simple refinement - refine existing content without full pipeline
 * @param {string} content - Current content
 * @param {string} feedback - User's feedback
 * @param {object} voiceProfile - Voice profile
 * @returns {object} Refined content
 */
export async function refineContent(content, feedback, voiceProfile) {
  if (!anthropic) {
    throw new Error('Anthropic client not initialized');
  }

  const systemPrompt = buildSystemPrompt(voiceProfile);

  const userPrompt = `Current post:
${content}

User feedback:
${feedback}

Refine the post based on the feedback while maintaining the voice profile. Return only the updated post content.`;

  const message = await anthropic.messages.create({
    model: process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  return {
    content: message.content[0].text.trim(),
    confidence: 'high'
  };
}
