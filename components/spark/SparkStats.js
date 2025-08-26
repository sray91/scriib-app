'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Flame, Heart, MessageCircle, Clock, Database } from 'lucide-react';

export default function SparkStats({ posts = [], refreshTrigger = 0 }) {
  const [overallStats, setOverallStats] = useState({
    totalPosts: 0,
    viralPosts: 0,
    avgViralScore: 0,
    topEngagement: 0,
    lastScraped: null
  });
  const [isLoading, setIsLoading] = useState(false);

  // Calculate stats from current posts
  const calculateCurrentStats = () => {
    if (!posts || posts.length === 0) {
      return {
        currentPosts: 0,
        currentViral: 0,
        avgScore: 0,
        maxEngagement: 0,
        totalLikes: 0,
        totalComments: 0
      };
    }

    const viralCount = posts.filter(post => post.is_viral).length;
    const totalScore = posts.reduce((sum, post) => sum + (post.viral_score || 0), 0);
    const avgScore = posts.length > 0 ? totalScore / posts.length : 0;
    
    const maxEngagement = Math.max(
      ...posts.map(post => (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0))
    );

    const totalLikes = posts.reduce((sum, post) => sum + (post.likes_count || 0), 0);
    const totalComments = posts.reduce((sum, post) => sum + (post.comments_count || 0), 0);

    return {
      currentPosts: posts.length,
      currentViral: viralCount,
      avgScore,
      maxEngagement,
      totalLikes,
      totalComments
    };
  };

  // Fetch overall database stats
  const fetchOverallStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/spark/scrape');
      const result = await response.json();
      
      if (result.success) {
        setOverallStats({
          totalPosts: result.totalPosts || 0,
          viralPosts: 0, // This would need to be added to the API
          avgViralScore: 0, // This would need to be calculated in the API
          topEngagement: 0, // This would need to be added to the API
          lastScraped: result.lastScraped
        });
      }
    } catch (error) {
      console.error('Error fetching overall stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch stats on component mount and when refreshTrigger changes
  useEffect(() => {
    fetchOverallStats();
  }, [refreshTrigger]);

  const currentStats = calculateCurrentStats();

  // Format numbers
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Format date
  const formatLastScraped = (dateString) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const statCards = [
    {
      title: 'Current Posts',
      value: currentStats.currentPosts,
      icon: Database,
      description: 'Posts shown',
      color: 'text-blue-600'
    },
    {
      title: 'Viral Posts',
      value: currentStats.currentViral,
      icon: Flame,
      description: `${currentStats.currentPosts > 0 ? Math.round((currentStats.currentViral / currentStats.currentPosts) * 100) : 0}% viral rate`,
      color: 'text-red-600'
    },
    {
      title: 'Avg Viral Score',
      value: currentStats.avgScore.toFixed(1),
      icon: TrendingUp,
      description: 'Current selection',
      color: 'text-green-600'
    },
    {
      title: 'Total Engagement',
      value: formatNumber(currentStats.totalLikes + currentStats.totalComments),
      icon: Heart,
      description: 'Likes + Comments',
      color: 'text-pink-600'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.description}</p>
                  </div>
                  <IconComponent className={`w-8 h-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>System Info</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Posts in DB:</span>
              <div className="font-medium">
                {isLoading ? 'Loading...' : formatNumber(overallStats.totalPosts)}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Last Scraped:</span>
              <div className="font-medium">
                {formatLastScraped(overallStats.lastScraped)}
              </div>
            </div>
            <div>
              <span className="text-gray-600">Data Source:</span>
              <div className="font-medium flex items-center space-x-2">
                <span>LinkedIn via Apify</span>
                <Badge variant="outline" className="text-xs">Live</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performers (if we have current posts) */}
      {currentStats.currentPosts > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Selection Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Most Liked Post:</span>
                <div className="font-medium">
                  {formatNumber(Math.max(...posts.map(p => p.likes_count || 0)))} likes
                </div>
              </div>
              <div>
                <span className="text-gray-600">Most Commented:</span>
                <div className="font-medium">
                  {formatNumber(Math.max(...posts.map(p => p.comments_count || 0)))} comments
                </div>
              </div>
              <div>
                <span className="text-gray-600">Highest Viral Score:</span>
                <div className="font-medium">
                  {Math.max(...posts.map(p => p.viral_score || 0)).toFixed(1)}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Avg Engagement Rate:</span>
                <div className="font-medium">
                  {posts.length > 0 
                    ? (posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / posts.length).toFixed(1)
                    : '0.0'
                  }%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
