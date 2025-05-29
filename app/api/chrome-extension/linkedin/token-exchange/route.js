import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    console.log('🔄 Chrome Extension: Processing OAuth token exchange...');
    
    const { code, redirect_uri } = await request.json();

    // Validate request parameters
    if (!code || !redirect_uri) {
      console.error('❌ Missing parameters:', { code: !!code, redirect_uri: !!redirect_uri });
      return NextResponse.json(
        { error: 'Missing required parameters: code and redirect_uri' },
        { status: 400 }
      );
    }

    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      console.error('LinkedIn credentials not configured');
      return NextResponse.json(
        { error: 'LinkedIn credentials not configured' },
        { status: 500 }
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: redirect_uri
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.access_token) {
      console.log('✅ Chrome Extension: OAuth token exchange successful');
      
      // Return only necessary data (never expose client secret)
      return NextResponse.json({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type || 'Bearer'
      });
    } else {
      console.error('❌ LinkedIn token exchange failed:', tokenData);
      return NextResponse.json(
        { 
          error: 'Failed to exchange code for token',
          details: tokenData.error_description || 'Unknown error'
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('❌ Chrome Extension OAuth token exchange error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during token exchange',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Contact support'
      },
      { status: 500 }
    );
  }
} 