// AI Content Generation for Infographics
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Generate infographic content using AI
 * @param {Object} request - Generation request parameters
 * @param {string} request.topic - Main topic for the infographic
 * @param {string} [request.industry] - Industry context
 * @param {string} [request.tone] - Tone of voice
 * @param {string} [request.targetAudience] - Target audience
 * @param {string[]} [request.keyPoints] - Key points to include
 * @param {number} [request.contentSections] - Number of content sections
 * @returns {Promise<Object>} Generated content structure
 */
export async function generateInfographicContent(request) {
  const {
    topic,
    industry = 'general',
    tone = 'professional',
    targetAudience = 'general audience',
    keyPoints = [],
    contentSections = 3
  } = request

  try {
    const prompt = buildPrompt(topic, industry, tone, targetAudience, keyPoints, contentSections)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert content creator specializing in infographic design. Create engaging, informative content that works well in visual format. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const content = JSON.parse(completion.choices[0].message.content)
    return {
      success: true,
      data: content
    }
  } catch (error) {
    console.error('AI generation error:', error)
    return {
      success: false,
      error: error.message,
      data: getFallbackContent(topic, contentSections)
    }
  }
}

/**
 * Build the AI prompt for content generation
 */
function buildPrompt(topic, industry, tone, targetAudience, keyPoints, contentSections) {
  const keyPointsText = keyPoints.length > 0
    ? `\nKey points to include: ${keyPoints.join(', ')}`
    : ''

  return `Create content for an infographic about "${topic}" in the ${industry} industry.

Target audience: ${targetAudience}
Tone: ${tone}
Number of content sections: ${contentSections}${keyPointsText}

Generate content in this exact JSON format:
{
  "header": {
    "title": "Compelling main title (max 6 words)",
    "subtitle": "Supporting subtitle that explains the value (max 12 words)"
  },
  "sections": [
    {
      "type": "text",
      "title": "Section title",
      "content": "Brief, impactful content suitable for visual display",
      "order": 1
    }
  ],
  "footer": {
    "text": "Call-to-action or key takeaway",
    "contact": "Contact information if relevant"
  },
  "suggestions": [
    "Additional content suggestions for user consideration"
  ]
}

Requirements:
- Header title should be catchy and attention-grabbing
- Each section should be concise (2-3 sentences max)
- Content should be scannable and visually digestible
- Include data points, statistics, or compelling facts when relevant
- Footer should have a clear call-to-action
- Make it engaging for the target audience`
}

/**
 * Provide fallback content when AI generation fails
 */
function getFallbackContent(topic, contentSections) {
  const sections = []
  for (let i = 1; i <= contentSections; i++) {
    sections.push({
      type: "text",
      title: `Key Point ${i}`,
      content: `Important information about ${topic} goes here. This content can be edited by the user.`,
      order: i
    })
  }

  return {
    header: {
      title: `${topic} Guide`,
      subtitle: "Essential information you need to know"
    },
    sections,
    footer: {
      text: "Learn more about this topic",
      contact: "Contact us for more information"
    },
    suggestions: [
      "Add relevant statistics",
      "Include visual elements",
      "Customize colors and fonts"
    ]
  }
}

/**
 * Generate alternative headlines for the infographic
 * @param {string} topic - Main topic
 * @param {number} count - Number of alternatives to generate
 * @returns {Promise<string[]>} Array of alternative headlines
 */
export async function generateAlternativeHeadlines(topic, count = 5) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a headline writing expert. Create catchy, engaging headlines for infographics."
        },
        {
          role: "user",
          content: `Generate ${count} alternative headlines for an infographic about "${topic}". Each headline should be:
          - Maximum 6 words
          - Catchy and attention-grabbing
          - Clear and informative
          - Suitable for visual content

          Return as JSON array: ["headline1", "headline2", ...]`
        }
      ],
      temperature: 0.8,
      max_tokens: 300
    })

    return JSON.parse(completion.choices[0].message.content)
  } catch (error) {
    console.error('Headlines generation error:', error)
    return [
      `${topic} Explained`,
      `${topic} Guide`,
      `${topic} Facts`,
      `${topic} Tips`,
      `${topic} Basics`
    ]
  }
}

/**
 * Enhance existing content with AI suggestions
 * @param {Object} content - Current content structure
 * @returns {Promise<Object>} Enhanced content with suggestions
 */
export async function enhanceContent(content) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a content enhancement expert. Improve infographic content while maintaining the original structure and intent."
        },
        {
          role: "user",
          content: `Enhance this infographic content to make it more engaging and impactful:

${JSON.stringify(content, null, 2)}

Provide improvements for:
1. Making headlines more compelling
2. Adding relevant statistics or data points
3. Improving readability and flow
4. Suggesting visual elements

Return the enhanced content in the same JSON structure.`
        }
      ],
      temperature: 0.6,
      max_tokens: 1500
    })

    return {
      success: true,
      data: JSON.parse(completion.choices[0].message.content)
    }
  } catch (error) {
    console.error('Content enhancement error:', error)
    return {
      success: false,
      error: error.message,
      data: content
    }
  }
}