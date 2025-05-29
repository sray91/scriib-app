import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    console.log('🔄 Chrome Extension: Fetching LinkedIn profile...');
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Fetch user profile from LinkedIn
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'LinkedIn-Version': '202304',
        'X-Restli-Protocol-Version': '2.0.0',
        'Accept': 'application/json',
      }
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('❌ Profile fetch failed:', errorText);
      return NextResponse.json(
        { 
          error: 'Failed to fetch profile',
          details: errorText
        },
        { status: profileResponse.status }
      );
    }

    const profileData = await profileResponse.json();
    console.log('✅ Chrome Extension: LinkedIn profile fetched successfully');
    
    return NextResponse.json(profileData);

  } catch (error) {
    console.error('❌ Chrome Extension profile fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during profile fetch',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Contact support'
      },
      { status: 500 }
    );
  }
} 