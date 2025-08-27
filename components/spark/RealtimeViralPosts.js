'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share, ExternalLink, TrendingUp, Flame } from 'lucide-react';

export default function RealtimeViralPosts({ 
  initialPosts = [],
  filters = {},
  onPostsUpdate 
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const supabase = getSupabase();

  // Fetch posts from API
  const fetchPosts = useCallback(async (newFilters = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        limit: '20',
        sortBy: 'viral_score',
        timeframe: 'week',
        ...filters,
        ...newFilters
      });

      const response = await fetch(`/api/spark/posts?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch posts');
      }

      setPosts(result.data || []);
      onPostsUpdate?.(result.data || []);

    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [filters, onPostsUpdate]);

  // Set up real-time subscription
  useEffect(() => {
    let channel;
    let retryTimeout;

    const setupRealtimeSubscription = () => {
      try {
        channel = supabase
          .channel('viral-posts-channel')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'viral_posts'
            },
            (payload) => {
              try {
                // Handle different types of changes
                switch (payload.eventType) {
                  case 'INSERT':
                    setPosts(prev => {
                      const newPost = payload.new;
                      // Add new post if it meets our current filters
                      if (shouldIncludePost(newPost)) {
                        return [newPost, ...prev].slice(0, 20); // Keep only top 20
                      }
                      return prev;
                    });
                    break;
                    
                  case 'UPDATE':
                    setPosts(prev => 
                      prev.map(post => 
                        post.id === payload.new.id ? payload.new : post
                      )
                    );
                    break;
                    
                  case 'DELETE':
                    setPosts(prev => 
                      prev.filter(post => post.id !== payload.old.id)
                    );
                    break;
                    
                  default:
                    // For any other changes, refresh the data
                    fetchPosts();
                }
              } catch (err) {
                console.error('Error handling realtime update:', err);
              }
            }
          )
          .subscribe((status) => {
            setConnectionStatus(status);
            
            // Handle connection status changes
            if (status === 'SUBSCRIBED') {
              console.log('✅ Real-time subscription active');
            } else if (status === 'CLOSED') {
              console.log('🔌 Real-time subscription closed');
              // Retry connection after a delay
              retryTimeout = setTimeout(() => {
                console.log('🔄 Retrying real-time connection...');
                setupRealtimeSubscription();
              }, 5000);
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Real-time subscription error');
              setError('Real-time connection failed. Posts may not update automatically.');
            }
          });
      } catch (err) {
        console.error('Error setting up realtime subscription:', err);
        setError('Could not establish real-time connection.');
      }
    };

    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [supabase, fetchPosts, shouldIncludePost]);

  // Helper function to determine if a post should be included based on current filters
  const shouldIncludePost = (post) => {
    // This is a simplified version - in practice you'd want to apply the same logic as the API
    const minViralScore = parseFloat(filters.minViralScore) || 0;
    const onlyViral = filters.onlyViral === 'true';
    
    if (post.viral_score < minViralScore) return false;
    if (onlyViral && !post.is_viral) return false;
    
    return true;
  };

  // Format engagement numbers
  const formatCount = (count) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  // Get viral score color
  const getViralScoreColor = (score) => {
    if (score >= 100) return 'text-red-500';
    if (score >= 50) return 'text-orange-500';
    if (score >= 25) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-lg bg-red-50">
        <h3 className="text-red-800 font-medium">Error loading viral posts</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <Button 
          onClick={() => fetchPosts()} 
          variant="outline" 
          size="sm" 
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'SUBSCRIBED' ? 'bg-green-500' : 'bg-gray-400'
          }`} />
          <span className="text-sm text-gray-600">
            {connectionStatus === 'SUBSCRIBED' ? 'Live updates active' : 'Connecting...'}
          </span>
        </div>
        
        <Button 
          onClick={() => fetchPosts()} 
          variant="outline" 
          size="sm"
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {posts.length === 0 && !isLoading ? (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Viral Posts Found</h3>
            <p className="text-sm mb-4 max-w-md mx-auto">
              It looks like there are no viral posts yet. Get started by scraping some fresh content from LinkedIn!
            </p>
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                💡 <strong>Getting Started:</strong> Click &quot;Scrape New Posts&quot; to fetch viral LinkedIn content
              </p>
              <p className="text-xs text-gray-600">
                🔧 <strong>Setup Required:</strong> You may need to rent the LinkedIn scraper on Apify first
              </p>
              <p className="text-xs text-gray-600">
                🔍 <strong>Search:</strong> Try keywords like AI, startup, leadership, marketing
              </p>
              <p className="text-xs text-gray-600">
                ⚡ <strong>Filters:</strong> Adjust time range and engagement levels to refine results
              </p>
            </div>
          </div>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {post.author_image_url && (
                      <img
                        src={post.author_image_url}
                        alt={post.author_name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <h3 className="font-medium text-sm">{post.author_name}</h3>
                      {post.author_title && (
                        <p className="text-xs text-gray-600">{post.author_title}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {post.is_viral && (
                      <Badge variant="destructive" className="text-xs">
                        <Flame className="w-3 h-3 mr-1" />
                        Viral
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      Score: <span className={getViralScoreColor(post.viral_score)}>
                        {post.viral_score?.toFixed(1) || '0.0'}
                      </span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Post Content */}
                <div className="text-sm leading-relaxed">
                  {post.content.length > 300 ? (
                    <>
                      {post.content.substring(0, 300)}...
                      {post.post_url && (
                        <Button variant="link" size="sm" className="p-0 h-auto text-blue-600">
                          Read more
                        </Button>
                      )}
                    </>
                  ) : (
                    post.content
                  )}
                </div>

                {/* Hashtags */}
                {post.hashtags && post.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {post.hashtags.slice(0, 5).map((hashtag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {hashtag}
                      </Badge>
                    ))}
                    {post.hashtags.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{post.hashtags.length - 5} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Engagement Metrics */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Heart className="w-4 h-4" />
                      <span>{formatCount(post.likes_count || 0)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MessageCircle className="w-4 h-4" />
                      <span>{formatCount(post.comments_count || 0)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Share className="w-4 h-4" />
                      <span>{formatCount(post.shares_count || 0)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(post.published_at)}
                    </span>
                    {post.post_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a 
                          href={post.post_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && posts.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}
