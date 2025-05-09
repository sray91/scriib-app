import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_INFOGEN_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
  try {
    const { content, context, referenceImage, templateId } = await request.json();

    let templateInstructions = "";
    let contentPrompt = `Content: ${content}\nContext: ${context}\nFormat: Bullet points, max 5 sections`;

    // If a template was selected, include its specific instructions
    if (templateId && templates[templateId]) {
      const template = templates[templateId];
      templateInstructions = template.instructions;
      contentPrompt = `Content: ${content}\nContext: ${context}\nTemplate: ${template.name}\nTemplate Instructions: ${templateInstructions}\nFormat: Format according to template instructions`;
    }

    // Step 1: Generate content using o3
    const contentResponse = await openai.chat.completions.create({
      model: "o3",
      messages: [
        {
          role: "system",
          content: templateId 
            ? `Create structured infographic content for a specific template. ${templateInstructions}`
            : "Create structured infographic content. Use bullet points and short phrases."
        },
        {
          role: "user",
          content: contentPrompt
        }
      ],
      temperature: 1,
      max_completion_tokens: 2000,
    });

    if (!contentResponse || !contentResponse.choices || !contentResponse.choices[0] || !contentResponse.choices[0].message || !contentResponse.choices[0].message.content) {
      console.error('Content generation failed:', contentResponse);
      return NextResponse.json(
        { error: 'Content generation failed', details: contentResponse },
        { status: 500 }
      );
    }

    const generatedContent = contentResponse.choices[0].message.content;

    // Step 2: Generate image prompt based on the content and reference image using o3
    const promptResponse = await openai.chat.completions.create({
      model: "o3",
      messages: [
        {
          role: "system",
          content: templateId 
            ? `Create visual prompts for infographics based on a specific template. ${templateInstructions}`
            : "Create visual prompts for infographics. Focus on layout and style."
        },
        {
          role: "user",
          content: templateId
            ? `Content: ${generatedContent}\nTemplate: ${templates[templateId].name}\nTemplate Instructions: ${templateInstructions}\nFormat: 8.5x11, professional infographic`
            : `Content: ${generatedContent}\nStyle: ${referenceImage ? "Reference provided" : "Clean, modern"}\nFormat: 8.5x11, professional`
        }
      ],
      temperature: 1,
      max_completion_tokens: 2000,
    });

    if (!promptResponse || !promptResponse.choices || !promptResponse.choices[0] || !promptResponse.choices[0].message || !promptResponse.choices[0].message.content) {
      console.error('Prompt generation failed:', promptResponse);
      return NextResponse.json(
        { error: 'Prompt generation failed', details: promptResponse },
        { status: 500 }
      );
    }

    const imagePrompt = promptResponse.choices[0].message.content;

    // Step 3: Generate the infographic using gpt-image-1
    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      n: 1,
      size: "auto",
      quality: "high",
      output_format: "png",
    });

    if (!imageResponse || !imageResponse.data || !imageResponse.data[0] || !imageResponse.data[0].b64_json) {
      console.error('Image generation failed:', imageResponse);
      return NextResponse.json(
        { error: 'Image generation failed', details: imageResponse },
        { status: 500 }
      );
    }

    const imageBuffer = Buffer.from(imageResponse.data[0].b64_json, 'base64');
    
    const uniqueId = uuidv4();
    const fileName = `${uniqueId}.png`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
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
      generatedContent,
      imagePrompt,
      imageUrl: publicUrl,
      templateUsed: templateId ? templates[templateId].name : null,
    });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate infographic' },
      { status: 500 }
    );
  }
} 