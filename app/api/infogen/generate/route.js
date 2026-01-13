import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { generatePNG } from '@/lib/infographics/image-generator';
import { generateInfographicHTML } from '@/lib/infographics/html-generator';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '@/lib/api-auth';

// Initialize Anthropic client for Claude Sonnet 4
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Google Nano Banana (Gemini Image Generation) client
const nanoBanana = {
  apiKey: process.env.GOOGLE_NANO_BANANA_API_KEY,
  baseUrl: process.env.GOOGLE_NANO_BANANA_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
};


// Template definitions with specific instructions
const templates = {
  1: {
    name: "Myth vs. Fact",
    instructions: "Create a two-column 'Myth vs. Fact' infographic. Left column contains common myths, right column contains correct facts. Use contrasting colors for myth and fact sections."
  },
  2: {
    name: "12 Info Blocks",
    instructions: "Create an infographic with 12 equally sized information blocks arranged in a grid. Each block should contain a small icon or number, a short title, and a brief description."
  },
  3: {
    name: "Cheat Sheet",
    instructions: "Create a dense, reference-style 'cheat sheet' infographic. Organize information in sections with clear headings, use tables, bullets, and concise text for quick reference."
  },
  4: {
    name: "10 Brutal Truths",
    instructions: "Create an infographic listing 10 harsh or surprising facts ('brutal truths'). Number each point clearly and use impactful typography to emphasize key phrases."
  },
  5: {
    name: "Listicle",
    instructions: "Create a visually appealing 'listicle' infographic with numbered points. Each point should have a clear heading, supporting text, and relevant visual element or icon."
  },
  6: {
    name: "8 Radial Options",
    instructions: "Create an infographic with 8 options arranged in a radial/circular pattern around a central concept. Each option should have equal visual weight and brief descriptions."
  },
  7: {
    name: "5 Lessons",
    instructions: "Create an infographic highlighting 5 key lessons or takeaways. Each lesson should be clearly numbered, have a compelling headline, and supporting details."
  },
  8: {
    name: "Roadmap",
    instructions: "Create a visual 'roadmap' infographic showing progression through stages or steps. Use a path-like design with clear markers for each stage and brief descriptions."
  },
  9: {
    name: "7 Things About Archetype",
    instructions: "Create an infographic highlighting 7 key characteristics or insights about a specific archetype. Each point should be clearly numbered, include descriptive text, and use symbolism or imagery relevant to the archetype. Include a visually prominent title identifying the archetype."
  }
};

