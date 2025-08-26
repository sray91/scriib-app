'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Filter, X, RefreshCw } from 'lucide-react';

export default function SparkFilters({ 
  onFiltersChange, 
  onTriggerScrape,
  isScrapingLoading = false,
  currentFilters = {}
}) {
  const [filters, setFilters] = useState({
    sortBy: 'viral_score',
    timeframe: 'week',
    minViralScore: '0',
    keywords: '',
    onlyViral: false,
    ...currentFilters
  });
  
  const [keywordInput, setKeywordInput] = useState('');
  const [appliedKeywords, setAppliedKeywords] = useState([]);

  // Update filters and notify parent
  const updateFilters = (newFilters) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  // Add keyword to filter
  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !appliedKeywords.includes(trimmed)) {
      const newKeywords = [...appliedKeywords, trimmed];
      setAppliedKeywords(newKeywords);
      updateFilters({ keywords: newKeywords.join(',') });
      setKeywordInput('');
    }
  };

  // Remove keyword from filter
  const removeKeyword = (keyword) => {
    const newKeywords = appliedKeywords.filter(k => k !== keyword);
    setAppliedKeywords(newKeywords);
    updateFilters({ keywords: newKeywords.join(',') });
  };

  // Clear all filters
  const clearFilters = () => {
    const defaultFilters = {
      sortBy: 'viral_score',
      timeframe: 'week',
      minViralScore: '0',
      keywords: '',
      onlyViral: false
    };
    setFilters(defaultFilters);
    setAppliedKeywords([]);
    setKeywordInput('');
    onFiltersChange(defaultFilters);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <CardTitle className="text-lg">Filters & Controls</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={onTriggerScrape}
              disabled={isScrapingLoading}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isScrapingLoading ? 'animate-spin' : ''}`} />
              <span>{isScrapingLoading ? 'Scraping...' : 'Scrape New Posts'}</span>
            </Button>
            <Button
              onClick={clearFilters}
              variant="ghost"
              size="sm"
            >
              Clear All
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Sort and Time Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sortBy">Sort By</Label>
            <Select
              value={filters.sortBy}
              onValueChange={(value) => updateFilters({ sortBy: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viral_score">Viral Score</SelectItem>
                <SelectItem value="engagement_rate">Engagement Rate</SelectItem>
                <SelectItem value="published_at">Published Date</SelectItem>
                <SelectItem value="likes_count">Likes Count</SelectItem>
                <SelectItem value="comments_count">Comments Count</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeframe">Time Range</Label>
            <Select
              value={filters.timeframe}
              onValueChange={(value) => updateFilters({ timeframe: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Last 24 Hours</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minViralScore">Min Viral Score</Label>
            <Input
              id="minViralScore"
              type="number"
              min="0"
              step="0.1"
              placeholder="0"
              value={filters.minViralScore}
              onChange={(e) => updateFilters({ minViralScore: e.target.value })}
            />
          </div>
        </div>

        <Separator />

        {/* Keyword Filter */}
        <div className="space-y-3">
          <Label>Keywords</Label>
          <div className="flex space-x-2">
            <Input
              placeholder="Add keyword (e.g., AI, startup, leadership)"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addKeyword();
                }
              }}
            />
            <Button
              type="button"
              onClick={addKeyword}
              disabled={!keywordInput.trim()}
              size="sm"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Applied Keywords */}
          {appliedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {appliedKeywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="flex items-center space-x-1">
                  <span>{keyword}</span>
                  <button
                    onClick={() => removeKeyword(keyword)}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Toggle Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="onlyViral" className="flex flex-col space-y-1">
              <span>Only Viral Posts</span>
              <span className="text-sm text-gray-500 font-normal">
                Show only posts marked as viral
              </span>
            </Label>
            <Switch
              id="onlyViral"
              checked={filters.onlyViral}
              onCheckedChange={(checked) => updateFilters({ onlyViral: checked })}
            />
          </div>
        </div>

        {/* Active Filters Summary */}
        <div className="pt-4 border-t">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Active filters:</span>
            <span className="ml-2">
              {filters.timeframe !== 'all' && `${filters.timeframe} • `}
              {filters.minViralScore && filters.minViralScore !== '0' && `Min score: ${filters.minViralScore} • `}
              {filters.onlyViral && 'Viral only • '}
              {appliedKeywords.length > 0 && `${appliedKeywords.length} keywords • `}
              Sorted by {filters.sortBy.replace('_', ' ')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
