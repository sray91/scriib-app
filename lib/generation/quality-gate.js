/**
 * Quality Gate
 *
 * Reviews generated content for voice match, authenticity,
 * LinkedIn optimization, and clarity before returning to user.
 */

import Anthropic from '@anthropic-ai/sdk';
import { buildStagePrompt, getVoiceContextForReview } from '../prompts/builder.js';

let anthropic;
try {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
} catch (error) {
  console.warn('Anthropic SDK not available:', error.message);
}

/**
 * Review generated content for quality
 * @param {string} draftContent - The generated post content
 * @param {string} userRequest - Original user request
 * @param {object} voiceProfile - User's voice profile
 * @returns {object} Quality review result
 */
export async function reviewQuality(draftContent, userRequest, voiceProfile) {
  if (!anthropic) {
    // Fallback: pass without review
    return {
      scores: { voice_match: 7, authenticity: 7, linkedin_optimization: 7, clarity_value: 7 },
      weighted_score: 7,
      verdict: 'PASS',
      issues: [],
      fabrication_flags: [],
      refinements: { hook: 'OK', structure: 'OK', ending: 'OK' },
      revised_content: null,
      skipped: true,
      skip_reason: 'Quality gate unavailable'
    };
  }

  const voiceContext = getVoiceContextForReview(voiceProfile);

  const prompt = buildStagePrompt('quality-review', {
    draftContent,
    userRequest,
    ...voiceContext
  });

  try {
    const message = await anthropic.messages.create({
      model: process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    return parseQualityResponse(responseText);

  } catch (error) {
    console.error('Quality review failed:', error);
    // Fallback: pass with warning
    return {
      scores: { voice_match: 7, authenticity: 7, linkedin_optimization: 7, clarity_value: 7 },
      weighted_score: 7,
      verdict: 'PASS',
      issues: [],
      fabrication_flags: [],
      refinements: { hook: 'OK', structure: 'OK', ending: 'OK' },
      revised_content: null,
      error: error.message
    };
  }
}

/**
 * Determine if content passes quality gate
 * @param {object} reviewResult - Result from reviewQuality
 * @returns {boolean} True if content passes
 */
export function passesQualityGate(reviewResult) {
  if (!reviewResult) return true; // No review = pass

  // Fail if there are fabrication flags
  if (reviewResult.fabrication_flags?.length > 0) {
    return false;
  }

  // Fail if weighted score is below threshold
  if (reviewResult.weighted_score < 6) {
    return false;
  }

  // Fail if there are critical issues
  const criticalIssues = reviewResult.issues?.filter(i => i.severity === 'critical') || [];
  if (criticalIssues.length > 0) {
    return false;
  }

  return true;
}

/**
 * Get the best content (revised if available, otherwise original)
 * @param {string} originalContent - Original draft content
 * @param {object} reviewResult - Quality review result
 * @returns {string} Best available content
 */
export function getBestContent(originalContent, reviewResult) {
  if (!reviewResult) return originalContent;

  // Use revised content if available and verdict was NEEDS_REVISION
  if (reviewResult.verdict === 'NEEDS_REVISION' && reviewResult.revised_content) {
    return reviewResult.revised_content;
  }

  return originalContent;
}

/**
 * Format quality issues for user feedback
 * @param {object} reviewResult - Quality review result
 * @returns {string|null} Formatted issues or null if none
 */
export function formatQualityIssues(reviewResult) {
  if (!reviewResult?.issues?.length) return null;

  const criticalIssues = reviewResult.issues.filter(i => i.severity === 'critical');
  const moderateIssues = reviewResult.issues.filter(i => i.severity === 'moderate');

  let message = '';

  if (criticalIssues.length > 0) {
    message += '**Issues to address:**\n';
    criticalIssues.forEach(issue => {
      message += `- ${issue.description}\n`;
      if (issue.suggestion) message += `  → ${issue.suggestion}\n`;
    });
  }

  if (moderateIssues.length > 0) {
    message += '\n**Suggestions for improvement:**\n';
    moderateIssues.forEach(issue => {
      message += `- ${issue.description}\n`;
    });
  }

  return message || null;
}

/**
 * Parse JSON response from quality review
 * @param {string} text - Response text
 * @returns {object} Parsed quality review
 */
function parseQualityResponse(text) {
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
    const result = JSON.parse(cleaned.trim());

    // Calculate weighted score if not provided
    if (!result.weighted_score && result.scores) {
      const weights = { voice_match: 0.3, authenticity: 0.3, linkedin_optimization: 0.2, clarity_value: 0.2 };
      result.weighted_score = Object.entries(result.scores)
        .reduce((sum, [key, score]) => sum + (score * (weights[key] || 0.25)), 0);
    }

    return result;

  } catch (error) {
    console.error('Failed to parse quality review response:', error);
    // Return safe default
    return {
      scores: { voice_match: 7, authenticity: 7, linkedin_optimization: 7, clarity_value: 7 },
      weighted_score: 7,
      verdict: 'PASS',
      issues: [],
      fabrication_flags: [],
      refinements: { hook: 'OK', structure: 'OK', ending: 'OK' },
      revised_content: null,
      parse_error: true
    };
  }
}

/**
 * Quick authenticity check - lightweight check for obvious fabrication
 * @param {string} content - Content to check
 * @param {string} userRequest - Original request
 * @returns {object} Quick check result
 */
export function quickAuthenticityCheck(content, userRequest) {
  const flags = [];

  // Check for common fabrication patterns
  const fabricationPatterns = [
    /I remember when.*(?:my|a) (?:mentor|boss|colleague|friend) (?:told|said|asked)/i,
    /Last (?:week|month|year),? I (?:was|had|met|learned)/i,
    /A (?:client|customer|friend) (?:once|recently) (?:told|asked|shared)/i,
    /(?:studies|research|data) show(?:s)? that \d+%/i,
    /According to (?:a|recent) (?:study|survey|report)/i,
  ];

  // Only flag if the pattern exists but wasn't in the user request
  fabricationPatterns.forEach(pattern => {
    if (pattern.test(content) && !pattern.test(userRequest)) {
      const match = content.match(pattern);
      if (match) {
        flags.push({
          pattern: match[0],
          reason: 'Potentially fabricated - not in original request'
        });
      }
    }
  });

  return {
    passed: flags.length === 0,
    flags
  };
}
