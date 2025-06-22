'use client';

import React, { useState } from 'react';
import { scrapeLinkedInSearch, scrapeWithPreset } from '@/lib/linkedin-scraper';

const SimpleLinkedInScraper = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);

  // Example 1: Simple search function
  const handleQuickSearch = async (query) => {
    setIsLoading(true);
    try {
      const result = await scrapeLinkedInSearch(query, {
        count: 20,
        datePosted: 'past-week'
      });
      setResults(result);
      console.log('Scraped posts:', result);
    } catch (error) {
      console.error('Scraping failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Example 2: Using presets
  const handlePresetScrape = async (presetName) => {
    setIsLoading(true);
    try {
      const result = await scrapeWithPreset(presetName);
      setResults(result);
      console.log('Preset scraping result:', result);
    } catch (error) {
      console.error('Preset scraping failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">Quick LinkedIn Scraper</h3>
      
      {/* Quick Search Buttons */}
      <div className="mb-4">
        <h4 className="font-medium mb-2">Quick Searches:</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQuickSearch('artificial intelligence')}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            AI Posts
          </button>
          <button
            onClick={() => handleQuickSearch('startup')}
            disabled={isLoading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Startup Posts
          </button>
          <button
            onClick={() => handleQuickSearch('marketing')}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            Marketing Posts
          </button>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="mb-4">
        <h4 className="font-medium mb-2">Presets:</h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handlePresetScrape('TRENDING_AI')}
            disabled={isLoading}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            Trending AI
          </button>
          <button
            onClick={() => handlePresetScrape('BUSINESS_INSIGHTS')}
            disabled={isLoading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            Business Tips
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-4">
          <div className="inline-flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Scraping LinkedIn posts...
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Results:</h4>
          <p className="text-sm text-gray-600">
            ✅ Found {results.data?.synced_count || 0} posts saved to database
          </p>
          <p className="text-sm text-gray-600">
            📊 Total scraped: {results.data?.total_fetched || 0} posts
          </p>
        </div>
      )}
    </div>
  );
};

export default SimpleLinkedInScraper; 