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
      const response = await fetch(url, {
        ...options,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || `Unipile API error: ${response.status}`)
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
   * Send a connection request on LinkedIn
   * @param {string} accountId - Unipile account ID
   * @param {string} profileUrl - LinkedIn profile URL or ID
   * @param {string} message - Optional connection message
   */
  async sendConnectionRequest(accountId, profileUrl, message = '') {
    return this.request(`/users/${accountId}/linkedin/connect`, {
      method: 'POST',
      body: JSON.stringify({
        profile_url: profileUrl,
        message: message,
      }),
    })
  }

  /**
   * Get connection status
   * @param {string} accountId - Unipile account ID
   * @param {string} profileUrl - LinkedIn profile URL or ID
   */
  async getConnectionStatus(accountId, profileUrl) {
    return this.request(`/users/${accountId}/linkedin/connection-status`, {
      method: 'POST',
      body: JSON.stringify({
        profile_url: profileUrl,
      }),
    })
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
    return this.request(`/users/${accountId}/linkedin/action`, {
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
    return this.request(`/users/${accountId}/linkedin/search`, {
      method: 'POST',
      body: JSON.stringify(searchParams),
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
