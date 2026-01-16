/**
 * Sufficiency Check
 *
 * Verifies we have enough information to write an authentic post
 * before proceeding to content generation.
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildStagePrompt } from '../prompts/builder.js';

let anthropic;
try {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
} catch (error) {
  console.warn('Anthropic SDK not available:', error.message);
}

/**
 * Check if we have sufficient information to generate the requested content
 * @param {string} userRequest - What the user wants to write about
 * @param {object} context - Available context { contextGuide, pastPostsCount, additionalContext }
 * @returns {object} Sufficiency analysis result
 */
export async function checkSufficiency(userRequest, context = {}) {
  if (!anthropic) {
    // Fallback: allow proceeding with warning
    return {
      detected_content_type: 'unknown',
      can_write_authentically: true,
      confidence: 'low',
      recommendation: 'proceed',
      questions_to_ask: [],
      writing_guidance: 'Proceed with caution - sufficiency check unavailable'
    };
  }

  const prompt = buildStagePrompt('sufficiency-check', {
    userRequest,
    contextGuide: context.contextGuide || null,
    contextGuideWords: context.contextGuide ? context.contextGuide.split(/\s+/).length : 0,
    pastPostsCount: context.pastPostsCount || 0,
    additionalContext: context.additionalContext || null
  });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-3-5-20241022', // Use Haiku for fast, cheap check
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    return parseJsonResponse(responseText);

  } catch (error) {
    console.error('Sufficiency check failed:', error);
    // Fallback: allow proceeding
    return {
      detected_content_type: 'unknown',
      can_write_authentically: true,
      confidence: 'low',
      recommendation: 'proceed',
      questions_to_ask: [],
      writing_guidance: 'Proceed - sufficiency check encountered an error',
      error: error.message
    };
  }
}

/**
 * Determine if we should ask questions before generating
 * @param {object} sufficiencyResult - Result from checkSufficiency
 * @returns {boolean} True if we should ask questions first
 */
export function shouldAskQuestions(sufficiencyResult) {
  if (!sufficiencyResult) return false;

  // Always ask if recommendation is to ask
  if (sufficiencyResult.recommendation === 'ask_questions') {
    return true;
  }

  // Ask if confidence is low and we have questions to ask
  if (sufficiencyResult.confidence === 'low' &&
      sufficiencyResult.questions_to_ask?.length > 0) {
    return true;
  }

  // Ask if it's a personal story without specific details
  if (sufficiencyResult.detected_content_type === 'personal_story' &&
      sufficiencyResult.confidence !== 'high') {
    return true;
  }

  return false;
}

/**
 * Format questions for user display
 * @param {object} sufficiencyResult - Result from checkSufficiency
 * @returns {string} Formatted questions message
 */
export function formatQuestionsForUser(sufficiencyResult) {
  if (!sufficiencyResult?.questions_to_ask?.length) {
    return null;
  }

  const questions = sufficiencyResult.questions_to_ask;
  const intro = "To write this post authentically, I need a few more details:";

  const questionList = questions.map((q, i) =>
    `${i + 1}. ${q.question}`
  ).join('\n');

  const outro = "\nThis will help me write something that's genuinely yours, not generic advice.";

  return `${intro}\n\n${questionList}${outro}`;
}

/**
 * Parse JSON response from Claude, handling markdown code blocks
 * @param {string} text - Response text
 * @returns {object} Parsed JSON
 */
function parseJsonResponse(text) {
  let cleaned = text.trim();

  // Remove markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  try {
    return JSON.parse(cleaned.trim());
  } catch (error) {
    console.error('Failed to parse sufficiency check response:', error);
    // Return safe default
    return {
      detected_content_type: 'unknown',
      can_write_authentically: true,
      confidence: 'low',
      recommendation: 'proceed',
      questions_to_ask: [],
      writing_guidance: 'Could not parse response - proceeding with caution'
    };
  }
}
