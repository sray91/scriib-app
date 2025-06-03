import { NextResponse } from 'next/server';
import { getLinkedInConfig, LINKEDIN_MODES, validateLinkedInConfigs } from '@/lib/linkedin-config';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || LINKEDIN_MODES.STANDARD;
    
    // Validate configurations
    const validation = validateLinkedInConfigs();
    
    // Get the requested configuration
    const config = getLinkedInConfig(mode);
    
    // Return only PUBLIC configuration that's safe to expose
    const safeConfig = {
      LINKEDIN_CLIENT_ID: config.clientId,
      REDIRECT_URI: config.redirectUri,
      SCOPES: config.scopes.join(' '),
      API_BASE_URL: new URL(request.url).origin,
      MODE: mode,
      DESCRIPTION: config.description,
      AVAILABLE_MODES: {
        [LINKEDIN_MODES.STANDARD]: {
          available: validation.standard.valid,
          description: 'Standard authentication using OpenID Connect'
        },
        [LINKEDIN_MODES.PORTABILITY]: {
          available: validation.portability.valid,
          description: 'Data portability using Member Data Portability API'
        }
      }
    };

    // Validate that we have the required config
    if (!safeConfig.LINKEDIN_CLIENT_ID) {
      return NextResponse.json(
        { 
          error: `LinkedIn ${mode} configuration not available`,
          validation: validation
        },
        { status: 500 }
      );
    }

    return NextResponse.json(safeConfig);

  } catch (error) {
    console.error('❌ Config fetch error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch configuration',
        details: error.message
      },
      { status: 500 }
    );
  }
} 