export async function POST(request) {
  // Set timeout for the entire request - reduced to 5 minutes
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout after 5 minutes')), 5 * 60 * 1000);
  });

  const mainProcess = async () => {
    try {
      // Check if required API keys are available
      if (!anthropic.apiKey) {
        console.error('Anthropic API key not configured');
        return NextResponse.json(
          { error: 'Service configuration error', details: 'Anthropic API key not configured' },
          { status: 500 }
        );
      }

      if (!nanoBanana.apiKey) {
        console.error('Google Nano Banana API key not configured');
        return NextResponse.json(
          { error: 'Service configuration error', details: 'Google Nano Banana API key not configured' },
          { status: 500 }
        );
      }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { content, context, templateId } = await request.json();

    // Fetch user profile information
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Get template-specific instructions if available
    const selectedTemplate = templateId && templates[templateId] ? templates[templateId] : null;
    const templateInstructions = selectedTemplate ? selectedTemplate.instructions : 'Create a general professional infographic';
    const templateName = selectedTemplate ? selectedTemplate.name : 'General Layout';

    // Step 1: Generate structured infographic content using Claude Sonnet 4 with template context
    const structuredPrompt = `Create structured infographic content in VALID JSON format. Do not include any comments or explanations outside the JSON.

REQUIRED JSON STRUCTURE:
{
  "header": {
    "number": "5",
    "mainTitle": "APPLICATIONS",
    "subtitle": "Of Pharmaceutical Manufacturing Automation"
  },
  "contentSections": [
    {
      "title": "Section Title",
      "content": "Brief description",
      "items": ["optional array of bullet points"],
      "needsImage": true,
      "imagePrompt": "simple icon or illustration showing [concept]"
    }
  ],
  "footer": {
    "name": "${profile?.full_name || 'Professional'}",
    "company": "${profile?.company || 'Company'}",
    "brand": "ENGINEERED VISION",
    "tagline": "INNOVATION THAT MATTERS"
  }
}

CONTENT REQUIREMENTS:
- Content topic: ${content}
- Context: ${context}
- Template: ${templateName}
- Template Instructions: ${templateInstructions}

STRUCTURE GUIDANCE: ${getTemplateSpecificGuidance(templateId)}

RULES:
1. Return ONLY valid JSON - no comments, no explanations
2. Include "number" field only if it's a numbered list template
3. Set needsImage to true for sections that would benefit from visual illustrations
4. Make content professional and engaging for LinkedIn
5. Follow the template instructions precisely

Respond with valid JSON only:`;

    let contentResponse;
    try {
      contentResponse = await Promise.race([
        anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          temperature: 0.7,
          system: "You are an expert at creating structured infographic content. You MUST respond with valid JSON only - no comments, no explanations, no markdown formatting. Return raw JSON that can be parsed directly.",
          messages: [
            {
              role: "user",
              content: structuredPrompt
            }
          ]
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Claude content generation timeout')), 30000)
        )
      ]);

      if (!contentResponse?.content?.[0]?.text) {
        throw new Error('Failed to generate structured content');
      }
    } catch (claudeError) {
      console.error('Claude content generation failed:', claudeError);
      return NextResponse.json(
        { error: 'Failed to generate infographic', details: `Content generation error: ${claudeError.message}` },
        { status: 500 }
      );
    }

    let infographicData;
    try {
      infographicData = JSON.parse(contentResponse.content[0].text);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.log('Raw Claude response:', contentResponse.content[0].text);

      // Improved fallback if JSON parsing fails
      infographicData = {
        header: {
          mainTitle: "CONTENT OVERVIEW",
          subtitle: "Generated insights and information"
        },
        contentSections: [
          {
            title: "Key Information",
            content: content.substring(0, 300) + (content.length > 300 ? '...' : ''),
            items: []
          }
        ],
        footer: {
          name: profile?.full_name || 'Professional',
          company: profile?.company || 'Company',
          brand: 'ENGINEERED VISION',
          tagline: 'INNOVATION THAT MATTERS'
        }
      };
    }

    // Step 2: Generate images for content sections that need them using Google Nano Banana (in parallel)
    console.log('=== IMAGE GENERATION DEBUG ===');
    console.log('Total sections:', infographicData.contentSections.length);
    infographicData.contentSections.forEach((section, index) => {
      console.log(`Section ${index + 1}:`, {
        title: section.title,
        needsImage: section.needsImage,
        hasImagePrompt: !!section.imagePrompt,
        imagePrompt: section.imagePrompt
      });
    });

    // Limit the number of images to prevent excessive API calls and timeouts
    const MAX_IMAGES = 4;
    const sectionsNeedingImages = infographicData.contentSections.filter(section => section.needsImage && section.imagePrompt);
    console.log(`Found ${sectionsNeedingImages.length} sections needing images, limiting to ${MAX_IMAGES}`);

    // Generate all images in parallel to reduce total time
    let imageCount = 0;
    const imagePromises = infographicData.contentSections.map(async (section, index) => {
      if (section.needsImage && section.imagePrompt && imageCount < MAX_IMAGES) {
        imageCount++;
        try {
          console.log(`Generating image ${index + 1} for section: ${section.title}`);

          const imageResponse = await Promise.race([
            fetch(`${nanoBanana.baseUrl}/models/gemini-2.5-flash-image-preview:generateContent`, {
              method: 'POST',
              headers: {
                'x-goog-api-key': nanoBanana.apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `Create a simple, clean, professional icon or illustration: ${section.imagePrompt}. Minimal style, white background, suitable for business infographic. No text or words in the image.`
                  }]
                }]
              })
            }).then(async res => {
              if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Google Gemini API error: ${res.status} - ${errorText}`);
              }
              return res.json();
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Google Nano Banana image generation timeout')), 60000) // Reduced to 1 minute per image
            )
          ]);

          // Check for image in the response
          const candidate = imageResponse?.candidates?.[0];
          const parts = candidate?.content?.parts;
          const imagePart = parts?.find(part => part.inlineData?.data);

          if (imagePart?.inlineData?.data) {
            const base64Data = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType || 'image/png';
            const dataUrl = `data:${mimeType};base64,${base64Data}`;

            console.log(`Successfully generated image for section: ${section.title}`);
            return {
              ...section,
              generatedImageUrl: dataUrl
            };
          } else {
            console.log(`No image data received for section: ${section.title}`);
            return section;
          }
        } catch (imageError) {
          console.error('Failed to generate image for section:', section.title);
          console.error('Nano Banana API Error:', imageError.message);
          return section; // Continue without image
        }
      } else {
        return section;
      }
    });

    // Wait for all image generations to complete (or fail)
    const sectionsWithImages = await Promise.all(imagePromises);

    // Update infographic data with generated images
    infographicData.contentSections = sectionsWithImages;

    // Step 3: Generate HTML using our custom generator
    let htmlContent;
    try {
      htmlContent = generateInfographicHTML(
        infographicData,
        profile,
        parseInt(templateId) || 1
      );
      
      // Validate HTML content
      if (!htmlContent || htmlContent.length < 100) {
        throw new Error('Generated HTML content is too short or empty');
      }
    } catch (htmlError) {
      console.error('HTML generation failed:', htmlError);
      return NextResponse.json(
        { error: 'Failed to generate infographic', details: `HTML generation error: ${htmlError.message}` },
        { status: 500 }
      );
    }

    // Step 4: Generate PNG from HTML using Puppeteer (with timeout)
    let imageBuffer;
    try {
      console.log('Starting PNG generation with Puppeteer...');
      imageBuffer = await Promise.race([
        generatePNG(htmlContent, {
          width: 1080,
          height: 1080,
          quality: 'high'
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PNG generation timeout')), 90000) // Reduced to 90 seconds
        )
      ]);
      console.log('PNG generation completed successfully');
    } catch (pngError) {
      console.error('PNG generation failed:', pngError);
      return NextResponse.json(
        { error: 'Failed to generate infographic', details: `PNG generation error: ${pngError.message}` },
        { status: 500 }
      );
    }
    // Step 5: Upload to Supabase Storage
    const uniqueId = uuidv4();
    const fileName = `infographic-${uniqueId}.png`;

    const { error: uploadError } = await supabase.storage
      .from('infographics')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('infographics')
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      templateUsed: templateId ? `Template ${templateId}` : 'Custom',
      infographicData,
    });
    } catch (error) {
      console.error('Generation error:', error);
      return NextResponse.json(
        { error: 'Failed to generate infographic', details: error.message },
        { status: 500 }
      );
    }
  };

  try {
    return await Promise.race([mainProcess(), timeoutPromise]);
  } catch (error) {
    console.error('Request processing error:', error);

    // Ensure we always return valid JSON
    if (error.message?.includes('timeout')) {
      return NextResponse.json(
        {
          error: 'Request timeout - the generation is taking too long. Please try again with simpler content.',
          details: 'The request exceeded the maximum processing time. Try using shorter content or a simpler template.',
          suggestion: 'Reduce content length, avoid complex templates, or try again in a few minutes.'
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate infographic', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to provide template-specific guidance
function getTemplateSpecificGuidance(templateId) {
  switch (parseInt(templateId)) {
    case 1: // Myth vs. Fact
      return 'Structure your content as opposing myths and facts. Create sections that contrast common misconceptions with accurate information.';
    case 2: // 12 Info Blocks
      return 'Create exactly 12 concise information blocks. Each should have a short title and brief description.';
    case 3: // Cheat Sheet
      return 'Format as a reference guide with quick, scannable information. Use bullet points and concise explanations.';
    case 4: // 10 Brutal Truths
      return 'Create exactly 10 hard-hitting, surprising facts. Make each point impactful and eye-opening.';
    case 5: // Listicle
      return 'Structure as a numbered list (5-10 items). Each point should have a clear title and supporting explanation.';
    case 6: // 8 Radial Options
      return 'Create exactly 8 options or alternatives. Each should be equally weighted and briefly described.';
    case 7: // 5 Lessons
      return 'Create exactly 5 key lessons or takeaways. Each should have a clear learning point and explanation.';
    case 8: // Roadmap
      return 'Structure as sequential steps or stages. Each step should build upon the previous one in a logical progression.';
    case 9: // 7 Things About Archetype
      return 'Create exactly 7 characteristics or insights. Focus on key traits, behaviors, or attributes of the subject.';
    default:
      return 'Create engaging, well-structured content appropriate for professional social media.';
  }
} 