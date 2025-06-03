import { NextResponse } from 'next/server';
import { getLinkedInConfig, LINKEDIN_MODES } from '@/lib/linkedin-config';

export async function GET(request) {
  try {
    const baseURL = new URL(request.url).origin;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || LINKEDIN_MODES.STANDARD; // Default to standard auth

    console.log(`LinkedIn auth initialization with mode: ${mode}`);

    // Get configuration for the specified mode
    const config = getLinkedInConfig(mode);
    console.log(`Using ${config.description}`);
    console.log('Using redirect URI:', config.redirectUri);

    const scopes = config.scopes.join(' ');
    
    // Encode mode in state parameter so it gets passed back
    const stateData = JSON.stringify({ mode });
    
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
      `response_type=code&` +
      `client_id=${config.clientId}&` +
      `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `prompt=select_account&` +
      `state=${encodeURIComponent(stateData)}`;

    console.log('Redirecting to LinkedIn auth URL');
    
    // Redirect to LinkedIn's authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('LinkedIn auth initialization error:', error);
    const baseURL = new URL(request.url).origin;
    return NextResponse.redirect(`${baseURL}/settings?error=linkedin_config_error&details=${encodeURIComponent(error.message)}`);
  }
}