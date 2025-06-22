// LinkedIn Scraper Usage Examples
// This file demonstrates how to use the new Apify LinkedIn scraper integration

import { 
  scrapeLinkedInPosts, 
  scrapeLinkedInSearch, 
  scrapeLinkedInCompany,
  scrapeLinkedInProfile,
  scrapeWithPreset,
  batchScrapeLinkedIn,
  SCRAPING_PRESETS 
} from '../lib/linkedin-scraper';

// Example 1: Search for posts by keywords
async function searchByKeywords() {
  try {
    const result = await scrapeLinkedInSearch('artificial intelligence', {
      datePosted: 'past-week',
      count: 50,
      proxyCountry: 'US'
    });
    
    console.log('Search Results:', result);
    console.log(`Found ${result.data.synced_count} posts saved to database`);
    
    return result;
  } catch (error) {
    console.error('Search failed:', error.message);
  }
}

// Example 2: Scrape specific LinkedIn URLs
async function scrapeSpecificUrls() {
  const urls = [
    'https://www.linkedin.com/posts/linkedin_hiring-trends-report-activity-7247998907798978560-J_hB',
    'https://www.linkedin.com/company/microsoft/posts/',
    'https://www.linkedin.com/in/satya-nadella/recent-activity/posts/'
  ];

  try {
    const result = await scrapeLinkedInPosts({
      urls,
      count: 100,
      proxyCountry: 'US'
    });
    
    console.log('URL Scraping Results:', result);
    return result;
  } catch (error) {
    console.error('URL scraping failed:', error.message);
  }
}

// Example 3: Scrape company posts
async function scrapeCompanyPosts() {
  try {
    const result = await scrapeLinkedInCompany('openai', {
      count: 30
    });
    
    console.log('Company Posts:', result);
    return result;
  } catch (error) {
    console.error('Company scraping failed:', error.message);
  }
}

// Example 4: Scrape user profile posts
async function scrapeUserProfile() {
  try {
    const result = await scrapeLinkedInProfile('reidhoffman', {
      count: 20
    });
    
    console.log('Profile Posts:', result);
    return result;
  } catch (error) {
    console.error('Profile scraping failed:', error.message);
  }
}

// Example 5: Use preset configurations
async function usePresets() {
  try {
    // Use built-in preset
    const result1 = await scrapeWithPreset('TRENDING_AI');
    console.log('AI Trending Posts:', result1);

    // Use preset with overrides
    const result2 = await scrapeWithPreset('BUSINESS_INSIGHTS', {
      count: 100,
      datePosted: 'past-week'
    });
    console.log('Business Posts:', result2);

    return [result1, result2];
  } catch (error) {
    console.error('Preset scraping failed:', error.message);
  }
}

// Example 6: Batch scraping multiple searches
async function batchScraping() {
  const searchQueries = [
    'machine learning',
    'startup funding',
    'remote work',
    'digital transformation',
    'cybersecurity'
  ];

  try {
    const results = await batchScrapeLinkedIn(searchQueries, {
      count: 30,
      datePosted: 'past-week',
      batchSize: 2, // Process 2 at a time
      delay: 3000   // 3 second delay between batches
    });
    
    console.log('Batch Results:', results);
    
    // Process results
    results.forEach((result, index) => {
      if (result.error) {
        console.error(`Query "${searchQueries[index]}" failed:`, result.error);
      } else {
        console.log(`Query "${searchQueries[index]}": ${result.data.synced_count} posts`);
      }
    });

    return results;
  } catch (error) {
    console.error('Batch scraping failed:', error.message);
  }
}

// Example 7: Advanced scraping with custom filters
async function advancedScraping() {
  try {
    const result = await scrapeLinkedInPosts({
      keywords: 'leadership AND management',
      datePosted: 'past-month',
      count: 100,
      proxyCountry: 'US'
    });
    
    // Filter posts with high engagement after scraping
    if (result.success && result.data.posts) {
      const highEngagementPosts = result.data.posts.filter(post => {
        const totalEngagement = (post.metrics?.likes || 0) + 
                               (post.metrics?.comments || 0) + 
                               (post.metrics?.shares || 0);
        return totalEngagement >= 100; // Posts with 100+ total engagement
      });
      
      console.log(`Found ${highEngagementPosts.length} high-engagement posts`);
      return { ...result, highEngagementPosts };
    }
    
    return result;
  } catch (error) {
    console.error('Advanced scraping failed:', error.message);
  }
}

