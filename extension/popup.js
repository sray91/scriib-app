// LinkedIn Posts Sync Extension - Popup Script

class ExtensionPopup {
  constructor() {
    this.apiEndpoint = 'http://localhost:3000';
    this.userToken = null;
    this.isConnected = false;
    this.currentTab = null;
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.getCurrentTab();
    this.setupEventListeners();
    this.updateUI();
    this.checkConnectionStatus();
  }

  async loadSettings() {
    const settings = await chrome.storage.sync.get([
      'userToken',
      'apiEndpoint',
      'autoSync'
    ]);
    
    this.userToken = settings.userToken;
    this.apiEndpoint = settings.apiEndpoint || 'http://localhost:3000';
    
    // Update UI with saved settings
    document.getElementById('apiEndpoint').value = this.apiEndpoint;
    document.getElementById('userToken').value = this.userToken || '';
    document.getElementById('autoSyncCheck').checked = settings.autoSync || false;
  }

  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tab;
  }

  setupEventListeners() {
    // Connection button
    document.getElementById('connectBtn').addEventListener('click', () => {
      this.connectToCreatorTask();
    });

    // Sync controls
    document.getElementById('startSyncBtn').addEventListener('click', () => {
      this.startSync();
    });

    document.getElementById('stopSyncBtn').addEventListener('click', () => {
      this.stopSync();
    });

    // Settings
    document.getElementById('apiEndpoint').addEventListener('change', (e) => {
      this.apiEndpoint = e.target.value;
      this.saveSettings();
    });

    document.getElementById('userToken').addEventListener('input', (e) => {
      this.userToken = e.target.value;
      this.saveSettings();
      this.checkConnectionStatus();
    });

    document.getElementById('autoSyncCheck').addEventListener('change', (e) => {
      chrome.storage.sync.set({ autoSync: e.target.checked });
    });

    // Token visibility toggle
    document.getElementById('toggleToken').addEventListener('click', () => {
      const tokenInput = document.getElementById('userToken');
      tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
    });

    // Links
    document.getElementById('openCreatorTask').addEventListener('click', () => {
      chrome.tabs.create({ url: `${this.apiEndpoint}/linkedin-posts` });
    });

    document.getElementById('viewPosts').addEventListener('click', () => {
      chrome.tabs.create({ url: `${this.apiEndpoint}/linkedin-posts` });
    });

    // Update status periodically
    setInterval(() => this.updateSyncStatus(), 2000);
  }

  async saveSettings() {
    await chrome.storage.sync.set({
      userToken: this.userToken,
      apiEndpoint: this.apiEndpoint
    });
  }

  async connectToCreatorTask() {
    try {
      // Open CreatorTask extensions tab for token generation
      const authUrl = `${this.apiEndpoint}/settings?tab=extensions`;
      await chrome.tabs.create({ url: authUrl });
      
      // Show instructions
      this.showMessage('Generate your token in CreatorTask and paste it above', 'info');
      
    } catch (error) {
      this.showMessage('Failed to open CreatorTask', 'error');
      console.error('Connection error:', error);
    }
  }

  async checkConnectionStatus() {
    if (!this.userToken) {
      this.updateConnectionStatus(false, 'No token provided');
      return;
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/api/linkedin/posts/sync/extension`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          this.updateConnectionStatus(true, 'Connected to CreatorTask');
        } else {
          this.updateConnectionStatus(false, 'Token validation failed');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        this.updateConnectionStatus(false, errorData.error || 'Invalid token or connection failed');
      }
    } catch (error) {
      this.updateConnectionStatus(false, 'Connection error - Check if CreatorTask is running');
      console.error('Connection check error:', error);
    }
  }

  updateConnectionStatus(connected, message) {
    this.isConnected = connected;
    
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const connectBtn = document.getElementById('connectBtn');
    const syncSection = document.getElementById('syncSection');
    const headerStatus = document.getElementById('status');

    if (connected) {
      statusIndicator.textContent = '✅';
      statusText.textContent = message;
      connectBtn.textContent = 'Reconnect';
      syncSection.style.display = 'block';
      headerStatus.textContent = '● Online';
      headerStatus.style.color = '#22c55e';
    } else {
      statusIndicator.textContent = '⚠️';
      statusText.textContent = message;
      connectBtn.textContent = 'Connect to CreatorTask';
      syncSection.style.display = 'none';
      headerStatus.textContent = '● Offline';
      headerStatus.style.color = '#ef4444';
    }
  }

  updateUI() {
    // Check if we're on LinkedIn
    const isLinkedIn = this.currentTab?.url?.includes('linkedin.com');
    
    if (!isLinkedIn) {
      this.showMessage('Please visit LinkedIn.com to sync posts', 'info');
      document.getElementById('startSyncBtn').disabled = true;
    } else {
      document.getElementById('startSyncBtn').disabled = false;
    }
  }

  async startSync() {
    if (!this.isConnected) {
      this.showMessage('Please connect to CreatorTask first', 'error');
      return;
    }

    if (!this.currentTab?.url?.includes('linkedin.com')) {
      this.showMessage('Please visit LinkedIn.com to sync posts', 'error');
      return;
    }

    const maxPosts = parseInt(document.getElementById('maxPosts').value);
    const autoScroll = document.getElementById('autoScrollCheck').checked;

    try {
      console.log('Starting sync process...');
      
      // Inject a simple test function directly
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: this.currentTab.id },
          func: async (apiEndpoint, userToken) => {
            console.log('🧪 Direct injection test starting...');
            console.log('🔑 Token:', userToken ? 'Present' : 'Missing');
            console.log('🌐 API endpoint:', apiEndpoint);
            
            // Simple post detection test
            const postSelectors = [
              'div[data-urn*="urn:li:activity"]',
              '.feed-shared-update-v2',
              '.artdeco-card',
              '[data-id*="activity:"]'
            ];
            
            let totalElements = 0;
            let foundPosts = [];
            
            for (const selector of postSelectors) {
              const elements = document.querySelectorAll(selector);
              totalElements += elements.length;
              console.log(`🎯 Selector "${selector}" found ${elements.length} elements`);
              
              // Try to extract content from first few elements
              for (let i = 0; i < Math.min(3, elements.length); i++) {
                const element = elements[i];
                const textContent = element.innerText || element.textContent || '';
                
                if (textContent.length > 50) {
                  foundPosts.push({
                    selector: selector,
                    content: textContent.substring(0, 100) + '...',
                    length: textContent.length
                  });
                  console.log(`📝 Found content (${textContent.length} chars):`, textContent.substring(0, 100) + '...');
                }
              }
            }
            
                         console.log(`📊 Total elements found: ${totalElements}`);
             console.log(`📋 Posts with content: ${foundPosts.length}`);
             
             // Now actually send posts to API
             if (foundPosts.length > 0 && userToken) {
               console.log('🚀 Sending posts to API...');
               
               const postsToSend = foundPosts.map((post, index) => ({
                 platform_post_id: `scraped_${Date.now()}_${index}`,
                 content: post.content.replace('...', ''), // Remove truncation
                 published_at: new Date().toISOString(), // Fallback timestamp
                 post_url: window.location.href,
                 media_urls: null,
                 metrics: { likes: 0, comments: 0, shares: 0 },
                 post_type: 'text',
                 visibility: 'PUBLIC',
                 raw_data: {
                   scraped: true,
                   scrape_time: new Date().toISOString(),
                   selector: post.selector,
                   original_length: post.length
                 }
               }));
               
               try {
                 const apiResponse = await fetch(`${apiEndpoint}/api/linkedin/posts/sync/extension`, {
                   method: 'POST',
                   headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${userToken}`,
                     'X-Extension-Version': '1.0.0'
                   },
                   body: JSON.stringify({
                     posts: postsToSend,
                     source: 'extension',
                     timestamp: new Date().toISOString()
                   })
                 });
                 
                 console.log('📡 API Response status:', apiResponse.status);
                 const apiResult = await apiResponse.json();
                 console.log('📋 API Response data:', apiResult);
                 
                 if (apiResult.success) {
                   console.log(`✅ Successfully saved ${apiResult.data?.synced_count || postsToSend.length} posts to database`);
                   return {
                     success: true,
                     totalElements: totalElements,
                     foundPosts: foundPosts,
                     savedPosts: apiResult.data?.synced_count || postsToSend.length,
                     message: `Found ${foundPosts.length} posts, saved ${apiResult.data?.synced_count || postsToSend.length} to database`
                   };
                 } else {
                   console.error('❌ API Error:', apiResult.error);
                   return {
                     success: false,
                     error: `API Error: ${apiResult.error}`,
                     foundPosts: foundPosts
                   };
                 }
               } catch (apiError) {
                 console.error('❌ Network Error:', apiError);
                 return {
                   success: false,
                   error: `Network Error: ${apiError.message}`,
                   foundPosts: foundPosts
                 };
               }
             }
             
             return {
               success: true,
               totalElements: totalElements,
               foundPosts: foundPosts,
               message: `Found ${totalElements} elements, ${foundPosts.length} with content`
             };
          },
          args: [this.apiEndpoint, this.userToken]
        });
        
        console.log('🧪 Direct injection result:', result[0].result);
        
        const res = result[0].result;
        if (res.success && res.savedPosts > 0) {
          this.showMessage(`Successfully saved ${res.savedPosts} posts to database!`, 'success');
        } else if (res.foundPosts && res.foundPosts.length > 0) {
          this.showMessage(`Found ${res.foundPosts.length} posts but couldn't save them`, 'warning');
        } else if (res.totalElements > 0) {
          this.showMessage(`Found ${res.totalElements} elements but no readable content`, 'warning');
        } else {
          this.showMessage('No LinkedIn posts found on this page', 'error');
        }
        
      } catch (scriptError) {
        console.log('Direct injection failed:', scriptError);
        this.showMessage('Failed to test post detection', 'error');
      }

      document.getElementById('startSyncBtn').disabled = true;
      document.getElementById('stopSyncBtn').disabled = false;
      document.getElementById('syncStatus').textContent = 'Scanning...';
      
      this.showMessage('Sync started! Check LinkedIn for progress', 'success');
      
    } catch (error) {
      this.showMessage('Failed to start sync. Make sure you\'re on LinkedIn.com', 'error');
      console.error('Sync start error:', error);
    }
  }

  async stopSync() {
    try {
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'stopScraping'
      });

      document.getElementById('startSyncBtn').disabled = false;
      document.getElementById('stopSyncBtn').disabled = true;
      document.getElementById('syncStatus').textContent = 'Stopped';
      
      this.showMessage('Sync stopped', 'info');
      
    } catch (error) {
      console.error('Sync stop error:', error);
    }
  }

  async updateSyncStatus() {
    if (!this.currentTab?.url?.includes('linkedin.com')) return;

    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getStatus'
      });

      if (response) {
        document.getElementById('foundCount').textContent = `${response.scrapedCount} posts`;
        
        if (response.isActive) {
          document.getElementById('syncStatus').textContent = 'Active';
          document.getElementById('startSyncBtn').disabled = true;
          document.getElementById('stopSyncBtn').disabled = false;
        } else {
          document.getElementById('startSyncBtn').disabled = false;
          document.getElementById('stopSyncBtn').disabled = true;
        }
      }
    } catch (error) {
      // Content script might not be loaded yet
    }
  }

  showMessage(message, type = 'info') {
    // Create or update message element
    let messageEl = document.getElementById('popup-message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.id = 'popup-message';
      messageEl.className = 'message';
      document.querySelector('.content').insertBefore(messageEl, document.querySelector('.content').firstChild);
    }

    messageEl.textContent = message;
    messageEl.className = `message message-${type}`;
    messageEl.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (messageEl) {
        messageEl.style.display = 'none';
      }
    }, 5000);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ExtensionPopup();
}); 