/**
 * Unipile API Client
 * Handles all interactions with the Unipile API for LinkedIn outreach
 * Documentation: https://developer.unipile.com/docs
 */

class UnipileClient {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey || process.env.UNIPILE_API_KEY
    this.baseUrl = baseUrl || process.env.UNIPILE_API_BASE_URL

    if (!this.apiKey) {
      throw new Error('Unipile API key is required')
    }

    if (!this.baseUrl) {
      throw new Error('Unipile API base URL is required. Please set UNIPILE_API_BASE_URL in your environment variables.')
    }
  }

  /**
   * Make a request to the Unipile API
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'X-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    try {
      console.log(`Unipile API request: ${options.method || 'GET'} ${url}`)

      const response = await fetch(url, {
        ...options,
        headers,
      })

      const data = await response.json()

      console.log(`Unipile API response (${response.status}):`, JSON.stringify(data, null, 2))

      if (!response.ok) {
        const errorMessage = data.error || data.message || `Unipile API error: ${response.status}`
        console.error(`Unipile API error:`, { status: response.status, data })
        throw new Error(errorMessage)
      }

      return data
    } catch (error) {
      console.error(`Unipile API request failed: ${endpoint}`, error)
      throw error
    }
  }

  // ============================================
  // ACCOUNT MANAGEMENT
  // ============================================

  /**
   * List all connected accounts
   */
  async listAccounts() {
    return this.request('/accounts')
  }

  /**
   * Get a specific account by ID
   */
  async getAccount(accountId) {
    return this.request(`/accounts/${accountId}`)
  }

  /**
   * Create/connect a new LinkedIn account
   * This typically requires user interaction through Unipile's hosted auth flow
   */
  async createAccount(accountData) {
    return this.request('/accounts', {
      method: 'POST',
      body: JSON.stringify(accountData),
    })
  }

  /**
   * Delete an account
   */
  async deleteAccount(accountId) {
    return this.request(`/accounts/${accountId}`, {
      method: 'DELETE',
    })
  }

  // ============================================
  // LINKEDIN CONNECTIONS
  // ============================================

  /**
   * Get LinkedIn user profile to extract their provider ID
   * @param {string} accountId - Unipile account ID
   * @param {string} identifier - LinkedIn public identifier (e.g., "ryancahalane" from linkedin.com/in/ryancahalane)
   * @returns {Promise} Profile data including provider_id
   */
  async getLinkedInProfile(accountId, identifier) {
    // Use GET endpoint to retrieve user profile by their public identifier
    // Documentation: https://developer.unipile.com/docs/invite-users
    return this.request(`/users/${identifier}?account_id=${accountId}`)
  }

  /**
   * Send a connection request on LinkedIn
   * @param {string} accountId - Unipile account ID
   * @param {string} profileUrl - LinkedIn profile URL or ID
   * @param {string} message - Optional connection message
   */
  async sendConnectionRequest(accountId, profileUrl, message = '') {
    // Use the correct Unipile endpoint for sending LinkedIn invitations
    // Documentation: https://developer.unipile.com/docs/linkedin
    // API requires 'provider_id' parameter (confirmed by error message)
    return this.request(`/users/invite`, {
      method: 'POST',
      body: JSON.stringify({
        account_id: accountId,
        provider_id: profileUrl,
        message: message,
      }),
    })
  }

  /**
   * Check if a LinkedIn user is already a connection
   * This uses the getLinkedInProfile method and checks the network_distance field
   * @param {string} accountId - Unipile account ID
   * @param {string} identifier - LinkedIn public identifier (e.g., "ryancahalane")
   * @returns {Promise<{isConnected: boolean, isPending: boolean, networkDistance: string}>}
   */
  async checkConnectionStatus(accountId, identifier) {
    const profile = await this.getLinkedInProfile(accountId, identifier)

    return {
      isConnected: profile.network_distance === 'FIRST_DEGREE' || profile.is_relationship === true,
      isPending: profile.pending_invitation === true,
      networkDistance: profile.network_distance,
      profile: profile, // Return full profile for additional context
    }
  }

  // ============================================
  // MESSAGING
  // ============================================

  /**
   * List all chats/conversations
   */
  async listChats(accountId, options = {}) {
    const params = new URLSearchParams(options)
    return this.request(`/chats/${accountId}?${params}`)
  }

  /**
   * Get a specific chat
   */
  async getChat(accountId, chatId) {
    return this.request(`/chats/${accountId}/${chatId}`)
  }

  /**
   * Start a new chat
   * @param {string} accountId - Unipile account ID
   * @param {string} profileUrl - LinkedIn profile URL or ID
   */
  async startChat(accountId, profileUrl) {
    return this.request(`/chats/${accountId}`, {
      method: 'POST',
      body: JSON.stringify({
        provider_id: profileUrl,
        provider: 'LINKEDIN',
      }),
    })
  }

  /**
   * Send a message in an existing chat
   * @param {string} accountId - Unipile account ID
   * @param {string} chatId - Chat ID
   * @param {string} text - Message text
   */
  async sendMessage(accountId, chatId, text) {
    return this.request(`/chats/${accountId}/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        text: text,
      }),
    })
  }

  /**
   * Get messages from a chat
   */
  async getMessages(accountId, chatId, options = {}) {
    const params = new URLSearchParams(options)
    return this.request(`/chats/${accountId}/${chatId}/messages?${params}`)
  }

  // ============================================
  // LINKEDIN PROFILE ACTIONS
  // ============================================

  /**
   * Perform an action with a LinkedIn profile
   * @param {string} accountId - Unipile account ID
   * @param {string} profileUrl - LinkedIn profile URL
   * @param {string} action - Action type (e.g., 'CONNECT', 'MESSAGE')
   * @param {object} params - Additional parameters
   */
  async performProfileAction(accountId, profileUrl, action, params = {}) {
    return this.request(`/accounts/${accountId}/linkedin/action`, {
      method: 'POST',
      body: JSON.stringify({
        profile_url: profileUrl,
        action: action,
        ...params,
      }),
    })
  }

  // ============================================
  // SEARCH
  // ============================================

  /**
   * Search LinkedIn profiles
   * @param {string} accountId - Unipile account ID
   * @param {object} searchParams - Search parameters
   */
  async searchLinkedIn(accountId, searchParams) {
    return this.request(`/accounts/${accountId}/linkedin/search`, {
      method: 'POST',
      body: JSON.stringify(searchParams),
    })
  }

  // ============================================
  // HOSTED AUTHENTICATION
  // ============================================

  /**
   * Create a hosted auth link for connecting accounts
   * @param {object} options - Configuration options
   * @param {string} options.type - 'create' or 'reconnect'
   * @param {string|array} options.providers - Provider(s) to connect (e.g., 'LINKEDIN' or ['LINKEDIN'])
   * @param {string} options.expiresOn - ISO 8601 expiration date
   * @param {string} options.success_redirect_url - URL to redirect on success
   * @param {string} options.failure_redirect_url - URL to redirect on failure
   * @param {string} options.notify_url - Webhook URL for connection notifications
   * @param {string} options.name - Internal user ID for matching
   * @param {string} options.reconnect_account - Account ID (required for reconnect type)
   */
  async createHostedAuthLink(options = {}) {
    const {
      type = 'create',
      providers = ['LINKEDIN'],
      expiresOn,
      success_redirect_url,
      failure_redirect_url,
      notify_url,
      name,
      reconnect_account,
    } = options

    // Default expiration: 1 hour from now
    const defaultExpiration = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const payload = {
      type,
      providers: Array.isArray(providers) ? providers : [providers],
      api_url: this.baseUrl,
      expiresOn: expiresOn || defaultExpiration,
    }

    // Add optional parameters
    if (success_redirect_url) payload.success_redirect_url = success_redirect_url
    if (failure_redirect_url) payload.failure_redirect_url = failure_redirect_url
    if (notify_url) payload.notify_url = notify_url
    if (name) payload.name = name
    if (type === 'reconnect' && reconnect_account) {
      payload.reconnect_account = reconnect_account
    }

    return this.request('/hosted/accounts/link', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * Register a webhook
   * @param {string} url - Webhook URL
   * @param {array} events - Event types to listen for
   */
  async registerWebhook(url, events = []) {
    return this.request('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        url: url,
        events: events,
      }),
    })
  }

  /**
   * List webhooks
   */
  async listWebhooks() {
    return this.request('/webhooks')
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId) {
    return this.request(`/webhooks/${webhookId}`, {
      method: 'DELETE',
    })
  }
}

// Create a singleton instance
let unipileClient = null

export function getUnipileClient() {
  if (!unipileClient) {
    unipileClient = new UnipileClient()
  }
  return unipileClient
}

export default UnipileClient
