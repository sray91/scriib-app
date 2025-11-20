'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';

import SparkDashboard from '@/components/spark/SparkDashboard';
import TopicExplorer from '@/components/spark/TopicExplorer';
import ReportingHub from '@/components/spark/ReportingHub';

import { 
  Zap, 
  TrendingUp, 
  Search, 
  FileText, 
  Info,
  AlertCircle
} from 'lucide-react';

export default function SparkPage() {
  const [posts, setPosts] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [filters, setFilters] = useState({
    sortBy: 'scraped_at',
    timeframe: 'all',
    minViralScore: '0',
    keywords: '',
    onlyViral: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  
  const { toast } = useToast();

  // Load initial data
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load data from API
  const loadData = async (newFilters = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        limit: '50',
        ...filters,
        ...newFilters
      });

      console.log('Loading posts with params:', params.toString());

      // Load posts
      const postsResponse = await fetch(`/api/spark/posts?${params}`);
      const postsResult = await postsResponse.json();

      console.log('Posts API response:', postsResult);

      if (!postsResult.success) {
        throw new Error(postsResult.error || 'Failed to load posts');
      }

      console.log(`Loaded ${postsResult.data?.length || 0} posts from API`);
      setPosts(postsResult.data || []);

      // If no posts found and we're filtering by time, try loading all time
      if ((!postsResult.data || postsResult.data.length === 0) && filters.timeframe !== 'all') {
        console.log('No posts found with current timeframe, trying all time...');
        const allTimeParams = new URLSearchParams({
          limit: '50',
          ...filters,
          ...newFilters,
          timeframe: 'all'
        });
        
        console.log('All time params:', allTimeParams.toString());
        
        const allTimeResponse = await fetch(`/api/spark/posts?${allTimeParams}`);
        const allTimeResult = await allTimeResponse.json();
        
        console.log('All time API response:', allTimeResult);
        
        if (allTimeResult.success && allTimeResult.data?.length > 0) {
          console.log(`✅ Found ${allTimeResult.data.length} posts when searching all time`);
          setPosts(allTimeResult.data);
          // Update filters to show all time
          setFilters(prev => ({ ...prev, timeframe: 'all' }));
        } else {
          console.log('❌ No posts found even with all time filter');
          console.log('API response details:', allTimeResult);
        }
      }

      // Generate trending topics from posts data
      const topicsData = generateTopicsFromPosts(postsResult.data || []);
      setTopics(topicsData);
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
      toast({
        title: "Error loading data",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate trending topics from posts data
  const generateTopicsFromPosts = (postsData) => {
    const topicMap = new Map();
    
    postsData.forEach(post => {
      // Extract keywords and hashtags as topics
      const hashtags = post.hashtags || [];
      const keywords = post.keywords || [];
      const allTopics = [...hashtags, ...keywords];
      
      allTopics.forEach(topic => {
        if (topic && typeof topic === 'string') {
          const normalizedTopic = topic.toLowerCase().trim();
          if (topicMap.has(normalizedTopic)) {
            const existing = topicMap.get(normalizedTopic);
            topicMap.set(normalizedTopic, {
              ...existing,
              postCount: existing.postCount + 1,
              totalEngagement: existing.totalEngagement + (post.likes_count || 0) + (post.comments_count || 0),
              viralScore: Math.max(existing.viralScore, post.viral_score || 0),
              posts: [...existing.posts, post.id]
            });
          } else {
            topicMap.set(normalizedTopic, {
              name: topic,
              postCount: 1,
              totalEngagement: (post.likes_count || 0) + (post.comments_count || 0),
              viralScore: post.viral_score || 0,
              posts: [post.id]
            });
          }
        }
      });
    });

    // Convert to array and sort by viral score
    return Array.from(topicMap.values())
      .sort((a, b) => b.viralScore - a.viralScore)
      .slice(0, 10); // Top 10 topics
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    loadData(newFilters);
  };

  // Handle posts update from realtime component
  const handlePostsUpdate = (newPosts) => {
    setPosts(newPosts);
    const topicsData = generateTopicsFromPosts(newPosts);
    setTopics(topicsData);
  };

  // Handle topic selection
  const handleTopicSelect = (topic) => {
    setSelectedTopic(topic);
    setActiveView('topic-explorer');
  };

  // Handle scraping trigger
  const handleTriggerScrape = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/spark/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            keyword: "AI, machine learning, startup, leadership, marketing, technology, data science",
            sort_type: "date_posted",
            date_filter: "past-24h",
            total_posts: 100 // Reduced from 200 to avoid timeouts
          }
        })
      });

      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        // Handle non-JSON responses (like 504 timeouts)
        const textResponse = await response.text();
        throw new Error(`Server error (${response.status}): ${response.statusText}. This usually means the scraping operation timed out. Try again or contact support.`);
      }
      
      if (response.ok && result.success) {
        toast({
          title: "Scraping Complete",
          description: `Successfully scraped ${result.processed} new posts`,
        });
        // Reload data to show new posts
        loadData();
      } else {
        // If scraping fails, offer to load sample data
        if (result.help) {
          throw new Error(`${result.error}: ${result.help}`);
        } else {
          throw new Error(result.error || 'Scraping failed');
        }
      }
    } catch (err) {
      console.error('Error triggering scrape:', err);
      toast({
        title: "Scraping Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Getting Started Alert for Empty State */}
        {!isLoading && posts.length === 0 && !error && (
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Welcome to Spark!</strong> No viral posts found yet. Click the &quot;Scrape New Posts&quot; button below to start discovering trending content from LinkedIn.
            </AlertDescription>
          </Alert>
        )}

        {/* Navigation */}
        <div className="bg-white rounded-lg shadow-sm border">
          <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-100 rounded-lg m-2">
              <TabsTrigger 
                value="dashboard" 
                className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Dashboard</span>
              </TabsTrigger>
              <TabsTrigger 
                value="topic-explorer" 
                className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <Search className="w-4 h-4" />
                <span>Topic Explorer</span>
              </TabsTrigger>
              <TabsTrigger 
                value="reporting-hub" 
                className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <FileText className="w-4 h-4" />
                <span>Reporting Hub</span>
              </TabsTrigger>
            </TabsList>

            {/* Dashboard View */}
            <TabsContent value="dashboard" className="p-6 space-y-6">
              <SparkDashboard
                posts={posts}
                topics={topics}
                isLoading={isLoading}
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onTopicSelect={handleTopicSelect}
                onPostsUpdate={handlePostsUpdate}
                onTriggerScrape={handleTriggerScrape}
              />
            </TabsContent>

            {/* Topic Explorer View */}
            <TabsContent value="topic-explorer" className="p-6 space-y-6">
              <TopicExplorer
                selectedTopic={selectedTopic}
                posts={posts}
                topics={topics}
                onTopicSelect={handleTopicSelect}
                onBackToDashboard={() => setActiveView('dashboard')}
              />
            </TabsContent>

            {/* Reporting Hub View */}
            <TabsContent value="reporting-hub" className="p-6 space-y-6">
              <ReportingHub
                posts={posts}
                topics={topics}
                filters={filters}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
