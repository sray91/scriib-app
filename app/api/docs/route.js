import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET handler for /api/docs endpoint
 * Returns a list of all markdown files in the public/docs directory
 */
export async function GET() {
  try {
    // Path to the public/docs directory
    const docsDirectory = path.join(process.cwd(), 'public', 'docs');
    
    // Read all files in the directory
    const files = fs.readdirSync(docsDirectory)
      // Filter to only include markdown files
      .filter(file => file.endsWith('.md'))
      // Sort alphabetically
      .sort();
    
    // Return the list of files
    return NextResponse.json({ 
      files,
      count: files.length 
    }, { status: 200 });
  } catch (error) {
    console.error('Error reading docs directory:', error);
    return NextResponse.json({ 
      error: 'Failed to read documentation files',
      message: error.message 
    }, { status: 500 });
  }
} 