import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Configure route segment for larger file uploads
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout

// Use service role key for uploads to bypass RLS and size limits
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_SUPABASE_SERVICE_KEY
);

export async function POST(request) {
  try {
    // Add timeout handling for large files
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const formData = await request.formData();
    const file = formData.get('file');
    
    clearTimeout(timeoutId);
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    console.log(`Uploading file: ${file.name}, size: ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)} MB), type: ${file.type}`);

    // Check file size - Allow up to 5GB for standard/resumable uploads
    const isVideo = file.type?.startsWith('video/');
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB limit for all files
    if (file.size > MAX_FILE_SIZE) {
      const maxSizeMB = MAX_FILE_SIZE / 1024 / 1024;
      return NextResponse.json(
        { 
          error: `File size too large. Maximum size is ${maxSizeMB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.` 
        },
        { status: 413 }
      );
    }

    // Generate a unique filename
    const uniqueId = uuidv4();
    const fileExtension = path.extname(file.name);
    const fileName = `${uniqueId}${fileExtension}`;
    
    // Use different upload methods based on file size
    if (file.size > 6 * 1024 * 1024) { // >6MB - use resumable upload
      console.log('Using resumable upload for large file...');
      
      // Convert file to buffer
      const bytes = await file.arrayBuffer();
      
      // Use resumable upload for larger files
      const { error } = await supabase.storage
        .from('post-media')
        .upload(fileName, bytes, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
          resumable: true
        });

      if (error) {
        console.error('Resumable upload error:', error);
        throw error;
      }
      
      console.log('Resumable upload successful');
    } else {
      console.log('Using standard upload for small file...');
      
      // Convert file to buffer for standard upload
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Standard upload for smaller files
      const { error } = await supabase.storage
        .from('post-media')
        .upload(fileName, buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Standard upload error:', error);
        throw error;
      }
      
      console.log('Standard upload successful');
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('post-media')
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      fileName,
      filePath: publicUrl
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 