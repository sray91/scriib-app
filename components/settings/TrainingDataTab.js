'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ExternalLink, Database, AlertCircle, CheckCircle, Loader2, Linkedin, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import PastPostsViewer from '@/components/PastPostsViewer';
import LinkedInScraperComponent from '@/components/LinkedInScraperComponent';

const TrainingDataTab = () => {
  const [activeSubTab, setActiveSubTab] = useState('trending-training');
  const [urls, setUrls] = useState(['']);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState({});
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const supabase = createClientComponentClient();

  // Fetch existing trending posts on component mount
  useEffect(() => {
    fetchTrendingPosts();
  }, []);

  const fetchTrendingPosts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('trending_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrendingPosts(data || []);
    } catch (error) {
      console.error('Error fetching trending posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load trending posts',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addUrlField = () => {
    setUrls([...urls, '']);
  };

  const removeUrlField = (index) => {
    const newUrls = urls.filter((_, i) => i !== index);
    setUrls(newUrls.length > 0 ? newUrls : ['']);
  };

  const updateUrl = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const isValidLinkedInUrl = (url) => {
    const linkedinPattern = /^https:\/\/(www\.)?linkedin\.com\/posts\/.*$/;
    return linkedinPattern.test(url);
  };

  const processUrls = async () => {
    const validUrls = urls.filter(url => url.trim() && isValidLinkedInUrl(url.trim()));
    
    if (validUrls.length === 0) {
      toast({
        title: 'No valid URLs',
        description: 'Please enter at least one valid LinkedIn post URL',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStatus({});

    try {
      // Process each URL
      for (const url of validUrls) {
        setProcessingStatus(prev => ({
          ...prev,
          [url]: { status: 'processing', message: 'Extracting post data...' }
        }));

        try {
          const response = await fetch('/api/training-data/extract', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Failed to extract post data');
          }

          setProcessingStatus(prev => ({
            ...prev,
            [url]: { 
              status: 'success', 
              message: 'Post data extracted and added to training data',
              data: result.data
            }
          }));

        } catch (error) {
          console.error('Error processing URL:', url, error);
          setProcessingStatus(prev => ({
            ...prev,
            [url]: { 
              status: 'error', 
              message: error.message || 'Failed to extract post data'
            }
          }));
        }
      }

      // Refresh trending posts after processing
      await fetchTrendingPosts();

      toast({
        title: 'Processing complete',
        description: `Processed ${validUrls.length} URLs. Check the results below.`,
      });

    } catch (error) {
      console.error('Error in processUrls:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while processing URLs',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const deletePost = async (postId) => {
    try {
      const { error } = await supabase
        .from('trending_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      setTrendingPosts(prev => prev.filter(post => post.id !== postId));
      
      toast({
        title: 'Post deleted',
        description: 'Training data post has been removed',
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete post',
        variant: 'destructive'
      });
    }
  };

  const togglePostStatus = async (postId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('trending_posts')
        .update({ is_active: !currentStatus })
        .eq('id', postId);

      if (error) throw error;

      setTrendingPosts(prev => 
        prev.map(post => 
          post.id === postId 
            ? { ...post, is_active: !currentStatus }
            : post
        )
      );
      
      toast({
        title: 'Post updated',
        description: `Post ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      console.error('Error updating post status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update post status',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            Training Data Manager
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Import and manage LinkedIn posts for AI training data. Extract data from URLs or scrape posts using professional APIs.
          </p>
        </CardHeader>
      </Card>

      {/* Sub-tabs for different training data methods */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="trending-training" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Trending Training Data
          </TabsTrigger>
          <TabsTrigger value="my-posts" className="flex items-center gap-2">
            <Linkedin className="w-4 h-4" />
            My Posts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trending-training" className="mt-6">
          <div className="space-y-6">
            {/* URL Extraction Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Extract from URLs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Enter LinkedIn post URLs to extract and add high-performing content to your training data. 
                  This will help improve the CoCreate AI&apos;s ability to generate engaging posts.
                </div>

                <div className="space-y-3">
                  {urls.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://www.linkedin.com/posts/..."
                        value={url}
                        onChange={(e) => updateUrl(index, e.target.value)}
                        className={`flex-1 ${
                          url && !isValidLinkedInUrl(url) 
                            ? 'border-red-300 focus:border-red-500' 
                            : ''
                        }`}
                      />
                      {urls.length > 1 && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => removeUrlField(index)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {urls.some(url => url && !isValidLinkedInUrl(url)) && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please enter valid LinkedIn post URLs (e.g., https://www.linkedin.com/posts/username-123456789/)
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={addUrlField}
                    disabled={isProcessing}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add URL
                  </Button>
                  <Button
                    onClick={processUrls}
                    disabled={isProcessing || urls.every(url => !url.trim())}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Extract Data
                      </>
                    )}
                  </Button>
                </div>

                {/* Processing Status */}
                {Object.keys(processingStatus).length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h4 className="font-medium">Processing Status:</h4>
                    {Object.entries(processingStatus).map(([url, status]) => (
                      <div key={url} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm font-medium truncate">{url}</div>
                          <div className={`text-sm flex items-center gap-1 mt-1 ${
                            status.status === 'success' ? 'text-green-600' :
                            status.status === 'error' ? 'text-red-600' :
                            'text-blue-600'
                          }`}>
                            {status.status === 'success' && <CheckCircle className="h-3 w-3" />}
                            {status.status === 'error' && <AlertCircle className="h-3 w-3" />}
                            {status.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                            {status.message}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(url, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Training Data Posts Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Training Data Posts ({trendingPosts.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchTrendingPosts}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : trendingPosts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No training data posts yet. Add some LinkedIn post URLs above to get started.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trendingPosts.map((post) => (
                      <div key={post.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={post.is_active ? "default" : "secondary"}>
                                {post.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              {post.author_name && (
                                <span className="text-sm text-gray-600">
                                  by {post.author_name}
                                </span>
                              )}
                              <span className="text-sm text-gray-500">
                                {new Date(post.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-sm text-gray-800 mb-3 whitespace-pre-wrap">
                              {post.content.length > 200 
                                ? `${post.content.substring(0, 200)}...`
                                : post.content
                              }
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>👍 {post.likes}</span>
                              <span>💬 {post.comments}</span>
                              <span>🔄 {post.shares}</span>
                              {post.engagement_rate && (
                                <span>📊 {post.engagement_rate}%</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => togglePostStatus(post.id, post.is_active)}
                            >
                              {post.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deletePost(post.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="my-posts" className="mt-6">
          <div className="space-y-6">
            {/* LinkedIn Post Scraper Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  LinkedIn Post Scraper
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Search LinkedIn posts by keywords, scrape specific URLs, or use preset configurations.
                  All scraped posts are automatically saved to your database.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-6 pb-6">
                  <LinkedInScraperComponent />
                </div>
              </CardContent>
            </Card>

            {/* Imported Posts Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Linkedin className="h-5 w-5" />
                  Imported LinkedIn Posts
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  View and manage your LinkedIn posts that have been imported via scraping or API sync.
                  Analyze engagement metrics and content performance.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-6 pb-6">
                  <PastPostsViewer />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


      </Tabs>

      {/* Feature Highlights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Key Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-blue-600" />
                URL Extraction
              </h4>
              <p className="text-sm text-muted-foreground">
                Extract content directly from LinkedIn post URLs to quickly add high-performing posts to your training data.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                Professional Scraping
              </h4>
              <p className="text-sm text-muted-foreground">
                Uses Apify&apos;s LinkedIn scraper with proxy rotation and anti-blocking measures for reliable data collection.
              </p>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Database className="w-4 h-4 text-green-600" />
                Automatic Storage
              </h4>
              <p className="text-sm text-muted-foreground">
                All scraped posts are automatically stored in your database with full metadata and engagement metrics.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-purple-600" />
                Multiple Sources
              </h4>
              <p className="text-sm text-muted-foreground">
                Scrape from search results, specific URLs, company pages, or user profiles with flexible filtering options.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingDataTab; 