// LinkedIn Posts Sync - Content Script
// Scrapes post data directly from LinkedIn's DOM

console.log('🚀 LinkedIn Posts Sync content script loaded at:', new Date().toISOString());
console.log('📍 Current URL:', window.location.href);
console.log('🔍 Page title:', document.title);

// Prevent multiple instances of the scraper
if (window.linkedInPostScraper) {
  console.log('🔄 LinkedInPostScraper already exists, using existing instance');
} else {
  console.log('🆕 Creating new LinkedInPostScraper instance');

class LinkedInPostScraper {
  constructor() {
    this.instanceId = Math.random().toString(36).substr(2, 9);
    console.log('🏗️ LinkedInPostScraper constructor called, Instance ID:', this.instanceId);
    this.scraped = new Set(); // Track scraped posts to avoid duplicates
    this.isActive = false;
    this.userToken = null;
    this.apiEndpoint = null;
    
    console.log('🔧 Calling init()...');
    this.init();
  }

  async init() {
    // Get user settings from extension storage
    const settings = await chrome.storage.sync.get([
      'userToken',
      'apiEndpoint',
      'autoSync'
    ]);
    
    this.userToken = settings.userToken;
    this.apiEndpoint = settings.apiEndpoint || 'http://localhost:3000';
    
    if (settings.autoSync && this.userToken) {
      this.startAutoScraping();
    }
    
    this.addSyncButtons();
    this.setupMessageListener();
  }

  setupMessageListener() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('🔍 Content script received message:', request);
      console.log('🔍 Instance ID:', this.instanceId);
      console.log('🔍 Methods available:', {
        startScraping: typeof this.startScraping,
        stopScraping: typeof this.stopScraping,
        scrapeVisiblePosts: typeof this.scrapeVisiblePosts
      });
      
      try {
        if (request.action === 'startScraping') {
          console.log('📨 Received startScraping message with options:', request.options);
          
          // Update settings from popup
          if (request.options.apiEndpoint) {
            this.apiEndpoint = request.options.apiEndpoint;
            console.log('🌐 Updated API endpoint:', this.apiEndpoint);
          }
          if (request.options.userToken) {
            this.userToken = request.options.userToken;
            console.log('🔑 Updated user token:', this.userToken ? 'Present' : 'Missing');
          }
          
          console.log('🚀 About to call startScraping...');
          try {
            this.startScraping(request.options);
            console.log('✅ startScraping called successfully');
            sendResponse({ success: true, message: 'Scraping started' });
          } catch (error) {
            console.error('❌ Error in startScraping:', error);
            sendResponse({ success: false, error: error.message });
          }
        } else if (request.action === 'stopScraping') {
          this.stopScraping();
          sendResponse({ success: true, message: 'Scraping stopped' });
        } else if (request.action === 'getStatus') {
          sendResponse({ 
            success: true,
            isActive: this.isActive,
            scrapedCount: this.scraped.size,
            hasToken: !!this.userToken
          });
        } else if (request.action === 'testExtraction') {
          // Test post extraction without sending to API
          const posts = this.scrapeVisiblePosts();
          sendResponse({ 
            success: true, 
            message: `Found ${posts.length} posts`,
            posts: posts.slice(0, 3).map(p => ({
              id: p.platform_post_id,
              content: p.content.substring(0, 100) + '...',
              hasContent: !!p.content
            }))
          });
        } else {
          sendResponse({ success: false, error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Content script error:', error);
        sendResponse({ success: false, error: error.message });
      }
      
      return true; // Keep message channel open for async response
    });
  }

  addSyncButtons() {
    // Add sync buttons to LinkedIn posts for quick access
    const style = document.createElement('style');
    style.textContent = `
      .linkedin-sync-btn {
        background: #0073b1;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        margin-left: 8px;
        opacity: 0.8;
        transition: opacity 0.2s;
      }
      .linkedin-sync-btn:hover {
        opacity: 1;
      }
      .linkedin-sync-indicator {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #0073b1;
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
    `;
    document.head.appendChild(style);
  }

  startScraping(options = {}) {
    console.log('🎯 ENTERING startScraping method');
    console.log('🎯 Options received:', options);
    
    try {
      this.isActive = true;
      console.log('🎯 Set isActive to true');
      
      this.showIndicator('🔄 Scanning LinkedIn posts...');
      console.log('🎯 Indicator shown');
      
      console.log('🚀 Starting scraping with options:', options);
      console.log('🔑 Token available:', !!this.userToken);
      console.log('🌐 API endpoint:', this.apiEndpoint);
      
      // Simple test: just count elements
      const allDivs = document.querySelectorAll('div');
      console.log(`🎯 Found ${allDivs.length} div elements on page`);
      
      // Test post selectors
      const postSelectors = [
        'div[data-urn*="urn:li:activity"]',
        '.feed-shared-update-v2',
        '.artdeco-card'
      ];
      
      let totalElements = 0;
      for (const selector of postSelectors) {
        const elements = document.querySelectorAll(selector);
        totalElements += elements.length;
        console.log(`🎯 Selector "${selector}" found ${elements.length} elements`);
      }
      
      console.log(`🎯 Total potential post elements: ${totalElements}`);
      
      // Scrape posts currently visible
      const foundPosts = this.scrapeVisiblePosts();
      console.log(`📊 Initial scrape found ${foundPosts.length} posts`);
      
      // Set up observer for new posts loaded via infinite scroll
      this.setupScrollObserver();
      console.log('🎯 Observer set up');
      
      // Auto-scroll to load more posts if requested
      if (options.autoScroll) {
        console.log('🔄 Starting auto-scroll...');
        this.autoScrollAndScrape(options.maxPosts || 50);
      } else {
        console.log('⏹️ Auto-scroll disabled');
      }
      
      console.log('🎯 EXITING startScraping method successfully');
    } catch (error) {
      console.error('🎯 ERROR in startScraping:', error);
      throw error;
    }
  }

  stopScraping() {
    this.isActive = false;
    this.hideIndicator();
    
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
    }
    
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
    }
  }

  scrapeVisiblePosts() {
    console.log('🔍 Starting to scrape visible posts...');
    
    // Updated LinkedIn post selectors for 2024
    const postSelectors = [
      'div[data-urn*="urn:li:activity"]',           // Main activity posts
      'article[data-urn*="activity"]',              // Article posts
      '.feed-shared-update-v2',                     // Feed updates
      '.artdeco-card',                              // Card-based posts
      '[data-id*="activity:"]',                     // Activity with data-id
      '.feed-shared-update-v2__description',        // Post content containers
      '.update-components-text',                    // Text update components
      '.share-update-card',                         // Shared update cards
      '.feed-shared-article',                       // Shared articles
      '.feed-shared-text'                           // Text-only posts
    ];

    let posts = [];
    let totalElements = 0;
    
    for (const selector of postSelectors) {
      const elements = document.querySelectorAll(selector);
      totalElements += elements.length;
      console.log(`📍 Found ${elements.length} elements for selector: ${selector}`);
      
      elements.forEach((element, index) => {
        try {
          const post = this.extractPostData(element);
          if (post && !this.scraped.has(post.platform_post_id)) {
            posts.push(post);
            this.scraped.add(post.platform_post_id);
            console.log(`✅ Extracted post ${index + 1}:`, {
              id: post.platform_post_id,
              content: post.content.substring(0, 100) + '...',
              published_at: post.published_at
            });
          }
        } catch (error) {
          console.error('❌ Error extracting post data:', error);
        }
      });
    }

    console.log(`📊 Scraping summary: ${totalElements} elements checked, ${posts.length} new posts found`);

    if (posts.length > 0) {
      console.log('📤 About to send posts to API:', posts);
      this.sendPostsToAPI(posts);
      this.updateIndicator(`✅ Found ${this.scraped.size} posts total`);
    } else {
      this.updateIndicator(`🔍 Scanning... ${this.scraped.size} posts found`);
      console.log('❌ No new posts found in this scrape cycle');
    }

    return posts;
  }

  extractPostData(element) {
    try {
      // Extract post ID from data attributes
      const urnElement = element.querySelector('[data-urn]') || element;
      const urn = urnElement.getAttribute('data-urn') || 
                  urnElement.getAttribute('data-activity-urn') ||
                  urnElement.getAttribute('data-post-urn');
      
      if (!urn) {
        // Generate fallback ID from content hash
        const content = this.extractContent(element);
        if (!content) return null;
        
        const id = 'scraped_' + this.hashCode(content + Date.now());
        const post = this.buildPostObject(element, id);
        return post;
      }

      const postId = urn.split(':').pop() || urn;
      return this.buildPostObject(element, postId);
      
    } catch (error) {
      console.error('Error extracting post data:', error);
      return null;
    }
  }

  buildPostObject(element, postId) {
    const content = this.extractContent(element);
    const timestamp = this.extractTimestamp(element);
    const metrics = this.extractMetrics(element);
    const media = this.extractMedia(element);
    const postUrl = this.extractPostUrl(element);

    if (!content) return null;

    return {
      platform_post_id: postId,
      content: content,
      published_at: timestamp,
      post_url: postUrl,
      media_urls: media.length > 0 ? media : null,
      metrics: metrics,
      post_type: this.determinePostType(element, media),
      visibility: 'PUBLIC', // Default since we can see it
      raw_data: {
        scraped: true,
        scrape_time: new Date().toISOString(),
        user_agent: navigator.userAgent,
        url: window.location.href
      }
    };
  }

  extractContent(element) {
    // Enhanced selectors for LinkedIn post content (2024)
    const contentSelectors = [
      '.feed-shared-text__text-view .break-words',  // Main text content
      '.feed-shared-text .break-words',             // Alternative text
      '.update-components-text .break-words',       // Update text
      '.feed-shared-update-v2__description .break-words', // Description text
      '.feed-shared-text__text-view',               // Fallback without break-words
      '.feed-shared-update-v2__description',        // Description fallback
      '.update-components-text',                    // Update components
      '.break-words',                               // Any break-words element
      '[data-test-id="post-text"]',                 // Test ID selector
      '.artdeco-card__text',                        // Card text
      '.feed-shared-text',                          // Basic text
      '.feed-shared-inline-video__description',     // Video descriptions
      '.feed-shared-poll-v2__description'          // Poll descriptions
    ];

    for (const selector of contentSelectors) {
      const contentEl = element.querySelector(selector);
      if (contentEl) {
        // Get text content, clean up extra whitespace
        let text = contentEl.innerText || contentEl.textContent || '';
        text = text.replace(/\s+/g, ' ').trim();
        
        // Remove "See more" and expand buttons text
        text = text.replace(/\.\.\.?\s*(See more|Show more)/gi, '');
        text = text.replace(/\s*…\s*$/g, ''); // Remove trailing ellipsis
        
        if (text.length > 10) { // Minimum content length
          console.log(`📝 Found content with selector: ${selector}, length: ${text.length}`);
          return text;
        }
      }
    }

    console.log('❌ No content found for element');
    return null;
  }

  extractTimestamp(element) {
    const timeSelectors = [
      'time[datetime]',
      '[data-test-id="post-timestamp"]',
      '.feed-shared-actor__sub-description time',
      '.artdeco-card__metadata time'
    ];

    for (const selector of timeSelectors) {
      const timeEl = element.querySelector(selector);
      if (timeEl) {
        const datetime = timeEl.getAttribute('datetime') || timeEl.getAttribute('title');
        if (datetime) {
          return new Date(datetime).toISOString();
        }
      }
    }

    // Fallback: current time
    return new Date().toISOString();
  }

  extractMetrics(element) {
    const metrics = {
      likes: 0,
      comments: 0,
      shares: 0,
      views: null
    };

    // Like count
    const likeSelectors = [
      '.social-counts-reactions__count',
      '[data-test-id="social-action-counts-likes"]',
      '.feed-shared-social-action-bar__reaction-count'
    ];

    for (const selector of likeSelectors) {
      const likeEl = element.querySelector(selector);
      if (likeEl) {
        const likeText = likeEl.innerText || likeEl.textContent || '';
        const likeCount = this.parseCount(likeText);
        if (likeCount > 0) {
          metrics.likes = likeCount;
          break;
        }
      }
    }

    // Comment count
    const commentSelectors = [
      '.social-counts-comments__count',
      '[data-test-id="social-action-counts-comments"]',
      '.feed-shared-social-action-bar__comment-count'
    ];

    for (const selector of commentSelectors) {
      const commentEl = element.querySelector(selector);
      if (commentEl) {
        const commentText = commentEl.innerText || commentEl.textContent || '';
        const commentCount = this.parseCount(commentText);
        if (commentCount > 0) {
          metrics.comments = commentCount;
          break;
        }
      }
    }

    return metrics;
  }

  extractMedia(element) {
    const media = [];
    
    // Images
    const images = element.querySelectorAll('img[src*="media"], img[src*="image"]');
    images.forEach(img => {
      if (img.src && !img.src.includes('avatar') && !img.src.includes('logo')) {
        media.push(img.src);
      }
    });

    // Videos
    const videos = element.querySelectorAll('video source, video[src]');
    videos.forEach(video => {
      const src = video.src || video.getAttribute('src');
      if (src) {
        media.push(src);
      }
    });

    return media;
  }

  extractPostUrl(element) {
    // Try to find post permalink
    const linkSelectors = [
      'a[href*="/posts/"]',
      'a[href*="/activity-"]',
      '.feed-shared-actor__description a',
      'time[datetime] a'
    ];

    for (const selector of linkSelectors) {
      const link = element.querySelector(selector);
      if (link && link.href) {
        return link.href;
      }
    }

    return window.location.href;
  }

  determinePostType(element, media) {
    if (media.some(url => url.includes('video'))) return 'video';
    if (media.length > 0) return 'image';
    if (element.querySelector('[data-test-id="article"], .article')) return 'article';
    return 'text';
  }

  parseCount(text) {
    if (!text) return 0;
    
    // Handle "1.2K", "15M" etc.
    const match = text.match(/([\d.]+)([KM]?)/i);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const multiplier = match[2]?.toUpperCase();
    
    if (multiplier === 'K') return Math.floor(num * 1000);
    if (multiplier === 'M') return Math.floor(num * 1000000);
    
    return Math.floor(num);
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  async sendPostsToAPI(posts) {
    if (!this.userToken || !posts.length) {
      console.log('❌ Cannot send posts - missing token or no posts:', { 
        hasToken: !!this.userToken, 
        postCount: posts.length 
      });
      return;
    }

    console.log(`🚀 Sending ${posts.length} posts to API:`, posts);

    try {
      const response = await fetch(`${this.apiEndpoint}/api/linkedin/posts/sync/extension`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.userToken}`,
          'X-Extension-Version': '1.0.0'
        },
        body: JSON.stringify({
          posts: posts,
          source: 'extension',
          timestamp: new Date().toISOString()
        })
      });

      console.log('📡 API Response status:', response.status);
      const result = await response.json();
      console.log('📋 API Response data:', result);
      
      if (result.success) {
        console.log(`✅ Synced ${posts.length} posts to CreatorTask`);
        this.updateIndicator(`✅ Synced ${result.data?.synced_count || posts.length} posts`);
      } else {
        console.error('❌ Failed to sync posts:', result.error);
        this.updateIndicator(`❌ Sync failed: ${result.error}`);
      }
      
    } catch (error) {
      console.error('❌ API Error:', error);
      this.updateIndicator('❌ Connection error');
    }
  }

  setupScrollObserver() {
    // Watch for new posts loaded via infinite scroll
    this.scrollObserver = new MutationObserver((mutations) => {
      if (!this.isActive) return;
      
      let hasNewPosts = false;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && 
              (node.querySelector('[data-urn*="activity"]') || 
               node.matches('[data-urn*="activity"]'))) {
            hasNewPosts = true;
          }
        });
      });
      
      if (hasNewPosts) {
        setTimeout(() => this.scrapeVisiblePosts(), 1000);
      }
    });

    this.scrollObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  autoScrollAndScrape(maxPosts) {
    let scrollAttempts = 0;
    const maxScrollAttempts = 15;
    let lastScrollPosition = window.scrollY;
    let stuckCount = 0;
    
    // Start from current position, don't jump to top
    console.log(`🔄 Starting auto-scroll from current position: ${lastScrollPosition}`);
    
    this.autoScrollInterval = setInterval(() => {
      if (!this.isActive || this.scraped.size >= maxPosts || scrollAttempts >= maxScrollAttempts) {
        clearInterval(this.autoScrollInterval);
        this.updateIndicator(`✅ Completed: ${this.scraped.size} posts`);
        console.log(`✅ Auto-scroll completed. Found ${this.scraped.size} posts total.`);
        return;
      }
      
      // Check if we're stuck (not scrolling)
      const currentPosition = window.scrollY;
      if (Math.abs(currentPosition - lastScrollPosition) < 100) {
        stuckCount++;
        if (stuckCount >= 3) {
          console.log('🚫 Scroll appears stuck, ending auto-scroll');
          clearInterval(this.autoScrollInterval);
          this.updateIndicator(`✅ Completed: ${this.scraped.size} posts (scroll limit reached)`);
          return;
        }
      } else {
        stuckCount = 0;
      }
      
      lastScrollPosition = currentPosition;
      
      // Scrape current posts before scrolling
      this.scrapeVisiblePosts();
      
      // Scroll down moderately to load more posts
      window.scrollBy(0, window.innerHeight * 0.8);
      scrollAttempts++;
      
      this.updateIndicator(`🔄 Loading... ${this.scraped.size}/${maxPosts} posts (scroll ${scrollAttempts}/${maxScrollAttempts})`);
      
      console.log(`📍 Scroll attempt ${scrollAttempts}: position ${window.scrollY}, found ${this.scraped.size} posts`);
    }, 3000); // Increased interval to 3 seconds
  }

  showIndicator(message) {
    this.hideIndicator();
    
    const indicator = document.createElement('div');
    indicator.className = 'linkedin-sync-indicator';
    indicator.textContent = message;
    indicator.id = 'linkedin-sync-indicator';
    
    document.body.appendChild(indicator);
  }

  updateIndicator(message) {
    const indicator = document.getElementById('linkedin-sync-indicator');
    if (indicator) {
      indicator.textContent = message;
    }
  }

  hideIndicator() {
    const indicator = document.getElementById('linkedin-sync-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  startAutoScraping() {
    // Auto-scrape when user visits their own posts
    if (window.location.href.includes('/posts/') || 
        window.location.href.includes('/recent-activity/')) {
      setTimeout(() => {
        this.startScraping({ autoScroll: false });
      }, 2000);
    }
  }
}

// Initialize the scraper when DOM is ready
console.log('🔄 Initializing LinkedInPostScraper...');

// Initialize the scraper
if (document.readyState === 'loading') {
  console.log('⏳ DOM still loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM loaded, creating scraper instance');
    window.linkedInPostScraper = new LinkedInPostScraper();
  });
} else {
  console.log('✅ DOM already ready, creating scraper instance');
  window.linkedInPostScraper = new LinkedInPostScraper();
}

} // Close the if statement that checks for existing scraper 