/**
 * LinkedIn Post Scraper utility using Apify API
 * Replaces the Chrome extension approach with server-side scraping
 */

/**
 * Scrape LinkedIn posts using Apify's LinkedIn post scraper
 * @param {Object} params - Scraping parameters
 * @param {string[]} [params.urls] - Specific LinkedIn URLs to scrape
 * @param {string} [params.keywords] - Keywords to search for
 * @param {string} [params.datePosted] - Date filter (past-24h, past-week, past-month)
 * @param {number} [params.count] - Maximum number of posts to scrape
 * @param {string} [params.proxyCountry] - Proxy country code
 * @returns {Promise<Object>} Scraping results
 */
export async function scrapeLinkedInPosts({
  urls = [],
  keywords = '',
  datePosted = 'past-month',
  count = 50,
  proxyCountry = 'US'
} = {}) {
  try {
    const response = await fetch('/api/linkedin/scrape-posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls,
        keywords,
        datePosted,
        count,
        proxyCountry
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to scrape LinkedIn posts');
    }

    return data;
  } catch (error) {
    console.error('LinkedIn scraping error:', error);
    throw error;
  }
}

/**
 * Scrape posts from a specific LinkedIn search
 * @param {string} searchQuery - Search query
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Scraping results
 */
export async function scrapeLinkedInSearch(searchQuery, options = {}) {
  return scrapeLinkedInPosts({
    keywords: searchQuery,
    datePosted: options.datePosted || 'past-month',
    count: options.count || 50,
    proxyCountry: options.proxyCountry || 'US'
  });
}

/**
 * Scrape posts from specific LinkedIn URLs
 * @param {string[]} urls - LinkedIn URLs to scrape
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Scraping results
 */
export async function scrapeLinkedInUrls(urls, options = {}) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('URLs array is required and cannot be empty');
  }

  return scrapeLinkedInPosts({
    urls,
    count: options.count || 200,
    proxyCountry: options.proxyCountry || 'US'
  });
}

/**
 * Scrape posts from a LinkedIn company page
 * @param {string} companyHandle - LinkedIn company handle (e.g., 'linkedin')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Scraping results  
 */
export async function scrapeLinkedInCompany(companyHandle, options = {}) {
  const urls = [`https://www.linkedin.com/company/${companyHandle}/posts/`];
  
  return scrapeLinkedInUrls(urls, options);
}

/**
 * Scrape posts from a LinkedIn user profile
 * @param {string} userHandle - LinkedIn user handle
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Scraping results
 */
export async function scrapeLinkedInProfile(userHandle, options = {}) {
  const urls = [`https://www.linkedin.com/in/${userHandle}/recent-activity/posts/`];
  
  return scrapeLinkedInUrls(urls, options);
}

/**
 * Scrape trending LinkedIn posts by keyword
 * @param {string} keyword - Trending keyword
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Scraping results
 */
export async function scrapeTrendingPosts(keyword, options = {}) {
  return scrapeLinkedInSearch(keyword, {
    datePosted: 'past-24h', // Get recent trending posts
    count: options.count || 100,
    ...options
  });
}

/**
 * Advanced LinkedIn post scraping with multiple filters
 * @param {Object} filters - Advanced filtering options
 * @param {string} [filters.keywords] - Keywords to search for
 * @param {string} [filters.author] - Specific author to filter by
 * @param {string} [filters.company] - Company posts to filter by
 * @param {string} [filters.datePosted] - Date filter
 * @param {string} [filters.postType] - Post type filter
 * @param {number} [filters.minEngagement] - Minimum engagement threshold
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Scraping results
 */
export async function scrapeLinkedInAdvanced(filters = {}, options = {}) {
  const {
    keywords = '',
    author = '',
    company = '',
    datePosted = 'past-month',
    postType = '',
    minEngagement = 0
  } = filters;

  // Build advanced search URL
  let searchUrl = 'https://www.linkedin.com/search/results/content/?';
  const params = new URLSearchParams();

  if (keywords) params.append('keywords', keywords);
  if (datePosted) params.append('datePosted', `"${datePosted}"`);
  if (author) params.append('author', author);
  if (company) params.append('company', company);
  if (postType) params.append('postType', postType);
  
  params.append('origin', 'FACETED_SEARCH');
  searchUrl += params.toString();

  const result = await scrapeLinkedInUrls([searchUrl], options);

  // Apply engagement filter if specified
  if (minEngagement > 0 && result.success && result.data.posts) {
    result.data.posts = result.data.posts.filter(post => {
      const totalEngagement = (post.metrics?.likes || 0) + 
                             (post.metrics?.comments || 0) + 
                             (post.metrics?.shares || 0);
      return totalEngagement >= minEngagement;
    });
    result.data.synced_count = result.data.posts.length;
  }

  return result;
}

/**
 * Batch scrape multiple LinkedIn searches
 * @param {string[]} searchQueries - Array of search queries
 * @param {Object} options - Additional options
 * @returns {Promise<Object[]>} Array of scraping results
 */
export async function batchScrapeLinkedIn(searchQueries, options = {}) {
  if (!Array.isArray(searchQueries) || searchQueries.length === 0) {
    throw new Error('Search queries array is required and cannot be empty');
  }

  const results = [];
  const batchSize = options.batchSize || 3; // Process in batches to avoid rate limits
  const delay = options.delay || 2000; // Delay between batches

  for (let i = 0; i < searchQueries.length; i += batchSize) {
    const batch = searchQueries.slice(i, i + batchSize);
    
    const batchPromises = batch.map(query => 
      scrapeLinkedInSearch(query, options).catch(error => ({
        error: error.message,
        query
      }))
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add delay between batches (except for the last batch)
    if (i + batchSize < searchQueries.length && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return results;
}

/**
 * Get scraping status and statistics
 * @returns {Promise<Object>} Scraping statistics
 */
export async function getScrapingStats() {
  try {
    const response = await fetch('/api/linkedin/posts?limit=1');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get scraping stats');
    }

    return {
      total_posts: data.pagination?.total || 0,
      last_scraped: data.data?.[0]?.created_at || null,
      apify_enabled: true
    };
  } catch (error) {
    console.error('Error getting scraping stats:', error);
    return {
      total_posts: 0,
      last_scraped: null,
      apify_enabled: false,
      error: error.message
    };
  }
}

// Export pre-configured scraping presets
export const SCRAPING_PRESETS = {
  TRENDING_AI: {
    keywords: 'artificial intelligence AI machine learning',
    datePosted: 'past-24h',
    count: 100
  },
  TRENDING_TECH: {
    keywords: 'technology startup innovation',
    datePosted: 'past-week',
    count: 150
  },
  BUSINESS_INSIGHTS: {
    keywords: 'business strategy leadership',
    datePosted: 'past-month',
    count: 200
  },
  MARKETING_TIPS: {
    keywords: 'marketing digital marketing social media',
    datePosted: 'past-week',
    count: 100
  },
  CAREER_ADVICE: {
    keywords: 'career advice job search professional development',
    datePosted: 'past-month',
    count: 150
  }
};

/**
 * Scrape using a preset configuration
 * @param {string} presetName - Name of the preset
 * @param {Object} overrides - Options to override preset values
 * @returns {Promise<Object>} Scraping results
 */
export async function scrapeWithPreset(presetName, overrides = {}) {
  const preset = SCRAPING_PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}. Available presets: ${Object.keys(SCRAPING_PRESETS).join(', ')}`);
  }

  return scrapeLinkedInPosts({
    ...preset,
    ...overrides
  });
} 