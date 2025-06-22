'use client';

import React, { useState, useEffect } from 'react';
import { 
  scrapeLinkedInPosts, 
  scrapeLinkedInSearch, 
  scrapeWithPreset, 
  SCRAPING_PRESETS,
  getScrapingStats 
} from '@/lib/linkedin-scraper';

const LinkedInScraperComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customUrls, setCustomUrls] = useState('');
  const [scrapingMode, setScrapingMode] = useState('search'); // 'search', 'urls', 'preset'
  const [postCount, setPostCount] = useState(20); // New state for post count

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const scrapingStats = await getScrapingStats();
      setStats(scrapingStats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleScrape = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      let result;

      switch (scrapingMode) {
        case 'search':
          if (!searchQuery.trim()) {
            throw new Error('Please enter a search query');
          }
          result = await scrapeLinkedInSearch(searchQuery, {
            datePosted: 'past-week',
            count: postCount
          });
          break;

        case 'urls':
          if (!customUrls.trim()) {
            throw new Error('Please enter LinkedIn URLs');
          }
          const urls = customUrls.split('\n').map(url => url.trim()).filter(Boolean);
          result = await scrapeLinkedInPosts({ urls, count: postCount });
          break;

        case 'preset':
          if (!selectedPreset) {
            throw new Error('Please select a preset');
          }
          result = await scrapeWithPreset(selectedPreset, { count: postCount });
          break;

        default:
          throw new Error('Invalid scraping mode');
      }

      setResults(result);
      await loadStats(); // Refresh stats after scraping
    } catch (err) {
      setError(err.message);
      console.error('Scraping error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderModeSelector = () => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3">Scraping Mode</h3>
      <div className="flex gap-4">
        <label className="flex items-center">
          <input
            type="radio"
            value="search"
            checked={scrapingMode === 'search'}
            onChange={(e) => setScrapingMode(e.target.value)}
            className="mr-2"
          />
          Search by Keywords
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            value="urls"
            checked={scrapingMode === 'urls'}
            onChange={(e) => setScrapingMode(e.target.value)}
            className="mr-2"
          />
          Specific URLs
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            value="preset"
            checked={scrapingMode === 'preset'}
            onChange={(e) => setScrapingMode(e.target.value)}
            className="mr-2"
          />
          Use Preset
        </label>
      </div>
    </div>
  );

  const renderScrapingForm = () => {
    switch (scrapingMode) {
      case 'search':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Search Keywords</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., artificial intelligence, marketing tips, leadership"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-600 mt-1">
              Enter keywords to search for LinkedIn posts
            </p>
          </div>
        );

      case 'urls':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">LinkedIn URLs</label>
            <textarea
              value={customUrls}
              onChange={(e) => setCustomUrls(e.target.value)}
              placeholder="https://www.linkedin.com/posts/username-activity-123456789
https://www.linkedin.com/company/company-name/posts/
https://www.linkedin.com/in/username/recent-activity/posts/"
              rows="4"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-600 mt-1">
              Enter LinkedIn URLs (one per line) - supports posts, profiles, and company pages
            </p>
          </div>
        );

      case 'preset':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Choose Preset</label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a preset...</option>
              {Object.entries(SCRAPING_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {key.replace(/_/g, ' ')} - {preset.keywords}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-600 mt-1">
              Pre-configured searches for popular topics
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">LinkedIn Post Scraper</h2>
        <p className="text-gray-600">
          Scrape LinkedIn posts using Apify&apos;s professional scraping service
        </p>
      </div>

      {/* Stats Display */}
      {stats && (
        <div className="mb-6 p-4 bg-gray-50 rounded-md">
          <h3 className="font-semibold mb-2">Current Stats</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Posts:</span>
              <span className="ml-2 font-semibold">{stats.total_posts}</span>
            </div>
            <div>
              <span className="text-gray-600">Last Scraped:</span>
              <span className="ml-2 font-semibold">
                {stats.last_scraped 
                  ? new Date(stats.last_scraped).toLocaleDateString()
                  : 'Never'
                }
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mode Selector */}
      {renderModeSelector()}

      {/* Scraping Form */}
      {renderScrapingForm()}

      {/* Post Count Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Number of Posts to Scrape</label>
        <input
          type="number"
          value={postCount}
          onChange={(e) => setPostCount(Math.min(Math.max(1, parseInt(e.target.value) || 1), 50))}
          min="1"
          max="50"
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-sm text-gray-600 mt-1">
          Maximum 50 posts per scraping session (default: 20)
        </p>
      </div>

      {/* Scrape Button */}
      <button
        onClick={handleScrape}
        disabled={isLoading}
        className={`w-full py-3 px-6 rounded-md font-semibold text-white transition-colors ${
          isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Scraping LinkedIn Posts...
          </div>
        ) : (
          'Start Scraping'
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Scraping Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <h3 className="text-lg font-semibold text-green-800 mb-3">
            ✅ Scraping Results
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {results.data.synced_count}
              </div>
              <div className="text-gray-600">Posts Saved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {results.data.total_fetched}
              </div>
              <div className="text-gray-600">Posts Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {results.data.errors_count || 0}
              </div>
              <div className="text-gray-600">Errors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {results.data.posts?.length || 0}
              </div>
              <div className="text-gray-600">Displayed</div>
            </div>
          </div>

          {/* Filtering Statistics */}
          {results.data.filtering_stats && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <h4 className="font-medium text-blue-800 mb-2">📊 Filtering Details</h4>
              <div className="text-sm text-blue-700">
                <div>• Found {results.data.filtering_stats.original_from_apify} items from Apify</div>
                <div>• Filtered to {results.data.filtering_stats.after_filtering_comments} original posts (removed comments)</div>
                <div>• Limited to {results.data.filtering_stats.after_count_limit} posts (your requested count)</div>
                <div>• Successfully stored {results.data.filtering_stats.successfully_stored} posts in database</div>
              </div>
            </div>
          )}

          {results.data.dataset_url && (
            <div className="mb-4">
              <a
                href={results.data.dataset_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-800"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Full Dataset on Apify
              </a>
            </div>
          )}

          {/* Sample Posts */}
          {results.data.posts && results.data.posts.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Sample Posts:</h4>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {results.data.posts.slice(0, 5).map((post, index) => (
                  <div key={index} className="p-3 bg-white rounded border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm font-medium text-gray-700">
                        {post.author || 'Unknown Author'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(post.published_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-sm text-gray-800 mb-2">
                      {post.content}
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>👍 {post.metrics?.likes || 0}</span>
                      <span>💬 {post.metrics?.comments || 0}</span>
                      <span>🔄 {post.metrics?.shares || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usage Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="font-semibold text-blue-800 mb-2">Setup Instructions</h3>
        <ol className="text-sm text-blue-700 space-y-1">
                     <li>1. Get your Apify API token from <a href="https://console.apify.com" target="_blank" rel="noopener noreferrer" className="underline">Apify Console</a></li>
           <li>2. Add <code className="bg-blue-100 px-1 rounded">APIFY_API_TOKEN=your_token</code> to your environment variables</li>
           <li>3. Restart your application</li>
           <li>4. Start scraping LinkedIn posts!</li>
        </ol>
      </div>
    </div>
  );
};

export default LinkedInScraperComponent; 