import { TwitterApi } from 'twitter-api-v2';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { content, accessToken, mediaFiles } = await request.json();

    const client = new TwitterApi(accessToken);

    let mediaIds = [];
    
    // Upload media files if present
    if (mediaFiles && mediaFiles.length > 0) {
      for (const file of mediaFiles) {
        // Fetch the file from Supabase URL
        const mediaResponse = await fetch(file.url);
        const mediaBuffer = await mediaResponse.arrayBuffer();
        
        // Upload to Twitter
        const mediaId = await client.v2.uploadMedia(
          Buffer.from(mediaBuffer),
          file.type.startsWith('video/') ? 'video/mp4' : file.type
        );
        mediaIds.push(mediaId);
      }
    }

    // Create the tweet
    const tweet = await client.v2.tweet({
      text: content,
      ...(mediaIds.length > 0 && { media: { media_ids: mediaIds } })
    });

    return NextResponse.json({ success: true, data: tweet });
  } catch (error) {
    console.error('Error posting to Twitter:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post to Twitter' },
      { status: 500 }
    );
  }
} 