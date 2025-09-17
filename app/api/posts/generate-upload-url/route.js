import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Use service role key for signed URL generation
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    const { fileName, fileType, fileSize } = await request.json();
    
    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: 'Missing fileName or fileType' },
        { status: 400 }
      );
    }

    // Validate file size (5GB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      const maxSizeMB = MAX_FILE_SIZE / 1024 / 1024;
      return NextResponse.json(
        { 
          error: `File size too large. Maximum size is ${maxSizeMB}MB. Your file is ${(fileSize / 1024 / 1024).toFixed(2)}MB.` 
        },
        { status: 413 }
      );
    }

    // Generate unique filename
    const uniqueId = uuidv4();
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${uniqueId}${fileExtension}`;

    console.log(`Generating signed URL for: ${fileName}, size: ${fileSize} bytes, type: ${fileType}`);

    // Generate signed URL for upload (valid for 10 minutes)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('post-media')
      .createSignedUploadUrl(uniqueFileName, {
        expiresIn: 600 // 10 minutes
      });

    if (signedUrlError) {
      console.error('Signed URL generation error:', signedUrlError);
      throw signedUrlError;
    }

    // Get the public URL that will be available after upload
    const { data: { publicUrl } } = supabase.storage
      .from('post-media')
      .getPublicUrl(uniqueFileName);

    return NextResponse.json({
      success: true,
      uploadUrl: signedUrlData.signedUrl,
      fileName: uniqueFileName,
      publicUrl,
      token: signedUrlData.token
    });

  } catch (error) {
    console.error('Generate upload URL error:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
