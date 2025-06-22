import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_COCREATE_API_KEY,
});

// Load hooks knowledge base
let hooksKnowledge = '';
try {
  const hooksPath = path.join(process.cwd(), 'docs', 'HOOKS_GUIDE.md');
  hooksKnowledge = fs.readFileSync(hooksPath, 'utf8');
} catch (error) {
  console.warn('Could not load hooks knowledge base:', error.message);
}

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
    
    console.log(`🚀 CoCreate request from user ${user.id}: "${userMessage}"`);
    
    // Fetch user's past posts from database to analyze their voice
    const pastPosts = await fetchUserPastPosts(supabase, user.id);
    console.log(`📚 Found ${pastPosts.length} past posts for voice analysis`);
    
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
    
    // Generate post content using GPT-4o
    const result = await generatePostContentWithGPT4o(
      userMessage, 
      currentDraft, 
      action, 
      pastPosts, 
      trendingPosts
    );
    
    return NextResponse.json({
      success: true,
      message: result.assistantMessage,
      updatedPost: result.postContent,
      isSignificantUpdate: result.isSignificantUpdate,
      processingSteps: result.processingSteps,
      voiceAnalysis: result.voiceAnalysis,
      trendingInsights: result.trendingInsights
    });
    
  } catch (error) {
    console.error('Error in CoCreate API:', error);
    
    // Handle specific OpenAI errors
    if (error.status === 429 || (error.error && error.error.type === 'insufficient_quota')) {
      return NextResponse.json(
        { 
          error: "OpenAI API rate limit exceeded. Please try again in a moment.",
          type: "rate_limit" 
        }, 
        { status: 429 }
      );
    }
    
    if (error.status === 401) {
      return NextResponse.json(
        { 
          error: "OpenAI API key invalid or missing. Please check your configuration.",
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

// Fetch user's past posts from the database
async function fetchUserPastPosts(supabase, userId) {
  try {
    const { data: posts, error } = await supabase
      .from('past_posts')
      .select(`
        id,
        content,
        published_at,
        metrics,
        post_type,
        post_url
      `)
      .eq('user_id', userId)
      .eq('platform', 'linkedin')
      .order('published_at', { ascending: false })
      .limit(20); // Analyze up to 20 recent posts for voice

    if (error) {
      console.error('Error fetching past posts:', error);
      return [];
    }

    return posts || [];
  } catch (error) {
    console.error('Error in fetchUserPastPosts:', error);
    return [];
  }
}

// Fetch trending posts for inspiration
async function fetchTrendingPosts(supabase) {
  try {
    const { data: posts, error } = await supabase
      .from('trending_posts')
      .select(`
        id,
        content,
        likes,
        comments,
        shares,
        views,
        author_name,
        author_title,
        post_type,
        industry_tags,
        engagement_rate,
        post_url
      `)
      .eq('is_active', true)
      .order('engagement_rate', { ascending: false })
      .limit(10); // Top 10 trending posts

    if (error) {
      console.error('Error fetching trending posts:', error);
      return [];
    }

    return posts || [];
  } catch (error) {
    console.error('Error in fetchTrendingPosts:', error);
    return [];
  }
}

// Generate post content using GPT-4o with advanced analysis
async function generatePostContentWithGPT4o(userMessage, currentDraft, action, pastPosts, trendingPosts) {
  try {
    // Analyze user's voice from past posts
    const voiceAnalysis = await analyzeUserVoice(pastPosts, userMessage);
    
    // Analyze trending posts for patterns
    const trendingInsights = await analyzeTrendingPosts(trendingPosts);
    
    // Build the comprehensive system prompt
    const systemPrompt = buildSystemPrompt(pastPosts, trendingPosts, voiceAnalysis, trendingInsights, userMessage);
    
    // Build the user prompt based on action
    const userPrompt = buildUserPrompt(userMessage, currentDraft, action);
    
    // Call GPT-4o
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o as requested
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });
    
    const assistantResponse = completion.choices[0].message.content;
    
    // Parse the response to extract post content and explanation
    const { postContent, explanation } = parseGPTResponse(assistantResponse);
    
    // Determine if this is a significant update
    const isSignificantUpdate = action === 'create' || 
      (currentDraft && calculateTextSimilarity(currentDraft, postContent) < 0.8);
    
    return {
      assistantMessage: explanation,
      postContent,
      isSignificantUpdate,
      processingSteps: [
        `Analyzed ${pastPosts.length} of your past posts to understand your voice`,
        `Studied ${trendingPosts.length} top-performing posts for engagement patterns`,
        `Identified your key writing style: ${voiceAnalysis.style}`,
        `Applied trending formats: ${trendingInsights.topFormats.join(', ')}`,
        action === 'refine' ? 'Refined your draft with insights' : 'Created new content optimized for engagement'
      ],
      voiceAnalysis,
      trendingInsights
    };
    
  } catch (error) {
    console.error('Error in generatePostContentWithGPT4o:', error);
    throw error;
  }
}

// Analyze user's writing voice from past posts
async function analyzeUserVoice(pastPosts, userMessage = '') {
  if (!pastPosts || pastPosts.length === 0) {
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
      usesHashtags: true,
      preferredFormats: ['Narrative', 'List']
    };
  }

  // Analyze posts with GPT-4o for voice characteristics
  const postsForAnalysis = pastPosts.slice(0, 10).map(post => ({
    content: post.content,
    engagement: post.metrics,
    type: post.post_type
  }));

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
                         {
          role: "system",
          content: "You are an expert at analyzing authentic writing voice and style. Analyze the posts to capture the author's natural way of expressing themselves - their vocabulary choices, sentence patterns, emotional expression, and authentic personality. Focus on HOW they naturally write, not what they write about. Return ONLY a valid JSON object."
        },
        {
          role: "user",
          content: `Analyze these posts to understand this person's authentic writing voice:

${postsForAnalysis.map((post, i) => `Post ${i + 1}: "${post.content}"`).join('\n\n')}

Focus on their natural writing patterns, vocabulary, and authentic voice. Return analysis as JSON:
{
  "style": "their natural writing style (casual/formal, direct/flowing, conversational/structured, etc)",
  "tone": "their authentic emotional tone and personality in writing", 
  "commonTopics": ["topic1", "topic2"],
  "avgLength": ${Math.round(postsForAnalysis.reduce((sum, post) => sum + post.content.length, 0) / postsForAnalysis.length)},
  "usesEmojis": ${postsForAnalysis.some(post => /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(post.content))},
  "usesHashtags": ${postsForAnalysis.some(post => post.content.includes('#'))},
  "preferredFormats": ["their natural format preferences based on actual usage"]
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

        // Validate OpenAI response structure
    if (!completion || !completion.choices || !completion.choices[0] || !completion.choices[0].message) {
      console.error('Invalid OpenAI response structure:', completion);
      throw new Error('Invalid response from OpenAI API');
    }

    // Try to parse the JSON response with error handling
    try {
      const responseContent = completion.choices[0].message.content;
      console.log('Raw voice analysis response:', responseContent);
      
      if (!responseContent || typeof responseContent !== 'string') {
        throw new Error('Empty or invalid response content from OpenAI');
      }
      
      const voiceAnalysis = JSON.parse(responseContent);
      console.log('🎯 Parsed voice analysis:', JSON.stringify(voiceAnalysis, null, 2));
      return voiceAnalysis;
    } catch (parseError) {
      console.error('Error parsing voice analysis JSON:', parseError);
      console.log('Failed response content:', completion.choices[0]?.message?.content);
      // Return fallback structure if JSON parsing fails
      throw new Error('Failed to parse voice analysis response');
    }
  } catch (error) {
    console.error('Error analyzing voice:', error);
    
    // Fallback to simple analysis
    const avgLength = pastPosts.reduce((sum, post) => sum + post.content.length, 0) / pastPosts.length;
    const usesEmojis = pastPosts.some(post => /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(post.content));
    const usesHashtags = pastPosts.some(post => post.content.includes('#'));
    
    return {
      style: avgLength > 300 ? 'Detailed and thorough' : 'Concise and direct',
      tone: 'Professional',
      commonTopics: extractTopicsFromPosts(pastPosts),
      avgLength: Math.round(avgLength),
      usesEmojis,
      usesHashtags,
      preferredFormats: ['Narrative']
    };
  }
}

// Analyze trending posts for patterns
async function analyzeTrendingPosts(trendingPosts) {
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

// Build comprehensive system prompt
function buildSystemPrompt(pastPosts, trendingPosts, voiceAnalysis, trendingInsights, userMessage = '') {
  // If user has past posts, prioritize their authentic voice over everything else
  if (pastPosts && pastPosts.length > 0) {
    return `You are CoCreate, an AI writing assistant who helps users write in their authentic voice. You have analyzed ${pastPosts.length} of the user's past posts to understand their unique writing style.

## USER'S AUTHENTIC VOICE (from ${pastPosts.length} past posts)
- Writing Style: ${voiceAnalysis.style}
- Tone: ${voiceAnalysis.tone}
- Common Topics: ${voiceAnalysis.commonTopics.join(', ')}
- Average Length: ${voiceAnalysis.avgLength} characters
- Uses Emojis: ${voiceAnalysis.usesEmojis ? 'Yes' : 'No'}
- Uses Hashtags: ${voiceAnalysis.usesHashtags ? 'Yes' : 'No'}
- Preferred Formats: ${voiceAnalysis.preferredFormats.join(', ')}

## CORE PRINCIPLES
1. **AUTHENTICITY IS EVERYTHING**: Match the user's exact voice, tone, and style from their past posts
2. **MIRROR THEIR PATTERNS**: Use the same sentence structure, vocabulary, and flow they naturally use
3. **RESPECT THEIR TOPICS**: Write about the subject matter in the way they would naturally approach it
4. **MATCH THEIR FORMALITY**: If they're casual, be casual. If they're formal, be formal.
5. **FOLLOW THEIR EMOJI/HASHTAG PATTERNS**: Only use emojis/hashtags if they typically do
6. **NATURAL ENDINGS**: End posts the way they naturally would - no forced calls to action

## YOUR INSTRUCTIONS
- Write exactly as this user would write, based on their past post patterns
- Use their vocabulary, sentence length, and natural flow
- Match their emotional expression style
- If the topic is personal/emotional, reflect how they handle such topics
- If the topic is professional, reflect their professional voice
- Don't force engagement optimization - let their authentic voice shine through
- End posts naturally in their style, not with forced CTAs unless that's their pattern

Write the post as this specific user would write it, using their authentic voice and patterns.

Format your response as:
[POST CONTENT]

---
[BRIEF EXPLANATION OF YOUR APPROACH]`;
  }

  // Fallback for users without past posts - use keyword detection
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
    return `You are CoCreate, a compassionate AI writing assistant who helps people share authentic personal experiences.

## PERSONAL CONTENT GUIDELINES
This appears to be deeply personal or emotional content. Your priorities are:
1. **AUTHENTICITY FIRST**: Write in a genuine, human way
2. **RESPECT THE TOPIC**: Handle sensitive subjects with care and dignity
3. **NO FORCED OPTIMIZATION**: Don't prioritize engagement over emotional truth
4. **NATURAL FLOW**: Let the content breathe naturally without forced structures

## YOUR INSTRUCTIONS FOR PERSONAL CONTENT
1. Write in a genuine, heartfelt way that feels authentic
2. Use simple, clear language that expresses genuine emotion
3. **NO MANDATORY ENDINGS** - End naturally based on the emotional arc
4. **NO FORCED LISTS** - Only use lists if they feel natural to the story
5. **NEVER use emojis** in emotional content - let words carry the weight
6. **NEVER use hashtags** - keep the focus on the story
7. Respect the gravity of serious topics like loss, illness, or trauma

Write the post authentically, as someone would genuinely share this experience.

Format your response as:
[POST CONTENT]

---
[BRIEF EXPLANATION OF YOUR APPROACH]`;
  }

  // Original system prompt for business/professional content (no past posts)
  return `You are CoCreate, an expert LinkedIn content strategist and AI writing assistant. Your mission is to help users create high-performing LinkedIn posts that maintain their authentic voice while incorporating proven engagement strategies.

## USER'S VOICE ANALYSIS
Based on analysis of ${pastPosts.length} past posts:
- Writing Style: ${voiceAnalysis.style}
- Tone: ${voiceAnalysis.tone}
- Common Topics: ${voiceAnalysis.commonTopics.join(', ')}
- Average Length: ${voiceAnalysis.avgLength} characters
- Uses Emojis: ${voiceAnalysis.usesEmojis ? 'Yes' : 'No'}
- Uses Hashtags: ${voiceAnalysis.usesHashtags ? 'Yes' : 'No'}
- Preferred Formats: ${voiceAnalysis.preferredFormats.join(', ')}

## TRENDING POST INSIGHTS
Analysis of ${trendingPosts.length} high-performing posts:
- Top Formats: ${trendingInsights.topFormats.join(', ')}
- Average Engagement Rate: ${trendingInsights.avgEngagementRate}%
- Common Elements: ${trendingInsights.commonElements.join(', ')}
- Best Topics: ${trendingInsights.bestPerformingTopics.join(', ')}
- Optimal Length: ~${trendingInsights.optimalLength} characters

## HIGH-PERFORMING POST EXAMPLES
${trendingPosts.slice(0, 3).map((post, i) => 
  `Example ${i + 1} (${post.engagement_rate}% engagement):
  "${post.content.substring(0, 200)}${post.content.length > 200 ? '...' : ''}"
  Engagement: ${post.likes} likes, ${post.comments} comments, ${post.shares} shares`
).join('\n\n')}

## EXPERT KNOWLEDGE: CREATING COMPELLING HOOKS
${hooksKnowledge ? hooksKnowledge : 'Hook knowledge base not available'}

## TIM FERRISS CONCLUSION STYLE GUIDE
Tim Ferriss is known for ending his content with practical, actionable conclusions. Key characteristics:

**Structure Patterns:**
- "The bottom line:" + practical takeaway
- "Try this:" + specific experiment or action
- "Here's the experiment:" + step-by-step challenge
- "Your move:" + direct call to action
- "The 80/20:" + focusing on the most impactful elements

**Style Elements:**
- Direct, no-fluff language
- Specific timeframes ("next 30 days", "this week")
- Measurable actions ("track X for 7 days", "try Y technique 3 times")
- Often includes frameworks or systems
- Challenges conventional wisdom
- Emphasizes experimentation and testing

**Example Tim Ferriss Conclusions:**
- "The bottom line: Most productivity advice is garbage. Try this instead: Pick ONE task tomorrow that scares you most. Do it first. Track how you feel at noon."
- "Here's the experiment: For the next 7 days, end every meeting 5 minutes early. Use those minutes to immediately capture your next action. Measure the difference."
- "Your move: Stop planning. Start testing. Pick one idea from this post and implement it before Thursday. Then tell me what happened."

## YOUR INSTRUCTIONS
1. MAINTAIN the user's authentic voice and style
2. INCORPORATE proven engagement elements from trending posts
3. OPTIMIZE for LinkedIn's algorithm (engagement, comments, shares)
4. STRUCTURE content for readability (line breaks, formatting)
5. **NEVER use emojis** - keep the content clean and professional
6. **NEVER use hashtags** - focus on organic reach through quality content
7. **CRITICAL**: Always start with a compelling hook using the expert knowledge above. Choose the hook style that best matches the user's voice and the content topic.
8. **LIST FORMATTING**: When creating numbered or bulleted lists, write each point as a unified thought in 2-3 complete sentences. NEVER use the "Title: Description" format. Instead, write flowing, cohesive thoughts that stand alone.

   WRONG: "1. Fear of Failure: Embrace mistakes as stepping stones for growth."
   RIGHT: "1. Many leaders avoid taking risks because they fear making mistakes. This mindset actually limits growth and innovation. The most successful leaders I know treat failures as essential learning experiences that build resilience."
9. **CONCLUSION STYLE**: End every post with a Tim Ferriss-style conclusion that is:
   - Direct and actionable
   - Includes a specific challenge, experiment, or next step
   - Uses his signature style of practical frameworks
   - Often includes phrases like "Try this:", "The bottom line:", "Here's the experiment:", or "Your move:"

Format your response as:
[POST CONTENT]

---
[BRIEF EXPLANATION OF YOUR APPROACH]`;
}

// Build user prompt based on request
function buildUserPrompt(userMessage, currentDraft, action) {
  if (action === 'refine' && currentDraft) {
    return `Please refine this LinkedIn post based on my feedback:

CURRENT DRAFT:
${currentDraft}

MY FEEDBACK:
${userMessage}

Improve the post while maintaining my voice and incorporating trending elements.`;
  }
  
  return `Create a LinkedIn post based on this request: ${userMessage}

Make it engaging, authentic to my voice, and optimized for high performance.`;
}

// Parse GPT response to extract post content and explanation
function parseGPTResponse(response) {
  const parts = response.split('---');
  
  if (parts.length >= 2) {
    let postContent = parts[0].trim();
    
    // Remove [POST CONTENT] prefix if it exists
    postContent = postContent.replace(/^\[POST CONTENT\]\s*/, '');
    
    // Clean up asterisk formatting in lists (convert **text**: to text:)
    postContent = postContent.replace(/\*\*(.*?)\*\*:/g, '$1:');
    
    return {
      postContent,
      explanation: parts[1].trim()
    };
  }
  
  // Fallback if no separator found
  let postContent = response;
  
  // Remove [POST CONTENT] prefix if it exists
  postContent = postContent.replace(/^\[POST CONTENT\]\s*/, '');
  
  // Clean up asterisk formatting in lists
  postContent = postContent.replace(/\*\*(.*?)\*\*:/g, '$1:');
  
  return {
    postContent,
    explanation: "I've created a post optimized for engagement based on your request and writing style."
  };
}

// Calculate text similarity (simple implementation)
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = new Set([...words1, ...words2]).size;
  
  return commonWords.length / totalWords;
}