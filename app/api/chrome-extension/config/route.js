import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Return only PUBLIC configuration that's safe to expose
    const config = {
      LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
      REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || `${new URL(request.url).origin}/auth/linkedin/callback`,
      SCOPES: [
        'r_liteprofile',
        'r_emailaddress',
        'w_member_social', 
        'r_member_social'
      ].join(' '),
      API_BASE_URL: new URL(request.url).origin
    };

    // Validate that we have the required config
    if (!config.LINKEDIN_CLIENT_ID) {
      return NextResponse.json(
        { error: 'LinkedIn configuration not available' },
        { status: 500 }
      );
    }

    return NextResponse.json(config);

  } catch (error) {
    console.error('❌ Config fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
} 