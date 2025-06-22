import { NextResponse } from 'next/server';
import { getLinkedInConfig, LINKEDIN_MODES } from '@/lib/linkedin-config';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || LINKEDIN_MODES.PORTABILITY;
    
    const config = getLinkedInConfig(mode);
    
    return NextResponse.json({
      mode,
      config: {
        clientId: config.clientId ? config.clientId.substring(0, 8) + '...' : 'NOT SET',
        clientSecret: config.clientSecret ? 'SET' : 'NOT SET', 
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        description: config.description
      },
      environment_variables: {
        LINKEDIN_PORTABILITY_REDIRECT_URI: process.env.LINKEDIN_PORTABILITY_REDIRECT_URI || 'NOT SET',
        LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || 'NOT SET',
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 