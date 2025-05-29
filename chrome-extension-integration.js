/**
 * Chrome Extension LinkedIn OAuth Integration
 * Using your existing Next.js app with dynamic configuration
 */

// Base URL for your API (this is the only thing you need to hardcode)
const API_BASE_URL = 'https://app.creatortask.com'; // Update this
/**
 * Configuration Manager
 */
class ConfigManager {
  constructor() {
    this.config = null;
  }

  async getConfig() {
    if (this.config) {
      return this.config;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/chrome-extension/config`);
      if (!response.ok) {
        throw new Error('Failed to fetch configuration');
      }
      
      this.config = await response.json();
      return this.config;
    } catch (error) {
      console.error('❌ Failed to fetch config:', error);
      throw new Error('Could not load extension configuration');
    }
  }
}

/**
 * LinkedIn OAuth Service using your existing Next.js API
 */
class LinkedInOAuth {
  constructor() {
    this.accessToken = null;
    this.userProfile = null;
    this.configManager = new ConfigManager();
  }

  /**
   * Start the LinkedIn OAuth flow
   */
  async startOAuthFlow() {
    try {
      console.log('🔄 Starting LinkedIn OAuth flow...');
      
      // Get configuration dynamically
      const config = await this.configManager.getConfig();
      
      // Generate state parameter for security
      const state = this.generateRandomString(32);
      
      // Store state for verification
      await chrome.storage.local.set({ linkedin_oauth_state: state });
      
      // Build LinkedIn authorization URL
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
        `response_type=code&` +
        `client_id=${config.LINKEDIN_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(config.REDIRECT_URI)}&` +
        `scope=${encodeURIComponent(config.SCOPES)}&` +
        `state=${state}`;
      
      console.log('🔗 Opening LinkedIn authorization URL...');
      
      // Open LinkedIn authorization page
      return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        }, (callbackUrl) => {
          if (chrome.runtime.lastError) {
            console.error('❌ OAuth flow error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (!callbackUrl) {
            reject(new Error('No callback URL received'));
            return;
          }
          
          console.log('✅ OAuth callback received');
          this.handleOAuthCallback(callbackUrl).then(resolve).catch(reject);
        });
      });
      
    } catch (error) {
      console.error('❌ OAuth flow start error:', error);
      throw error;
    }
  }

  /**
   * Handle the OAuth callback and exchange code for token
   */
  async handleOAuthCallback(callbackUrl) {
    try {
      console.log('🔄 Processing OAuth callback...');
      
      const config = await this.configManager.getConfig();
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      
      // Check for errors
      if (error) {
        throw new Error(`LinkedIn OAuth error: ${error}`);
      }
      
      if (!code) {
        throw new Error('No authorization code received');
      }
      
      // Verify state parameter
      const storedState = await chrome.storage.local.get('linkedin_oauth_state');
      if (state !== storedState.linkedin_oauth_state) {
        throw new Error('Invalid state parameter');
      }
      
      // Clean up stored state
      await chrome.storage.local.remove('linkedin_oauth_state');
      
      // Exchange code for access token using our backend service
      const tokenData = await this.exchangeCodeForToken(code, config.REDIRECT_URI);
      
      if (!tokenData.access_token) {
        throw new Error('No access token received');
      }
      
      this.accessToken = tokenData.access_token;
      
      // Store access token securely
      await chrome.storage.local.set({
        linkedin_access_token: tokenData.access_token,
        linkedin_token_expires: Date.now() + (tokenData.expires_in * 1000)
      });
      
      // Fetch user profile
      await this.fetchUserProfile();
      
      console.log('✅ LinkedIn authentication successful');
      return {
        success: true,
        accessToken: this.accessToken,
        profile: this.userProfile
      };
      
    } catch (error) {
      console.error('❌ OAuth callback error:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token using your Next.js API
   */
  async exchangeCodeForToken(code, redirectUri) {
    try {
      console.log('🔄 Exchanging code for token via Next.js API...');
      
      const response = await fetch(`${API_BASE_URL}/api/chrome-extension/linkedin/token-exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: redirectUri
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token exchange failed: ${errorData.error}`);
      }
      
      const tokenData = await response.json();
      console.log('✅ Token exchange successful via Next.js API');
      
      return tokenData;
      
    } catch (error) {
      console.error('❌ Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Fetch LinkedIn user profile using your Next.js API
   */
  async fetchUserProfile() {
    try {
      console.log('🔄 Fetching LinkedIn profile via Next.js API...');
      
      if (!this.accessToken) {
        throw new Error('No access token available');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/chrome-extension/linkedin/profile`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Profile fetch failed: ${errorData.error}`);
      }
      
      this.userProfile = await response.json();
      
      // Store profile data
      await chrome.storage.local.set({
        linkedin_profile: this.userProfile
      });
      
      console.log('✅ LinkedIn profile fetched successfully via Next.js API');
      return this.userProfile;
      
    } catch (error) {
      console.error('❌ Profile fetch error:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    try {
      const stored = await chrome.storage.local.get([
        'linkedin_access_token', 
        'linkedin_token_expires'
      ]);
      
      if (!stored.linkedin_access_token || !stored.linkedin_token_expires) {
        return false;
      }
      
      // Check if token is expired
      if (Date.now() >= stored.linkedin_token_expires) {
        console.log('⚠️ LinkedIn token expired');
        await this.logout();
        return false;
      }
      
      this.accessToken = stored.linkedin_access_token;
      return true;
      
    } catch (error) {
      console.error('❌ Authentication check error:', error);
      return false;
    }
  }

  /**
   * Get stored user profile
   */
  async getUserProfile() {
    try {
      if (this.userProfile) {
        return this.userProfile;
      }
      
      const stored = await chrome.storage.local.get('linkedin_profile');
      this.userProfile = stored.linkedin_profile;
      
      return this.userProfile;
      
    } catch (error) {
      console.error('❌ Get profile error:', error);
      return null;
    }
  }

  /**
   * Logout and clear stored data
   */
  async logout() {
    try {
      console.log('🔄 Logging out of LinkedIn...');
      
      this.accessToken = null;
      this.userProfile = null;
      
      await chrome.storage.local.remove([
        'linkedin_access_token',
        'linkedin_token_expires',
        'linkedin_profile',
        'linkedin_oauth_state'
      ]);
      
      console.log('✅ LinkedIn logout successful');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  }

  /**
   * Generate random string for state parameter
   */
  generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

/**
 * Alternative: Use your existing web app OAuth with iframe communication
 */
class WebAppOAuthBridge {
  constructor() {
    this.iframe = null;
  }

  /**
   * Use your existing web app OAuth flow via iframe
   */
  async startOAuthFlow() {
    return new Promise((resolve, reject) => {
      // Create hidden iframe
      this.iframe = document.createElement('iframe');
      this.iframe.style.display = 'none';
      this.iframe.src = `${API_BASE_URL}/auth/linkedin?extension=true`;
      
      // Listen for messages from iframe
      const messageListener = (event) => {
        if (event.origin !== API_BASE_URL) return;
        
        if (event.data.type === 'OAUTH_SUCCESS') {
          // Clean up
          window.removeEventListener('message', messageListener);
          document.body.removeChild(this.iframe);
          
          resolve(event.data.tokens);
        } else if (event.data.type === 'OAUTH_ERROR') {
          window.removeEventListener('message', messageListener);
          document.body.removeChild(this.iframe);
          
          reject(new Error(event.data.error));
        }
      };
      
      window.addEventListener('message', messageListener);
      document.body.appendChild(this.iframe);
    });
  }
}

/**
 * Usage Examples
 */

// Initialize the OAuth service
const linkedInAuth = new LinkedInOAuth();

// Example: Login button handler
async function handleLinkedInLogin() {
  try {
    // Check if already authenticated
    if (await linkedInAuth.isAuthenticated()) {
      console.log('✅ Already authenticated');
      const profile = await linkedInAuth.getUserProfile();
      console.log('User profile:', profile);
      return;
    }
    
    // Start OAuth flow
    const result = await linkedInAuth.startOAuthFlow();
    console.log('✅ Authentication successful:', result);
    
    // Update UI or perform other actions
    updateUIWithProfile(result.profile);
    
  } catch (error) {
    console.error('❌ Login failed:', error);
    showError('LinkedIn login failed. Please try again.');
  }
}

// Example: Logout button handler
async function handleLinkedInLogout() {
  try {
    await linkedInAuth.logout();
    console.log('✅ Logout successful');
    
    // Update UI
    updateUIForLoggedOut();
    
  } catch (error) {
    console.error('❌ Logout failed:', error);
  }
}

// Example: Check authentication status on extension startup
async function checkAuthStatus() {
  try {
    if (await linkedInAuth.isAuthenticated()) {
      const profile = await linkedInAuth.getUserProfile();
      console.log('✅ User is authenticated:', profile);
      updateUIWithProfile(profile);
    } else {
      console.log('ℹ️ User is not authenticated');
      updateUIForLoggedOut();
    }
  } catch (error) {
    console.error('❌ Auth status check failed:', error);
  }
}

// Helper functions (implement these based on your UI)
function updateUIWithProfile(profile) {
  // Update your extension's UI with user profile
  console.log('Updating UI with profile:', profile);
}

function updateUIForLoggedOut() {
  // Update your extension's UI for logged out state
  console.log('Updating UI for logged out state');
}

function showError(message) {
  // Show error message to user
  console.error(message);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LinkedInOAuth, WebAppOAuthBridge, ConfigManager };
} 