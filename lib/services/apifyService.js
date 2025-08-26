import { ApifyClient } from 'apify-client';

export class ApifyService {
  constructor(apiToken) {
    this.client = new ApifyClient({ token: apiToken });
  }

  async fetchLinkedInPosts(input) {
    try {
      console.log('Starting Apify actor with input:', input);
      
      const run = await this.client.actor('apimaestro/linkedin-posts-search-scraper-no-cookies').call(input);
      
      console.log('Actor run completed, fetching dataset...');
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
      
      console.log(`Fetched ${items.length} posts from Apify`);
      return items;
    } catch (error) {
      console.error('Error in ApifyService.fetchLinkedInPosts:', error);
      throw error;
    }
  }

  // Get default input configuration for viral post detection
  getDefaultInput() {
    return {
      keyword: "AI, machine learning, data science, generative AI, LLM, artificial intelligence, startup, product management, leadership",
      sort_type: "date_posted",
      date_filter: "past-week",
      total_posts: 1000
    };
  }

  // Get input for specific keywords
  getInputForKeywords(keywords, timeframe = "past-week", maxPosts = 1000) {
    return {
      keyword: Array.isArray(keywords) ? keywords.join(", ") : keywords,
      sort_type: "date_posted",
      date_filter: timeframe,
      total_posts: maxPosts
    };
  }
}
