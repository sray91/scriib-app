/**
 * Voice Analyzer
 *
 * Analyzes user content to build comprehensive voice profiles using Claude.
 * Single, unified approach to voice analysis (replaces fragmented implementations).
 */

import Anthropic from '@anthropic-ai/sdk';
import { createDefaultProfile, upsertVoiceProfile, getVoiceProfile, shouldUpdateProfile } from './profile-store.js';

// Initialize Anthropic client
let anthropic;
try {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
} catch (error) {
  console.warn('Anthropic SDK not available:', error.message);
}

/**
 * Analyze user content and create/update voice profile
 * @param {object} supabase - Supabase client
 * @param {string} userId - User UUID
 * @param {object} sources - Content sources { pastPosts, trainingDocs, contextGuide }
 * @param {boolean} forceUpdate - Force profile regeneration
 * @returns {object} Voice profile
 */
export async function analyzeAndUpdateVoiceProfile(supabase, userId, sources, forceUpdate = false) {
  const { pastPosts = [], trainingDocs = [], contextGuide = '' } = sources;

  // Check if we need to update
  const currentProfile = await getVoiceProfile(supabase, userId);
  const newSources = {
    pastPostsCount: pastPosts.length,
    trainingDocsCount: trainingDocs.length,
    contextGuideWords: contextGuide ? contextGuide.split(/\s+/).length : 0
  };

  if (!forceUpdate && currentProfile && !shouldUpdateProfile(currentProfile, newSources)) {
    console.log('Voice profile is current, skipping analysis');
    return currentProfile;
  }

  // No content to analyze - return default profile
  if (pastPosts.length === 0 && trainingDocs.length === 0 && !contextGuide) {
    console.log('No content to analyze, using default profile');
    const defaultProfile = createDefaultProfile();
    return upsertVoiceProfile(supabase, userId, defaultProfile);
  }

  console.log(`Analyzing voice from ${pastPosts.length} posts, ${trainingDocs.length} docs, ${newSources.contextGuideWords} guide words`);

  try {
    // Build comprehensive voice profile using Claude
    const analysisResult = await analyzeVoiceWithClaude(pastPosts, trainingDocs, contextGuide);

    // Structure the profile
    const profileData = {
      writing_style: analysisResult.writing_style,
      tone: analysisResult.tone,
      vocabulary: analysisResult.vocabulary,
      formatting: analysisResult.formatting,
      content_preferences: analysisResult.content_preferences,
      analysis_sources: {
        past_posts_count: pastPosts.length,
        training_docs_count: trainingDocs.length,
        context_guide_words: newSources.contextGuideWords,
        last_post_analyzed_at: pastPosts.length > 0 ? new Date().toISOString() : null
      },
      raw_analysis: analysisResult.raw_analysis
    };

    // Save to database
    return upsertVoiceProfile(supabase, userId, profileData);

  } catch (error) {
    console.error('Voice analysis failed:', error);

    // Fall back to pattern-based analysis
    const fallbackProfile = analyzeVoiceWithPatterns(pastPosts, contextGuide);
    fallbackProfile.analysis_sources = {
      past_posts_count: pastPosts.length,
      training_docs_count: trainingDocs.length,
      context_guide_words: newSources.contextGuideWords,
      last_post_analyzed_at: null,
      analysis_method: 'pattern_fallback'
    };

    return upsertVoiceProfile(supabase, userId, fallbackProfile);
  }
}

/**
 * Analyze voice using Claude AI
 * @param {array} pastPosts - Array of past post objects
 * @param {array} trainingDocs - Array of training document objects
 * @param {string} contextGuide - User's context guide text
 * @returns {object} Structured voice analysis
 */
