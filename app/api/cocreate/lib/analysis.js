import { anthropic } from './clients.js';

// Analyze user's writing voice from past posts and training documents
export async function analyzeUserVoice(pastPosts, userMessage = '', trainingDocuments = []) {
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
      usesHashtags: false, // Keep default to false - only set to true if detected in actual content
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
  // Improved hashtag detection - look for # followed by word characters
  const hashtagRegex = /#\w+/;
  const actualUsesHashtags = allContentForAnalysis.some(item => hashtagRegex.test(item.content));
  
  console.log('🔍 Content analysis debug:');
  console.log(`- Total content pieces: ${allContentForAnalysis.length} (${postsForAnalysis.length} posts + ${documentsForAnalysis.length} documents)`);
  console.log(`- actualUsesEmojis: ${actualUsesEmojis}`);
  console.log(`- actualUsesHashtags: ${actualUsesHashtags}`);
  
  // Show hashtags found in content for debugging
  const foundHashtags = [];
  allContentForAnalysis.forEach((item, i) => {
    const hashtags = item.content.match(hashtagRegex) || [];
    if (hashtags.length > 0) {
      foundHashtags.push({ source: item.source, hashtags: hashtags.slice(0, 3) });
    }
  });
  if (foundHashtags.length > 0) {
    console.log(`- Found hashtags:`, foundHashtags);
  }
  
  allContentForAnalysis.slice(0, 3).forEach((item, i) => {
    const hasEmoji = emojiRegex.test(item.content);
    const hasHashtag = hashtagRegex.test(item.content);
    console.log(`- ${item.source} ${i+1}: emoji=${hasEmoji}, hashtag=${hasHashtag}, content="${item.content.substring(0, 100)}..."`);
  });

  try {
    if (!anthropic) {
      throw new Error('Anthropic Claude not available');
    }

    const message = await anthropic.messages.create({
      model: process.env.NEXT_PUBLIC_ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `You are an expert at analyzing authentic writing voice and style. Analyze the posts to capture the author's natural way of expressing themselves - their vocabulary choices, sentence patterns, emotional expression, and authentic personality. Focus on HOW they naturally write, not what they write about. Return ONLY a valid JSON object.

Analyze this person's authentic writing voice from their posts and documents:

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
      }]
    });

    // Validate Claude response structure
    if (!message || !message.content || !message.content[0]) {
      console.error('Invalid Claude response structure:', message);
      throw new Error('Invalid response from Claude API');
    }

    // Try to parse the JSON response with error handling
    try {
      const responseContent = message.content[0].text;
      console.log('Raw voice analysis response:', responseContent);

      if (!responseContent || typeof responseContent !== 'string') {
        throw new Error('Empty or invalid response content from Claude');
      }

      // Extract JSON from markdown code blocks if present
      let cleanedContent = responseContent.trim();

      // Remove markdown code block wrapper if present
      if (cleanedContent.startsWith('```json') && cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.slice(7, -3).trim();
      } else if (cleanedContent.startsWith('```') && cleanedContent.endsWith('```')) {
        cleanedContent = cleanedContent.slice(3, -3).trim();
      }

      const voiceAnalysis = JSON.parse(cleanedContent);
      console.log('🎯 Parsed voice analysis:', JSON.stringify(voiceAnalysis, null, 2));
      return voiceAnalysis;
    } catch (parseError) {
      console.error('Error parsing voice analysis JSON:', parseError);
      console.log('Failed response content:', message.content[0]?.text);
      console.log('🔄 Falling back to simple analysis due to parsing error');
    }
  } catch (error) {
    console.error('Error analyzing voice with Claude:', error);
    console.log('🔄 Using fallback analysis based on past posts patterns');
  }
  
  // Fallback to simple analysis
  const avgLength = pastPosts.reduce((sum, post) => sum + post.content.length, 0) / pastPosts.length;
  const usesEmojis = pastPosts.some(post => /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(post.content));
  const usesHashtags = pastPosts.some(post => /#\w+/.test(post.content));
  
  console.log(`🔄 Fallback analysis - usesEmojis: ${usesEmojis}, usesHashtags: ${usesHashtags}`);
  
  return {
    style: 'Professional and engaging',
    tone: 'Confident and approachable',
    commonTopics: extractTopicsFromPosts(pastPosts),
    avgLength: Math.round(avgLength),
    usesEmojis,
    usesHashtags,
    preferredFormats: ['Narrative'],
    fallbackReason: 'OpenAI voice analysis failed, using pattern analysis'
  };
}

// Analyze trending posts for patterns
export async function analyzeTrendingPosts(trendingPosts) {
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