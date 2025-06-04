/**
 * LinkedIn Configuration Manager
 * Handles multiple LinkedIn app configurations for different use cases
 */

export const LINKEDIN_MODES = {
  STANDARD: 'standard',      // For user authentication/login (OpenID Connect)
  PORTABILITY: 'portability' // For data portability features (Member Data Portability API)
};

export const LINKEDIN_CONFIGS = {
  [LINKEDIN_MODES.STANDARD]: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/api/auth/linkedin/callback',
    scopes: ['openid', 'profile', 'email'],
    apiEndpoint: 'https://api.linkedin.com/v2/userinfo',
    description: 'Standard authentication using OpenID Connect (Creator Task app)'
  },
  
  [LINKEDIN_MODES.PORTABILITY]: {
    clientId: process.env.LINKEDIN_PORTABILITY_CLIENT_ID || process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_PORTABILITY_CLIENT_SECRET || process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_PORTABILITY_REDIRECT_URI || process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/api/auth/linkedin/callback',
    scopes: ['openid', 'profile', 'email', 'w_member_social'],
    apiEndpoint: 'https://api.linkedin.com/v2/userinfo',
    description: 'Data portability using Member Data Portability API (Ghostletter Analytics app)'
  }
};

/**
 * Get LinkedIn configuration for a specific mode
 * @param {string} mode - LINKEDIN_MODES.STANDARD or LINKEDIN_MODES.PORTABILITY
 * @returns {object} LinkedIn configuration
 */
export function getLinkedInConfig(mode = LINKEDIN_MODES.STANDARD) {
  const config = LINKEDIN_CONFIGS[mode];
  
  if (!config) {
    throw new Error(`Unknown LinkedIn mode: ${mode}`);
  }
  
  if (!config.clientId || !config.clientSecret) {
    throw new Error(`LinkedIn ${mode} mode is not properly configured. Missing client credentials.`);
  }
  
  return config;
}

/**
 * Validate all LinkedIn configurations
 */
export function validateLinkedInConfigs() {
  const results = {};
  
  for (const [mode, config] of Object.entries(LINKEDIN_CONFIGS)) {
    results[mode] = {
      isValid: !!(config.clientId && config.clientSecret && config.redirectUri),
      hasClientId: !!config.clientId,
      hasClientSecret: !!config.clientSecret,
      hasRedirectUri: !!config.redirectUri,
      description: config.description
    };
  }
  
  return results;
} 