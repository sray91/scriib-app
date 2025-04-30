import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { content, context, referenceImage } = await request.json();

    // Step 1: Generate content using o3
    const contentResponse = await openai.chat.completions.create({
      model: "o3",
      messages: [
        {
          role: "system",
          content: "Create structured infographic content. Use bullet points and short phrases."
        },
        {
          role: "user",
          content: `Content: ${content}\nContext: ${context}\nFormat: Bullet points, max 5 sections`
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
          content: "Create visual prompts for infographics. Focus on layout and style."
        },
        {
          role: "user",
          content: `Content: ${generatedContent}\nStyle: ${referenceImage}\nFormat: 8.5x11, professional`
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
    });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate infographic' },
      { status: 500 }
    );
  }
} 