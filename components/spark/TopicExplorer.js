'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  TrendingUp, 
  BarChart3,
  Users,
  Heart,
  MessageCircle,
  Share,
  ExternalLink,
  Flame,
  Calendar,
  Hash,
  Network,
  PieChart,
  LineChart
} from 'lucide-react';

import { EngagementBreakdownChart, TrendChart, InfluencerRadarChart } from './charts';

export default function TopicExplorer({
  selectedTopic,
  posts = [],
  topics = [],
  onTopicSelect,
  onBackToDashboard
}) {
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate topic-specific data
  const topicData = useMemo(() => {
    if (!selectedTopic || !posts.length) {
      return {
        relatedPosts: [],
        totalEngagement: 0,
        avgViralScore: 0,
        topAuthors: [],
        engagementBreakdown: { likes: 0, comments: 0, shares: 0 },
        trendData: [],
        relatedTopics: []
      };
    }

    // Find posts related to this topic
    const relatedPosts = posts.filter(post => {
      const postTopics = [...(post.hashtags || []), ...(post.keywords || [])];
      return postTopics.some(topic => 
        topic.toLowerCase().includes(selectedTopic.name.toLowerCase()) ||
        selectedTopic.name.toLowerCase().includes(topic.toLowerCase())
      );
    });

    // Calculate metrics
    const totalEngagement = relatedPosts.reduce((sum, post) => 
      sum + (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0), 0
    );

    const avgViralScore = relatedPosts.length > 0 
      ? relatedPosts.reduce((sum, post) => sum + (post.viral_score || 0), 0) / relatedPosts.length
      : 0;

    // Calculate engagement breakdown
    const engagementBreakdown = relatedPosts.reduce((acc, post) => ({
      likes: acc.likes + (post.likes_count || 0),
      comments: acc.comments + (post.comments_count || 0),
      shares: acc.shares + (post.shares_count || 0)
    }), { likes: 0, comments: 0, shares: 0 });

    // Calculate top authors for this topic
    const authorMap = new Map();
    relatedPosts.forEach(post => {
      if (post.author_name) {
        const existing = authorMap.get(post.author_name) || {
          name: post.author_name,
          title: post.author_title,
          image: post.author_image_url,
          posts: 0,
          totalEngagement: 0,
          viralPosts: 0,
          avgViralScore: 0
        };

        const postEngagement = (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0);
        
        authorMap.set(post.author_name, {
          ...existing,
          posts: existing.posts + 1,
          totalEngagement: existing.totalEngagement + postEngagement,
          viralPosts: existing.viralPosts + (post.is_viral ? 1 : 0),
          avgViralScore: ((existing.avgViralScore * existing.posts) + (post.viral_score || 0)) / (existing.posts + 1)
        });
      }
    });

    const topAuthors = Array.from(authorMap.values())
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, 5);

    // Generate trend data (simplified - group by day)
    const trendMap = new Map();
    relatedPosts.forEach(post => {
      const date = new Date(post.published_at).toDateString();
      const existing = trendMap.get(date) || { date, posts: 0, engagement: 0, viralScore: 0 };
      const postEngagement = (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0);
      
      trendMap.set(date, {
        ...existing,
        posts: existing.posts + 1,
        engagement: existing.engagement + postEngagement,
        viralScore: Math.max(existing.viralScore, post.viral_score || 0)
      });
    });

    const trendData = Array.from(trendMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-7); // Last 7 days

    // Find related topics
    const relatedTopicsMap = new Map();
    relatedPosts.forEach(post => {
      const postTopics = [...(post.hashtags || []), ...(post.keywords || [])];
      postTopics.forEach(topic => {
        if (topic.toLowerCase() !== selectedTopic.name.toLowerCase()) {
          const existing = relatedTopicsMap.get(topic) || { name: topic, count: 0, engagement: 0 };
          const postEngagement = (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0);
          
          relatedTopicsMap.set(topic, {
            ...existing,
            count: existing.count + 1,
            engagement: existing.engagement + postEngagement
          });
        }
      });
    });

    const relatedTopics = Array.from(relatedTopicsMap.values())
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10);

    return {
      relatedPosts: relatedPosts.sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0)),
      totalEngagement,
      avgViralScore,
      topAuthors,
      engagementBreakdown,
      trendData,
      relatedTopics
    };
  }, [selectedTopic, posts]);

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

  if (!selectedTopic) {
    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">Select a Topic to Explore</h3>
          <p className="text-gray-500">Choose a topic from the dashboard to dive deep into its analysis</p>
        </div>
        <Button onClick={onBackToDashboard} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Topic Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button 
              onClick={onBackToDashboard} 
              variant="ghost" 
              size="sm"
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Hash className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{selectedTopic.name}</h1>
                <p className="text-gray-600">Deep dive analysis and insights</p>
              </div>
            </div>
            
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Related Posts</p>
                    <p className="text-2xl font-bold text-blue-600">{topicData.relatedPosts.length}</p>
                  </div>
                  <BarChart3 className="w-6 h-6 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Engagement</p>
                    <p className="text-2xl font-bold text-purple-600">{formatNumber(topicData.totalEngagement)}</p>
                  </div>
                  <Heart className="w-6 h-6 text-purple-500" />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Avg Viral Score</p>
                    <p className="text-2xl font-bold text-green-600">{topicData.avgViralScore.toFixed(1)}</p>
                  </div>
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Viral Posts</p>
                    <p className="text-2xl font-bold text-red-600">
                      {topicData.relatedPosts.filter(p => p.is_viral).length}
                    </p>
                  </div>
                  <Flame className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabbed Content */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="posts">Viral Posts</TabsTrigger>
              <TabsTrigger value="influencers">Influencers</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
            </TabsList>
          </CardHeader>
          
          <CardContent>
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Engagement Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <PieChart className="w-5 h-5" />
                      <span>Engagement Breakdown</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EngagementBreakdownChart
                      likes={topicData.engagementBreakdown.likes}
                      comments={topicData.engagementBreakdown.comments}
                      shares={topicData.engagementBreakdown.shares}
                    />
                  </CardContent>
                </Card>

                {/* Related Topics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Network className="w-5 h-5" />
                      <span>Related Topics</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {topicData.relatedTopics.map((topic, index) => (
                        <div 
                          key={topic.name}
                          className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                          onClick={() => {
                            const topicData = topics.find(t => t.name.toLowerCase() === topic.name.toLowerCase());
                            if (topicData) onTopicSelect(topicData);
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium">{topic.name}</p>
                            <p className="text-xs text-gray-600">{topic.count} posts</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {formatNumber(topic.engagement)}
                          </Badge>
                        </div>
                      ))}
                      {topicData.relatedTopics.length === 0 && (
                        <p className="text-center text-gray-500 py-4">No related topics found</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Trend Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <LineChart className="w-5 h-5" />
                    <span>Trend Analysis (Last 7 Days)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topicData.trendData.length > 0 ? (
                    <TrendChart trendData={topicData.trendData} />
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <LineChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>No trend data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Viral Posts Tab */}
            <TabsContent value="posts" className="space-y-4">
              {topicData.relatedPosts.map((post) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      {post.author_image_url && (
                        <img
                          src={post.author_image_url}
                          alt={post.author_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium">{post.author_name}</h4>
                          {post.is_viral && (
                            <Badge variant="destructive" className="text-xs">
                              <Flame className="w-3 h-3 mr-1" />
                              Viral
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            Score: {post.viral_score?.toFixed(1)}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                          {post.content}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Heart className="w-4 h-4 mr-1" />
                              {formatNumber(post.likes_count || 0)}
                            </span>
                            <span className="flex items-center">
                              <MessageCircle className="w-4 h-4 mr-1" />
                              {formatNumber(post.comments_count || 0)}
                            </span>
                            <span className="flex items-center">
                              <Share className="w-4 h-4 mr-1" />
                              {formatNumber(post.shares_count || 0)}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">
                              {formatTimeAgo(post.published_at)}
                            </span>
                            {post.post_url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={post.post_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {topicData.relatedPosts.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No posts found for this topic</p>
                </div>
              )}
            </TabsContent>

            {/* Influencers Tab */}
            <TabsContent value="influencers" className="space-y-6">
              {/* Influencer Comparison Chart */}
              {topicData.topAuthors.length >= 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BarChart3 className="w-5 h-5" />
                      <span>Top Influencers Comparison</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InfluencerRadarChart influencers={topicData.topAuthors} />
                  </CardContent>
                </Card>
              )}

              {/* Influencer List */}
              <div className="space-y-4">
                {topicData.topAuthors.map((author, index) => (
                <Card key={author.name} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 text-sm font-bold">
                        {index + 1}
                      </div>
                      {author.image && (
                        <img
                          src={author.image}
                          alt={author.name}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{author.name}</h4>
                        {author.title && (
                          <p className="text-gray-600 mb-2">{author.title}</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Posts</p>
                            <p className="font-bold">{author.posts}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Viral Posts</p>
                            <p className="font-bold">{author.viralPosts}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Total Engagement</p>
                            <p className="font-bold">{formatNumber(author.totalEngagement)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Avg Viral Score</p>
                            <p className="font-bold">{author.avgViralScore.toFixed(1)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                             ))}
               </div>
              {topicData.topAuthors.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No influencer data available for this topic</p>
                </div>
              )}
            </TabsContent>

            {/* Network Tab */}
            <TabsContent value="network" className="space-y-6">
              <div className="text-center py-12 text-gray-500">
                <Network className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Influencer Network Visualization</h3>
                <p>Interactive network graph showing connections between influencers and topics will be available here.</p>
                <p className="text-sm mt-2">This feature requires a graph visualization library like D3.js or vis.js</p>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
