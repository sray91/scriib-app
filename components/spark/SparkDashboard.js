'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  Flame, 
  Users, 
  Heart, 
  MessageCircle, 
  Share, 
  Calendar,
  ExternalLink,
  Search,
  Filter,
  BarChart3,
  Star,
  PieChart,
  LineChart
} from 'lucide-react';

import RealtimeViralPosts from './RealtimeViralPosts';
import CustomizableDashboard from './CustomizableDashboard';

export default function SparkDashboard({
  posts = [],
  topics = [],
  isLoading = false,
  filters = {},
  onFiltersChange,
  onTopicSelect,
  onPostsUpdate,
  onTriggerScrape
}) {
  const [quickFilters, setQuickFilters] = useState({
    timeRange: 'week',
    contentType: 'all',
    searchKeywords: ''
  });

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(() => {
    if (!posts.length) {
      return {
        totalPosts: 0,
        viralPosts: 0,
        avgViralScore: 0,
        totalEngagement: 0,
        topInfluencers: [],
        recentViralPosts: []
      };
    }

    const viralPosts = posts.filter(post => post.is_viral);
    const totalEngagement = posts.reduce((sum, post) => 
      sum + (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0), 0
    );
    const avgViralScore = posts.reduce((sum, post) => sum + (post.viral_score || 0), 0) / posts.length;

    // Calculate top influencers
    const influencerMap = new Map();
    posts.forEach(post => {
      if (post.author_name) {
        const existing = influencerMap.get(post.author_name) || {
          name: post.author_name,
          title: post.author_title,
          image: post.author_image_url,
          posts: 0,
          totalEngagement: 0,
          viralPosts: 0,
          maxViralScore: 0
        };

        influencerMap.set(post.author_name, {
          ...existing,
          posts: existing.posts + 1,
          totalEngagement: existing.totalEngagement + (post.likes_count || 0) + (post.comments_count || 0),
          viralPosts: existing.viralPosts + (post.is_viral ? 1 : 0),
          maxViralScore: Math.max(existing.maxViralScore, post.viral_score || 0)
        });
      }
    });

    const topInfluencers = Array.from(influencerMap.values())
      .sort((a, b) => b.viralPosts - a.viralPosts || b.totalEngagement - a.totalEngagement)
      .slice(0, 5);

    // Get recent viral posts
    const recentViralPosts = posts
      .filter(post => post.is_viral)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, 5);

    return {
      totalPosts: posts.length,
      viralPosts: viralPosts.length,
      avgViralScore,
      totalEngagement,
      topInfluencers,
      recentViralPosts
    };
  }, [posts]);

  // Handle quick filter changes
  const handleQuickFilterChange = (key, value) => {
    const newQuickFilters = { ...quickFilters, [key]: value };
    setQuickFilters(newQuickFilters);
    
    // Convert quick filters to main filters format
    onFiltersChange({
      ...filters,
      timeframe: newQuickFilters.timeRange,
      // Add content type filtering if needed
    });
  };

  // Format numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Search & Action Bar */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="w-5 h-5 text-blue-600" />
              <span>Find Viral Content</span>
            </div>
            <Button 
              onClick={onTriggerScrape}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {isLoading ? 'Scraping...' : 'Scrape New Posts'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Keyword Search */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">Search Keywords</label>
              <Input
                placeholder="AI, startup, leadership, marketing..."
                value={quickFilters.searchKeywords || ''}
                onChange={(e) => handleQuickFilterChange('searchKeywords', e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    onFiltersChange({
                      ...filters,
                      keywords: e.target.value
                    });
                  }
                }}
                className="border-blue-200 focus:border-blue-400"
              />
            </div>
            {/* Quick Actions */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Quick Actions</label>
              <Button
                variant="outline"
                onClick={() => onFiltersChange({ ...filters, onlyViral: true, timeframe: 'day' })}
                className="w-full text-sm"
              >
                <Flame className="w-4 h-4 mr-1" />
                Today&apos;s Viral
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">&nbsp;</label>
              <Button
                variant="outline"
                onClick={() => onFiltersChange({ ...filters, timeframe: 'all', sortBy: 'viral_score' })}
                className="w-full text-sm"
              >
                <Star className="w-4 h-4 mr-1" />
                Show All Posts
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Filter className="w-5 h-5" />
              <span>Filters</span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Time Range</label>
              <Select
                value={quickFilters.timeRange}
                onValueChange={(value) => handleQuickFilterChange('timeRange', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Last 24 Hours</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content Type</label>
              <Select
                value={quickFilters.contentType}
                onValueChange={(value) => handleQuickFilterChange('contentType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Content</SelectItem>
                  <SelectItem value="articles">Articles</SelectItem>
                  <SelectItem value="videos">Videos</SelectItem>
                  <SelectItem value="images">Images</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customizable Dashboard */}
      <CustomizableDashboard
        posts={posts}
        topics={topics}
        dashboardMetrics={dashboardMetrics}
        onTopicSelect={onTopicSelect}
        formatNumber={formatNumber}
      />

      {/* Full Viral Post Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Live Viral Post Feed</span>
            </div>
            <Badge variant="outline" className="text-sm">
              {posts.length} posts loaded
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading viral posts...</span>
            </div>
          ) : (
            <RealtimeViralPosts
              initialPosts={posts}
              filters={filters}
              onPostsUpdate={onPostsUpdate}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
