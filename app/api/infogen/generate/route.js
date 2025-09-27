import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generatePNG } from '@/lib/infographics/image-generator';
import { generateInfographicHTML } from '@/lib/infographics/html-generator';
import { v4 as uuidv4 } from 'uuid';

// Initialize OpenAI client with fallback to main API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_INFOGEN_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENAI_COCREATE_API_KEY,
});


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
  // Set timeout for the entire request
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout after 10 minutes')), 10 * 60 * 1000);
  });

  const mainProcess = async () => {
    try {
      // Check if required API key is available
      if (!openai.apiKey) {
        console.error('OpenAI API key not configured');
        return NextResponse.json(
          { error: 'Service configuration error', details: 'OpenAI API key not configured' },
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
      .eq('id', user.id)
      .single();

    // Get template-specific instructions if available
    const selectedTemplate = templateId && templates[templateId] ? templates[templateId] : null;
    const templateInstructions = selectedTemplate ? selectedTemplate.instructions : 'Create a general professional infographic';
    const templateName = selectedTemplate ? selectedTemplate.name : 'General Layout';

    // Step 1: Generate structured infographic content using GPT-4o with template context
    const structuredPrompt = `
Create structured infographic content in the following JSON format:
{
  "header": {
    "number": "5", // if it's a numbered list, otherwise omit
    "mainTitle": "APPLICATIONS", // main large title
    "subtitle": "Of Pharmaceutical Manufacturing Automation" // descriptive subtitle
  },
  "contentSections": [
    {
      "title": "Section Title",
      "content": "Brief description",
      "items": ["optional array of bullet points"],
      "needsImage": true, // set to true if this section would benefit from a visual illustration
      "imagePrompt": "simple icon or illustration showing [concept]" // only if needsImage is true
    }
  ],
  "footer": {
    "name": "${profile?.full_name || 'Professional'}",
    "company": "${profile?.company || 'Company'}",
    "brand": "ENGINEERED VISION",
    "tagline": "INNOVATION THAT MATTERS"
  }
}

Content topic: ${content}
Context: ${context}
Template: ${templateName}
Template Instructions: ${templateInstructions}

IMPORTANT: Structure your content according to the template instructions above. ${getTemplateSpecificGuidance(templateId)}

Make it professional and engaging for LinkedIn. Mark sections that would benefit from visual illustrations with needsImage: true and provide appropriate imagePrompt for simple, professional icons or illustrations.`;

    let contentResponse;
    try {
      contentResponse = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert at creating structured infographic content. Always respond with valid JSON in the exact format requested."
            },
            {
              role: "user",
              content: structuredPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('OpenAI content generation timeout')), 60000)
        )
      ]);

      if (!contentResponse?.choices?.[0]?.message?.content) {
        throw new Error('Failed to generate structured content');
      }
    } catch (openaiError) {
      console.error('OpenAI content generation failed:', openaiError);
      return NextResponse.json(
        { error: 'Failed to generate infographic', details: `Content generation error: ${openaiError.message}` },
        { status: 500 }
      );
    }

    let infographicData;
    try {
      infographicData = JSON.parse(contentResponse.choices[0].message.content);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      infographicData = {
        header: {
          mainTitle: "INSIGHTS",
          subtitle: content.substring(0, 50) + "..."
        },
        contentSections: [
          {
            title: "Generated Content",
            content: contentResponse.choices[0].message.content.substring(0, 200)
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

    // Step 2: Generate images for content sections that need them (with timeout and limit)
    const sectionsWithImages = [];
    let imageGenerationCount = 0;
    const maxImages = 3; // Limit to 3 images to prevent timeout

    for (const section of infographicData.contentSections) {
      if (section.needsImage && section.imagePrompt && imageGenerationCount < maxImages) {
        try {
          console.log(`Generating image ${imageGenerationCount + 1}/${maxImages} for section: ${section.title}`);

          const imageResponse = await Promise.race([
            openai.images.generate({
              model: "dall-e-3",
              prompt: `Simple, clean, professional icon or illustration: ${section.imagePrompt}. Minimal style, white background, suitable for business infographic.`,
              n: 1,
              size: "1024x1024",
              quality: "standard",
              style: "natural"
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('DALL-E image generation timeout')), 120000) // 2 minute timeout per image
            )
          ]);

          if (imageResponse?.data?.[0]?.url) {
            sectionsWithImages.push({
              ...section,
              generatedImageUrl: imageResponse.data[0].url
            });
            imageGenerationCount++;
          } else {
            sectionsWithImages.push(section);
          }
        } catch (imageError) {
          console.error('Failed to generate image for section:', section.title, imageError);
          sectionsWithImages.push(section); // Continue without image
        }
      } else {
        sectionsWithImages.push(section);
      }
    }

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
          setTimeout(() => reject(new Error('PNG generation timeout')), 180000) // 3 minute timeout
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
      generatedContent: JSON.stringify(infographicData),
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
          error: 'Request timeout',
          details: 'The infographic generation is taking too long. Please try again with simpler content or fewer image generations.',
          suggestion: 'Try reducing the content length or using a template without image generation.'
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