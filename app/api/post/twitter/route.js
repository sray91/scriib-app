import { TwitterApi } from 'twitter-api-v2';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('Received request body:', { ...body, accessToken: '[REDACTED]' });

    const { content, accessToken, mediaFiles } = body;

    if (!accessToken) {
      throw new Error('No access token provided');
    }

    if (!content) {
      throw new Error('No content provided');
    }

    console.log('Initializing Twitter client...');
    const client = new TwitterApi(accessToken);

    let mediaIds = [];
    
    // Upload media files if present
    if (mediaFiles && mediaFiles.length > 0) {
      console.log(`Attempting to upload ${mediaFiles.length} media files`);
      
      for (const file of mediaFiles) {
        console.log('Processing media file:', { type: file.type, url: file.url });
        
        try {
          // Fetch the file from URL
          const mediaResponse = await fetch(file.url);
          if (!mediaResponse.ok) {
            throw new Error(`Failed to fetch media file: ${mediaResponse.statusText}`);
          }
          
          const mediaBuffer = await mediaResponse.arrayBuffer();
          console.log('Media file fetched, size:', mediaBuffer.byteLength);

          // Upload to Twitter
          const mediaId = await client.v2.uploadMedia(
            Buffer.from(mediaBuffer),
            file.type.startsWith('video/') ? 'video/mp4' : file.type
          );
          console.log('Media uploaded to Twitter, ID:', mediaId);
          
          mediaIds.push(mediaId);
        } catch (mediaError) {
          console.error('Error processing media file:', mediaError);
          throw new Error(`Media upload failed: ${mediaError.message}`);
        }
      }
    }

    console.log('Creating tweet with content:', content);
    const tweetData = {
      text: content,
      ...(mediaIds.length > 0 && { media: { media_ids: mediaIds } })
    };
    console.log('Tweet data:', tweetData);

    const tweet = await client.v2.tweet(tweetData);
    console.log('Tweet created successfully:', tweet);

    return NextResponse.json({ success: true, data: tweet });
  } catch (error) {
    console.error('Detailed Twitter API error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to post to Twitter',
        details: error.data || error,
      },
      { status: error.status || 500 }
    );
  }
} 