// Example 8: Error handling and retry logic
async function scrapeWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Scraping attempt ${attempt}/${maxRetries}`);
      
      const result = await scrapeLinkedInSearch('innovation', {
        count: 50,
        datePosted: 'past-24h'
      });
      
      if (result.success) {
        console.log('Scraping successful!');
        return result;
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('All retry attempts failed');
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Example 9: Working with the scraped data
async function processScrapedData() {
  try {
    const result = await scrapeLinkedInSearch('startup', {
      count: 100,
      datePosted: 'past-week'
    });
    
    if (result.success && result.data.posts) {
      const posts = result.data.posts;
      
      // Analyze post types
      const postTypes = posts.reduce((acc, post) => {
        acc[post.post_type] = (acc[post.post_type] || 0) + 1;
        return acc;
      }, {});
      console.log('Post types distribution:', postTypes);
      
      // Find most engaging posts
      const topPosts = posts
        .sort((a, b) => {
          const aEngagement = (a.metrics?.likes || 0) + (a.metrics?.comments || 0);
          const bEngagement = (b.metrics?.likes || 0) + (b.metrics?.comments || 0);
          return bEngagement - aEngagement;
        })
        .slice(0, 5);
      
      console.log('Top 5 most engaging posts:');
      topPosts.forEach((post, index) => {
        console.log(`${index + 1}. ${post.content.substring(0, 100)}...`);
        console.log(`   Engagement: ${post.metrics?.likes || 0} likes, ${post.metrics?.comments || 0} comments`);
      });
      
      return { postTypes, topPosts };
    }
    
    return result;
  } catch (error) {
    console.error('Data processing failed:', error.message);
  }
}

// Example 10: Scheduled scraping (for use with cron jobs or background tasks)
async function scheduledScraping() {
  console.log('Starting scheduled LinkedIn scraping...');
  
  const scrapingTasks = [
    { preset: 'TRENDING_AI', description: 'AI/ML trending posts' },
    { preset: 'MARKETING_TIPS', description: 'Marketing insights' },
    { preset: 'CAREER_ADVICE', description: 'Career development posts' }
  ];
  
  const results = [];
  
  for (const task of scrapingTasks) {
    try {
      console.log(`Scraping: ${task.description}`);
      const result = await scrapeWithPreset(task.preset);
      results.push({ task: task.description, result });
      
      // Add delay between tasks to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to scrape ${task.description}:`, error.message);
      results.push({ task: task.description, error: error.message });
    }
  }
  
  // Log summary
  const successful = results.filter(r => r.result && r.result.success);
  const failed = results.filter(r => r.error);
  
  console.log(`\nScraping Summary:`);
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  successful.forEach(({ task, result }) => {
    console.log(`  ${task}: ${result.data.synced_count} posts saved`);
  });
  
  failed.forEach(({ task, error }) => {
    console.log(`  ${task}: ${error}`);
  });
  
  return results;
}

// Export all examples for use
export {
  searchByKeywords,
  scrapeSpecificUrls,
  scrapeCompanyPosts,
  scrapeUserProfile,
  usePresets,
  batchScraping,
  advancedScraping,
  scrapeWithRetry,
  processScrapedData,
  scheduledScraping
};

// Main function to run all examples (for testing)
export async function runAllExamples() {
  console.log('🚀 Running LinkedIn Scraper Examples...\n');
  
  const examples = [
    { name: 'Search by Keywords', fn: searchByKeywords },
    { name: 'Scrape Specific URLs', fn: scrapeSpecificUrls },
    { name: 'Company Posts', fn: scrapeCompanyPosts },
    { name: 'User Profile', fn: scrapeUserProfile },
    { name: 'Use Presets', fn: usePresets },
    { name: 'Advanced Scraping', fn: advancedScraping },
    { name: 'Process Data', fn: processScrapedData }
  ];
  
  for (const example of examples) {
    try {
      console.log(`\n📋 Running: ${example.name}`);
      console.log('─'.repeat(50));
      await example.fn();
      console.log(`✅ ${example.name} completed\n`);
    } catch (error) {
      console.error(`❌ ${example.name} failed:`, error.message);
    }
  }
  
  console.log('🎉 All examples completed!');
} 