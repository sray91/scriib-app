import { NextResponse } from 'next/server';

// Make sure to export the POST handler with the correct name
export async function POST(request) {
  try {
    const { content, accessToken, platformUserId, mediaFiles } = await request.json();

    // Log the access token (first few characters for debugging)
    console.log('Access Token Preview:', accessToken?.substring(0, 10) + '...');
    console.log('Platform User ID:', platformUserId);

    // Base post data
    const postData = {
      author: `urn:li:person:${platformUserId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: mediaFiles?.length > 0 ? 'IMAGE' : 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    // Handle media files if present
    if (mediaFiles?.length > 0) {
      const uploadedMedia = await Promise.all(
        mediaFiles.map(async (file) => {
          // Register media upload
          const registerResponse = await fetch(
            'https://api.linkedin.com/v2/assets?action=registerUpload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
              'LinkedIn-Version': '202304',
            },
            body: JSON.stringify({
              registerUploadRequest: {
                recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                owner: `urn:li:person:${platformUserId}`,
                serviceRelationships: [{
                  relationshipType: 'OWNER',
                  identifier: 'urn:li:userGeneratedContent'
                }]
              }
            })
          });

          if (!registerResponse.ok) {
            throw new Error('Failed to register media upload with LinkedIn');
          }

          const registerData = await registerResponse.json();
          const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
          const asset = registerData.value.asset;

          // Fetch the file from the URL
          const fileResponse = await fetch(file.url);
          const fileBlob = await fileResponse.blob();

          // Upload the file to LinkedIn
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
            body: fileBlob
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload media to LinkedIn');
          }

          return asset;
        })
      );

      // Add media to the post data
      postData.specificContent['com.linkedin.ugc.ShareContent'].media = uploadedMedia.map(media => ({
        status: 'READY',
        media: media,
      }));
    }

    // Log the post data
    console.log('LinkedIn Post Data:', JSON.stringify(postData, null, 2));

    // Create the post
    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202304',
      },
      body: JSON.stringify(postData)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('LinkedIn Post Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`LinkedIn API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ 
      success: true, 
      data,
      message: mediaFiles?.length > 0 
        ? `Posted successfully with ${mediaFiles.length} media file(s)` 
        : 'Posted successfully'
    });

  } catch (error) {
    console.error('Detailed Error:', {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        error: error.message || 'Failed to post to LinkedIn',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 