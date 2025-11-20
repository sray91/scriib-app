import { Anthropic } from '@anthropic-ai/sdk';

/**
 * Generate a personalized outreach message using Claude Sonnet 4.5
 * @param {Object} params - Parameters for message generation
 * @param {string} params.instructions - User's instructions for how to personalize the message
 * @param {string} params.tone - Tone of the message (professional, casual, friendly)
 * @param {number} params.maxLength - Maximum character length for the message
 * @param {Object} params.contactData - LinkedIn contact data from Unipile API
 * @param {string} params.contactData.name - Contact's full name
 * @param {string} params.contactData.first_name - Contact's first name
 * @param {string} params.contactData.company - Contact's company
 * @param {string} params.contactData.job_title - Contact's job title
 * @param {string} params.contactData.profile_summary - LinkedIn profile summary/about section
 * @param {Array} params.contactData.recent_posts - Array of recent LinkedIn posts
 * @param {string} params.messageType - Type of message ('connection' or 'follow_up')
 * @param {string} params.previousMessage - Previous message sent (for follow-ups)
 * @returns {Promise<string>} - Generated personalized message
 */
export async function generatePersonalizedMessage({
  instructions,
  tone = 'professional',
  maxLength = 200,
  contactData,
  messageType = 'connection',
  previousMessage = null
}) {
  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Build context about the contact
  const contactContext = buildContactContext(contactData);

  // Build the system prompt
  const systemPrompt = buildSystemPrompt(tone, maxLength, messageType);

  // Build the user prompt
  const userPrompt = buildUserPrompt(
    instructions,
    contactContext,
    messageType,
    previousMessage
  );

  try {
    // Call Claude Sonnet 4.5
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract the generated message
    const generatedMessage = response.content[0].text.trim();

    // Ensure it meets the length requirement
    if (generatedMessage.length > maxLength) {
      // Ask Claude to shorten it
      const shortenResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        temperature: 0.5,
        messages: [
          {
            role: 'user',
            content: `Shorten this message to ${maxLength} characters or less while maintaining its key points and tone:\n\n${generatedMessage}`,
          },
        ],
      });
      return shortenResponse.content[0].text.trim();
    }

    return generatedMessage;
  } catch (error) {
    console.error('Error generating personalized message:', error);
    throw new Error(`Failed to generate personalized message: ${error.message}`);
  }
}

/**
 * Build context string from contact data
 */
function buildContactContext(contactData) {
  const parts = [];

  if (contactData.name) {
    parts.push(`Name: ${contactData.name}`);
  }

  if (contactData.job_title) {
    parts.push(`Job Title: ${contactData.job_title}`);
  }

  if (contactData.company) {
    parts.push(`Company: ${contactData.company}`);
  }

  if (contactData.profile_summary) {
    parts.push(`Profile Summary: ${contactData.profile_summary}`);
  }

  if (contactData.recent_posts && contactData.recent_posts.length > 0) {
    const recentPostsText = contactData.recent_posts
      .slice(0, 3) // Only use the 3 most recent posts
      .map((post, index) => `Post ${index + 1}: ${post.text || post.content}`)
      .join('\n');
    parts.push(`Recent LinkedIn Posts:\n${recentPostsText}`);
  }

  if (contactData.location) {
    parts.push(`Location: ${contactData.location}`);
  }

  if (contactData.headline) {
    parts.push(`LinkedIn Headline: ${contactData.headline}`);
  }

  return parts.join('\n\n');
}

/**
 * Build system prompt based on tone and message type
 */
function buildSystemPrompt(tone, maxLength, messageType) {
  const toneDescriptions = {
    professional: 'professional, respectful, and business-appropriate',
    casual: 'casual, approachable, and conversational',
    friendly: 'warm, friendly, and personable while remaining professional',
  };

  const messageTypeDescriptions = {
    connection: 'LinkedIn connection request message',
    follow_up: 'follow-up message after a connection request was accepted',
  };

  return `You are an expert at crafting personalized LinkedIn outreach messages. Your task is to write a ${toneDescriptions[tone]} ${messageTypeDescriptions[messageType]}.

Key Guidelines:
1. Keep the message under ${maxLength} characters
2. Be genuine and specific - reference actual details about the person
3. Avoid generic templates or overly salesy language
4. Focus on building a real connection, not just pitching
5. Use a ${tone} tone throughout
6. Do NOT use emojis
7. Do NOT include a subject line or greeting like "Subject:" or "Dear"
8. Write ONLY the message body
9. Be concise and respect the character limit strictly

LinkedIn connection messages are limited to 300 characters, so brevity is crucial.`;
}

/**
 * Build user prompt with instructions and contact context
 */
function buildUserPrompt(instructions, contactContext, messageType, previousMessage) {
  let prompt = `Write a personalized ${messageType} message based on the following:

USER INSTRUCTIONS:
${instructions}

CONTACT INFORMATION:
${contactContext}
`;

  if (messageType === 'follow_up' && previousMessage) {
    prompt += `\nPREVIOUS MESSAGE SENT:
${previousMessage}

Note: Reference or acknowledge the previous message appropriately in your follow-up.
`;
  }

  prompt += `\nGenerate a personalized message that follows the user's instructions while incorporating relevant details from the contact's profile. Make it feel authentic and tailored specifically to this person.`;

  return prompt;
}

/**
 * Fallback function to generate a template-based message when AI fails
 */
export function generateFallbackMessage(templateMessage, contactData) {
  let message = templateMessage;

  const replacements = {
    '{name}': contactData.name || 'there',
    '{first_name}': contactData.first_name || 'there',
    '{company}': contactData.company || 'your company',
    '{job_title}': contactData.job_title || 'your role',
  };

  Object.entries(replacements).forEach(([placeholder, value]) => {
    message = message.replace(new RegExp(placeholder, 'g'), value);
  });

  return message;
}