async function analyzeVoiceWithClaude(pastPosts, trainingDocs, contextGuide) {
  if (!anthropic) {
    throw new Error('Anthropic client not initialized');
  }

  // Prepare content samples
  const postSamples = pastPosts.slice(0, 15).map((post, i) =>
    `POST ${i + 1}:\n${post.content}`
  ).join('\n\n---\n\n');

  const docSamples = trainingDocs.slice(0, 5).map((doc, i) =>
    `DOCUMENT "${doc.file_name}":\n${doc.extracted_text?.substring(0, 2000) || ''}`
  ).join('\n\n---\n\n');

  const prompt = `You are an expert writing analyst. Analyze the following content to create a comprehensive voice profile for this author.

${contextGuide ? `CONTEXT GUIDE (user's self-description - PRIMARY reference):
${contextGuide}

---` : ''}

${postSamples ? `LINKEDIN POSTS:
${postSamples}

---` : ''}

${docSamples ? `TRAINING DOCUMENTS:
${docSamples}

---` : ''}

Analyze this content and return a JSON object with the following structure. Be precise and specific based on actual patterns observed:

{
  "writing_style": {
    "formality": <0-1 float, where 0 is very casual and 1 is very formal>,
    "directness": <0-1 float, where 0 is flowing/narrative and 1 is direct/punchy>,
    "sentence_length_avg": <average words per sentence>,
    "sentence_length_variance": "<low|medium|high> - how much sentence length varies",
    "paragraph_style": "<short|medium|long> - typical paragraph length"
  },
  "tone": {
    "primary": "<main tone: confident, humble, inspiring, analytical, conversational, etc>",
    "secondary": "<secondary tone>",
    "emotional_range": ["<list of emotions they express: vulnerable, excited, frustrated, etc>"]
  },
  "vocabulary": {
    "level": "<casual|professional|academic>",
    "industry_terms": ["<specific terms/jargon they use>"],
    "signature_phrases": ["<phrases they repeat or are distinctive to them>"],
    "words_to_avoid": ["<words that would feel out of character>"]
  },
  "formatting": {
    "uses_emojis": <true|false based on actual usage>,
    "uses_hashtags": <true|false based on actual usage>,
    "uses_line_breaks": <true|false - do they use line breaks for emphasis>,
    "preferred_hooks": ["<hook types they favor: question, bold statement, story opener, statistic, etc>"],
    "cta_style": "<none|soft|direct> - how they end posts"
  },
  "content_preferences": {
    "expertise_areas": ["<topics they clearly know well>"],
    "storytelling_style": "<personal anecdote|case study|framework|observation>",
    "typical_post_length": <approximate character count>
  }
}

Return ONLY the JSON object, no additional text. Be specific and base everything on actual observed patterns.`;

  const message = await anthropic.messages.create({
    model: process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  const responseText = message.content[0].text;

  // Parse JSON response
  let cleanedResponse = responseText.trim();
  if (cleanedResponse.startsWith('```json')) {
    cleanedResponse = cleanedResponse.slice(7);
  }
  if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.slice(3);
  }
  if (cleanedResponse.endsWith('```')) {
    cleanedResponse = cleanedResponse.slice(0, -3);
  }

  const analysis = JSON.parse(cleanedResponse.trim());

  return {
    ...analysis,
    raw_analysis: responseText
  };
}

/**
 * Pattern-based voice analysis (fallback when Claude unavailable)
 * @param {array} pastPosts - Array of past post objects
 * @param {string} contextGuide - User's context guide
 * @returns {object} Basic voice profile
 */
function analyzeVoiceWithPatterns(pastPosts, contextGuide) {
  const profile = createDefaultProfile();

  if (pastPosts.length === 0 && !contextGuide) {
    return profile;
  }

  // Analyze posts for patterns
  const allContent = pastPosts.map(p => p.content).join(' ');
  const allPosts = pastPosts.map(p => p.content);

  // Emoji detection
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojiCount = (allContent.match(emojiRegex) || []).length;
  profile.formatting.uses_emojis = emojiCount > pastPosts.length * 0.3; // Uses emojis if >30% of posts have them

  // Hashtag detection
  const hashtagRegex = /#\w+/g;
  const hashtagCount = (allContent.match(hashtagRegex) || []).length;
  profile.formatting.uses_hashtags = hashtagCount > pastPosts.length * 0.3;

  // Average length
  if (pastPosts.length > 0) {
    const totalLength = pastPosts.reduce((sum, p) => sum + p.content.length, 0);
    profile.content_preferences.typical_post_length = Math.round(totalLength / pastPosts.length);
  }

  // Line break usage
  const lineBreakPosts = allPosts.filter(p => (p.match(/\n\n/g) || []).length > 2).length;
  profile.formatting.uses_line_breaks = lineBreakPosts > pastPosts.length * 0.5;

  // Sentence length analysis
  const sentences = allContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) {
    const avgWords = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length;
    profile.writing_style.sentence_length_avg = Math.round(avgWords);
  }

  // Question usage (indicates conversational style)
  const questionCount = (allContent.match(/\?/g) || []).length;
  if (questionCount > pastPosts.length * 2) {
    profile.tone.primary = 'conversational';
    profile.formatting.preferred_hooks.push('question');
  }

  return profile;
}

/**
 * Quick voice check - returns simplified voice attributes for prompt building
 * @param {object} voiceProfile - Full voice profile
 * @returns {object} Simplified voice attributes
 */
export function getSimplifiedVoice(voiceProfile) {
  if (!voiceProfile) {
    return {
      style: 'professional and engaging',
      tone: 'confident and approachable',
      usesEmojis: false,
      usesHashtags: false,
      avgLength: 800,
      hooks: ['question', 'bold statement']
    };
  }

  const formality = voiceProfile.writing_style?.formality || 0.5;
  const directness = voiceProfile.writing_style?.directness || 0.5;

  let style = '';
  if (formality < 0.3) style = 'casual and ';
  else if (formality > 0.7) style = 'formal and ';
  else style = 'professional and ';

  if (directness < 0.3) style += 'flowing';
  else if (directness > 0.7) style += 'direct';
  else style += 'balanced';

  return {
    style,
    tone: `${voiceProfile.tone?.primary || 'confident'} and ${voiceProfile.tone?.secondary || 'approachable'}`,
    usesEmojis: voiceProfile.formatting?.uses_emojis || false,
    usesHashtags: voiceProfile.formatting?.uses_hashtags || false,
    avgLength: voiceProfile.content_preferences?.typical_post_length || 800,
    hooks: voiceProfile.formatting?.preferred_hooks || ['question', 'bold statement'],
    expertiseAreas: voiceProfile.content_preferences?.expertise_areas || [],
    signaturePhrases: voiceProfile.vocabulary?.signature_phrases || [],
    emotionalRange: voiceProfile.tone?.emotional_range || []
  };
}
