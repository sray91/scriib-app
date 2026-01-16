/**
 * Prompt Builder
 *
 * Composes modular prompts from templates for the generation pipeline.
 * Uses a simple handlebars-like syntax for variable substitution.
 */

import fs from 'fs';
import path from 'path';

// Cache loaded templates
const templateCache = new Map();

/**
 * Load a prompt template from file
 * @param {string} templatePath - Path relative to lib/prompts (e.g., 'base/voice-application')
 * @returns {string} Template content
 */
function loadTemplate(templatePath) {
  if (templateCache.has(templatePath)) {
    return templateCache.get(templatePath);
  }

  const fullPath = path.join(process.cwd(), 'lib', 'prompts', `${templatePath}.md`);

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    templateCache.set(templatePath, content);
    return content;
  } catch (error) {
    console.error(`Failed to load prompt template: ${templatePath}`, error);
    return '';
  }
}

/**
 * Simple template variable substitution
 * Supports: {{variable}}, {{#if var}}...{{/if}}, {{#each arr}}...{{/each}}, {{join arr ", "}}
 * @param {string} template - Template string
 * @param {object} context - Variables to substitute
 * @returns {string} Processed template
 */
function processTemplate(template, context) {
  let result = template;

  // Process {{#each array}}...{{/each}} blocks
  result = result.replace(/\{\{#each\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, path, content) => {
    const arr = getNestedValue(context, path);
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.map(item => {
      // Replace {{this}} with the item value
      return content.replace(/\{\{this\}\}/g, typeof item === 'object' ? JSON.stringify(item) : item);
    }).join('');
  });

  // Process {{#if variable}}...{{else}}...{{/if}} blocks
  result = result.replace(/\{\{#if\s+(\w+(?:\.\w+)*(?:\.length)?)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g, (match, path, ifContent, elseContent = '') => {
    const value = getNestedValue(context, path);
    const isTruthy = value && (typeof value !== 'object' || (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0));
    return isTruthy ? ifContent : elseContent;
  });

  // Process {{join array "separator"}} helper
  result = result.replace(/\{\{join\s+(\w+(?:\.\w+)*)\s+"([^"]+)"\}\}/g, (match, path, separator) => {
    const arr = getNestedValue(context, path);
    if (!Array.isArray(arr)) return '';
    return arr.join(separator);
  });

  // Process simple {{variable}} substitutions
  result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedValue(context, path);
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });

  return result;
}

/**
 * Get nested value from object using dot notation
 * @param {object} obj - Source object
 * @param {string} path - Dot-notation path (e.g., 'voiceProfile.tone.primary')
 * @returns {any} Value at path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    if (current === undefined || current === null) return undefined;
    return current[key];
  }, obj);
}

/**
 * Build a complete prompt for a generation stage
 * @param {string} stage - Stage name ('sufficiency-check', 'content-draft', 'quality-review')
 * @param {object} context - Context variables
 * @returns {string} Complete prompt
 */
export function buildStagePrompt(stage, context) {
  const stagePaths = {
    'sufficiency-check': 'stages/sufficiency-check',
    'content-draft': 'stages/content-draft',
    'quality-review': 'stages/quality-review'
  };

  const stagePath = stagePaths[stage];
  if (!stagePath) {
    throw new Error(`Unknown stage: ${stage}`);
  }

  const stageTemplate = loadTemplate(stagePath);
  return processTemplate(stageTemplate, context);
}

/**
 * Build the system prompt with all base rules
 * @param {object} voiceProfile - User's voice profile
 * @returns {string} Complete system prompt
 */
export function buildSystemPrompt(voiceProfile) {
  const templates = [
    'base/voice-application',
    'base/anti-fabrication',
    'base/linkedin-best-practices'
  ];

  const sections = templates.map(t => {
    const template = loadTemplate(t);
    return processTemplate(template, { voiceProfile });
  });

  return sections.join('\n\n---\n\n');
}

/**
 * Build a complete generation prompt combining system and stage prompts
 * @param {string} stage - Generation stage
 * @param {object} voiceProfile - User's voice profile
 * @param {object} stageContext - Stage-specific context
 * @returns {object} { systemPrompt, userPrompt }
 */
export function buildGenerationPrompts(stage, voiceProfile, stageContext) {
  const systemPrompt = buildSystemPrompt(voiceProfile);
  const userPrompt = buildStagePrompt(stage, {
    ...stageContext,
    voiceProfile
  });

  return { systemPrompt, userPrompt };
}

/**
 * Clear the template cache (useful for development)
 */
export function clearTemplateCache() {
  templateCache.clear();
}

/**
 * Get simplified voice context for quality review
 * @param {object} voiceProfile - Full voice profile
 * @returns {object} Simplified context for review prompts
 */
export function getVoiceContextForReview(voiceProfile) {
  if (!voiceProfile) {
    return {
      voiceStyle: 'professional and engaging',
      voiceTone: 'confident and approachable',
      usesEmojis: false,
      usesHashtags: false,
      typicalLength: 800,
      ctaStyle: 'soft'
    };
  }

  const formality = voiceProfile.writing_style?.formality || 0.5;
  const directness = voiceProfile.writing_style?.directness || 0.5;

  let style = '';
  if (formality < 0.3) style = 'casual';
  else if (formality > 0.7) style = 'formal';
  else style = 'professional';

  style += directness > 0.6 ? ' and direct' : ' and conversational';

  return {
    voiceStyle: style,
    voiceTone: `${voiceProfile.tone?.primary || 'confident'} and ${voiceProfile.tone?.secondary || 'approachable'}`,
    usesEmojis: voiceProfile.formatting?.uses_emojis || false,
    usesHashtags: voiceProfile.formatting?.uses_hashtags || false,
    typicalLength: voiceProfile.content_preferences?.typical_post_length || 800,
    ctaStyle: voiceProfile.formatting?.cta_style || 'soft'
  };
}
