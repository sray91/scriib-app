'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';

import RealtimeViralPosts from '@/components/spark/RealtimeViralPosts';
import SparkFilters from '@/components/spark/SparkFilters';
import SparkStats from '@/components/spark/SparkStats';

import { 
  Zap, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  Info,
  AlertCircle,
  CheckCircle 
} from 'lucide-react';

export default function SparkPage() {
  const [posts, setPosts] = useState([]);
  const [filters, setFilters] = useState({
    sortBy: 'viral_score',
    timeframe: 'week',
    minViralScore: '0',
    keywords: '',
    onlyViral: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isScrapingLoading, setIsScrapingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState('posts');
  
  const { toast } = useToast();

  // Load initial posts
  useEffect(() => {
    loadPosts();
  }, []);

  // Load posts from API
  const loadPosts = async (newFilters = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        limit: '50', // Load more for initial view
        ...filters,
        ...newFilters
      });

      const response = await fetch(`/api/spark/posts?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load posts');
      }

      setPosts(result.data || []);
      
    } catch (err) {
      console.error('Error loading posts:', err);
      setError(err.message);
      toast({
        title: "Error loading posts",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    loadPosts(newFilters);
  };

  // Handle posts update from realtime component
  const handlePostsUpdate = (newPosts) => {
    setPosts(newPosts);
  };

  // Trigger scraping
  const triggerScraping = async () => {
    setIsScrapingLoading(true);
    
    try {
      const response = await fetch('/api/spark/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            keyword: "AI, machine learning, data science, generative AI, startup, product management, leadership",
            sort_type: "date_posted",
            date_filter: "past-24h",
            total_posts: 500
          }
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Scraping failed');
      }

      toast({
        title: "Scraping completed successfully",
        description: `Processed ${result.processed} posts. Found ${result.upserted} new/updated posts.`,
      });

      // Refresh posts and stats
      await loadPosts();
      setStatsRefreshTrigger(prev => prev + 1);

    } catch (err) {
      console.error('Error triggering scrape:', err);
      toast({
        title: "Scraping failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsScrapingLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Spark</h1>
              <p className="text-gray-600">Discover and analyze viral LinkedIn content</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setStatsRefreshTrigger(prev => prev + 1)}
            variant="outline"
            size="sm"
          >
            Refresh Stats
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Spark analyzes viral LinkedIn posts using AI-powered scraping and real-time viral scoring. 
          Configure your filters below and monitor trending content as it happens.
        </AlertDescription>
      </Alert>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="posts" className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4" />
            <span>Viral Posts</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Controls</span>
          </TabsTrigger>
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-6">
          {/* Stats Overview */}
          <SparkStats 
            posts={posts} 
            refreshTrigger={statsRefreshTrigger}
          />
          
          <Separator />

          {/* Filters */}
          <SparkFilters
            onFiltersChange={handleFiltersChange}
            onTriggerScrape={triggerScraping}
            isScrapingLoading={isScrapingLoading}
            currentFilters={filters}
          />

          {/* Posts List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Viral Posts Feed</span>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>{posts.length} posts loaded</span>
                </div>
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
                  onPostsUpdate={handlePostsUpdate}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <SparkStats 
            posts={posts} 
            refreshTrigger={statsRefreshTrigger}
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Advanced Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Advanced Analytics Coming Soon</h3>
                <p>Detailed engagement trends, keyword performance, and viral prediction analytics will be available here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <SparkFilters
            onFiltersChange={handleFiltersChange}
            onTriggerScrape={triggerScraping}
            isScrapingLoading={isScrapingLoading}
            currentFilters={filters}
          />

          <Card>
            <CardHeader>
              <CardTitle>Scraping Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Current Configuration</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Target: LinkedIn posts with AI, ML, startup keywords</li>
                  <li>• Frequency: Manual trigger (automatic scheduling available)</li>
                  <li>• Posts per run: 500 (last 24 hours)</li>
                  <li>• Viral scoring: Real-time engagement velocity analysis</li>
                </ul>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">System Status</h4>
                <div className="flex items-center text-sm text-green-800">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  <span>Apify integration active • Database connected • Real-time updates enabled</span>
                </div>
              </div>

              <Button 
                onClick={triggerScraping}
                disabled={isScrapingLoading}
                className="w-full"
                size="lg"
              >
                {isScrapingLoading ? 'Scraping in Progress...' : 'Run Scraping Job Now'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
