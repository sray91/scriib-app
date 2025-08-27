import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_COCREATE_API_KEY,
});

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
    
    // Get the uploaded audio file
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }
    
    console.log(`🎤 Transcribing audio for user ${user.id}, file size: ${audioFile.size} bytes`);
    
    // Check file size (Whisper API has a 25MB limit)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }
    
    try {
      // Transcribe using OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "en", // Optimize for English, remove this line for auto-detection
        response_format: "text",
        temperature: 0.2, // Lower temperature for more consistent results
      });
      
      console.log(`✅ Transcription successful: "${transcription.substring(0, 100)}..."`);
      
      return NextResponse.json({
        success: true,
        text: transcription
      });
      
    } catch (whisperError) {
      console.error('Whisper API error:', whisperError);
      
      // Handle specific Whisper API errors
      if (whisperError.status === 400) {
        return NextResponse.json(
          { error: 'Invalid audio format. Please try recording again.' },
          { status: 400 }
        );
      }
      
      if (whisperError.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
      
      throw whisperError;
    }
    
  } catch (error) {
    console.error('Error in transcribe API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to transcribe audio. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
} 