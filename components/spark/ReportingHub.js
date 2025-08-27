'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText,
  Download,
  Share,
  Copy,
  Eye,
  Calendar,
  TrendingUp,
  Users,
  Flame,
  BarChart3,
  CheckCircle,
  ExternalLink,
  Plus,
  Trash2,
  Edit
} from 'lucide-react';

export default function ReportingHub({
  posts = [],
  topics = [],
  filters = {}
}) {
  const [activeTab, setActiveTab] = useState('create');
  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportType, setReportType] = useState('summary');
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [dateRange, setDateRange] = useState('week');
  const [savedReports, setSavedReports] = useState([]);
  const [shareableLink, setShareableLink] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Generate report data based on current selections
  const reportData = useMemo(() => {
    const filteredPosts = posts.filter(post => {
      // Apply date range filter
      const postDate = new Date(post.published_at);
      const now = new Date();
      let cutoffDate = new Date();
      
      switch (dateRange) {
        case 'day':
          cutoffDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        default:
          cutoffDate = new Date(0); // All time
      }
      
      if (postDate < cutoffDate) return false;
      
      // Apply topic filter if selected
      if (selectedTopics.length > 0) {
        const postTopics = [...(post.hashtags || []), ...(post.keywords || [])];
        return selectedTopics.some(selectedTopic => 
          postTopics.some(postTopic => 
            postTopic.toLowerCase().includes(selectedTopic.toLowerCase())
          )
        );
      }
      
      return true;
    });

    const viralPosts = filteredPosts.filter(post => post.is_viral);
    const totalEngagement = filteredPosts.reduce((sum, post) => 
      sum + (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0), 0
    );
    const avgViralScore = filteredPosts.length > 0 
      ? filteredPosts.reduce((sum, post) => sum + (post.viral_score || 0), 0) / filteredPosts.length
      : 0;

    // Top performing posts
    const topPosts = filteredPosts
      .sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0))
      .slice(0, 5);

    // Top topics for the period
    const topicStats = topics
      .filter(topic => selectedTopics.length === 0 || selectedTopics.includes(topic.name))
      .slice(0, 10);

    // Calculate top influencers
    const influencerMap = new Map();
    filteredPosts.forEach(post => {
      if (post.author_name) {
        const existing = influencerMap.get(post.author_name) || {
          name: post.author_name,
          title: post.author_title,
          image: post.author_image_url,
          posts: 0,
          viralPosts: 0,
          totalEngagement: 0
        };

        const postEngagement = (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0);
        
        influencerMap.set(post.author_name, {
          ...existing,
          posts: existing.posts + 1,
          viralPosts: existing.viralPosts + (post.is_viral ? 1 : 0),
          totalEngagement: existing.totalEngagement + postEngagement
        });
      }
    });

    const topInfluencers = Array.from(influencerMap.values())
      .sort((a, b) => b.viralPosts - a.viralPosts || b.totalEngagement - a.totalEngagement)
      .slice(0, 5);

    return {
      totalPosts: filteredPosts.length,
      viralPosts: viralPosts.length,
      viralRate: filteredPosts.length > 0 ? (viralPosts.length / filteredPosts.length) * 100 : 0,
      totalEngagement,
      avgViralScore,
      topPosts,
      topTopics: topicStats,
      topInfluencers,
      filteredPosts
    };
  }, [posts, topics, selectedTopics, dateRange]);

  // Format numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Generate report
  const generateReport = async () => {
    setIsGeneratingReport(true);
    
    try {
      // Simulate report generation (in real app, this would call an API)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const reportId = `report_${Date.now()}`;
      const newReport = {
        id: reportId,
        title: reportTitle || 'Untitled Report',
        description: reportDescription,
        type: reportType,
        createdAt: new Date().toISOString(),
        data: reportData,
        filters: {
          dateRange,
          selectedTopics: [...selectedTopics]
        }
      };
      
      setSavedReports(prev => [newReport, ...prev]);
      
      // Generate shareable link
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const shareableUrl = `${baseUrl}/spark/report/${reportId}`;
      setShareableLink(shareableUrl);
      
      setActiveTab('manage');
      
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Copy link to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show success message (you could use toast here)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Delete report
  const deleteReport = (reportId) => {
    setSavedReports(prev => prev.filter(report => report.id !== reportId));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reporting Hub</h1>
              <p className="text-gray-600">Create, manage, and share viral content insights</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="create">Create Report</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="manage">Manage Reports</TabsTrigger>
            </TabsList>
          </CardHeader>
          
          <CardContent>
            {/* Create Report Tab */}
            <TabsContent value="create" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Report Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Report Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reportTitle">Report Title</Label>
                      <Input
                        id="reportTitle"
                        placeholder="e.g., Weekly Viral Content Analysis"
                        value={reportTitle}
                        onChange={(e) => setReportTitle(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reportDescription">Description</Label>
                      <Textarea
                        id="reportDescription"
                        placeholder="Brief description of what this report covers"
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="reportType">Report Type</Label>
                      <Select value={reportType} onValueChange={setReportType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="summary">Executive Summary</SelectItem>
                          <SelectItem value="detailed">Detailed Analysis</SelectItem>
                          <SelectItem value="trends">Trend Report</SelectItem>
                          <SelectItem value="influencers">Influencer Report</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="dateRange">Date Range</Label>
                      <Select value={dateRange} onValueChange={setDateRange}>
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
                      <Label>Topics to Include</Label>
                      <div className="space-y-2">
                        {topics.slice(0, 10).map((topic) => (
                          <div key={topic.name} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`topic-${topic.name}`}
                              checked={selectedTopics.includes(topic.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTopics(prev => [...prev, topic.name]);
                                } else {
                                  setSelectedTopics(prev => prev.filter(t => t !== topic.name));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <label htmlFor={`topic-${topic.name}`} className="text-sm">
                              {topic.name} ({topic.postCount} posts)
                            </label>
                          </div>
                        ))}
                      </div>
                      {selectedTopics.length === 0 && (
                        <p className="text-xs text-gray-500">Leave empty to include all topics</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Report Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle>Report Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm text-blue-700">Total Posts</p>
                          <p className="text-xl font-bold text-blue-900">{formatNumber(reportData.totalPosts)}</p>
                        </div>
                        
                        <div className="bg-red-50 p-3 rounded-lg">
                          <p className="text-sm text-red-700">Viral Posts</p>
                          <p className="text-xl font-bold text-red-900">{formatNumber(reportData.viralPosts)}</p>
                        </div>
                        
                        <div className="bg-green-50 p-3 rounded-lg">
                          <p className="text-sm text-green-700">Viral Rate</p>
                          <p className="text-xl font-bold text-green-900">{reportData.viralRate.toFixed(1)}%</p>
                        </div>
                        
                        <div className="bg-purple-50 p-3 rounded-lg">
                          <p className="text-sm text-purple-700">Avg Score</p>
                          <p className="text-xl font-bold text-purple-900">{reportData.avgViralScore.toFixed(1)}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium">Top Topics</h4>
                        {reportData.topTopics.slice(0, 5).map((topic) => (
                          <div key={topic.name} className="flex justify-between text-sm">
                            <span>{topic.name}</span>
                            <Badge variant="outline">{topic.postCount}</Badge>
                          </div>
                        ))}
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium">Top Influencers</h4>
                        {reportData.topInfluencers.slice(0, 3).map((influencer) => (
                          <div key={influencer.name} className="flex justify-between text-sm">
                            <span className="truncate">{influencer.name}</span>
                            <Badge variant="outline">{influencer.viralPosts}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('preview')}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Report
                </Button>
                <Button 
                  onClick={generateReport}
                  disabled={isGeneratingReport}
                >
                  {isGeneratingReport ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-6">
              <div className="max-w-4xl mx-auto">
                <Card>
                  <CardHeader>
                    <div className="text-center space-y-2">
                      <h1 className="text-3xl font-bold">{reportTitle || 'Viral Content Report'}</h1>
                      <p className="text-gray-600">{reportDescription}</p>
                      <div className="flex justify-center space-x-4 text-sm text-gray-500">
                        <span>Generated: {new Date().toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Period: {dateRange}</span>
                        <span>•</span>
                        <span>Type: {reportType}</span>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-8">
                    {/* Executive Summary */}
                    <section>
                      <h2 className="text-xl font-bold mb-4 flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        Executive Summary
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-600">{formatNumber(reportData.totalPosts)}</p>
                          <p className="text-sm text-gray-600">Total Posts Analyzed</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <p className="text-2xl font-bold text-red-600">{formatNumber(reportData.viralPosts)}</p>
                          <p className="text-sm text-gray-600">Viral Posts</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600">{reportData.viralRate.toFixed(1)}%</p>
                          <p className="text-sm text-gray-600">Viral Rate</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <p className="text-2xl font-bold text-purple-600">{formatNumber(reportData.totalEngagement)}</p>
                          <p className="text-sm text-gray-600">Total Engagement</p>
                        </div>
                      </div>
                    </section>

                    {/* Top Performing Posts */}
                    <section>
                      <h2 className="text-xl font-bold mb-4 flex items-center">
                        <Flame className="w-5 h-5 mr-2" />
                        Top Performing Posts
                      </h2>
                      <div className="space-y-4">
                        {reportData.topPosts.map((post, index) => (
                          <div key={post.id} className="border rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="bg-yellow-100 text-yellow-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="font-medium">{post.author_name}</span>
                                  <Badge variant="outline">Score: {post.viral_score?.toFixed(1)}</Badge>
                                  {post.is_viral && (
                                    <Badge variant="destructive">Viral</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                                  {post.content.substring(0, 200)}...
                                </p>
                                <div className="flex space-x-4 text-sm text-gray-500">
                                  <span>{formatNumber(post.likes_count || 0)} likes</span>
                                  <span>{formatNumber(post.comments_count || 0)} comments</span>
                                  <span>{formatNumber(post.shares_count || 0)} shares</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Trending Topics */}
                    <section>
                      <h2 className="text-xl font-bold mb-4 flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2" />
                        Trending Topics
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reportData.topTopics.slice(0, 10).map((topic, index) => (
                          <div key={topic.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                                {index + 1}
                              </span>
                              <span className="font-medium">{topic.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold">{topic.postCount} posts</div>
                              <div className="text-xs text-gray-500">Score: {topic.viralScore.toFixed(1)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Top Influencers */}
                    <section>
                      <h2 className="text-xl font-bold mb-4 flex items-center">
                        <Users className="w-5 h-5 mr-2" />
                        Top Influencers
                      </h2>
                      <div className="space-y-4">
                        {reportData.topInfluencers.map((influencer, index) => (
                          <div key={influencer.name} className="flex items-center space-x-4 p-4 border rounded-lg">
                            <div className="bg-yellow-100 text-yellow-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            {influencer.image && (
                              <img
                                src={influencer.image}
                                alt={influencer.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <h4 className="font-medium">{influencer.name}</h4>
                              {influencer.title && (
                                <p className="text-sm text-gray-600">{influencer.title}</p>
                              )}
                              <div className="flex space-x-4 text-sm text-gray-500 mt-1">
                                <span>{influencer.posts} posts</span>
                                <span>{influencer.viralPosts} viral</span>
                                <span>{formatNumber(influencer.totalEngagement)} engagement</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Manage Reports Tab */}
            <TabsContent value="manage" className="space-y-6">
              {shareableLink && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>Report generated successfully! Share it with this link:</p>
                      <div className="flex items-center space-x-2">
                        <Input value={shareableLink} readOnly className="text-xs" />
                        <Button 
                          size="sm" 
                          onClick={() => copyToClipboard(shareableLink)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Saved Reports</h3>
                <Button onClick={() => setActiveTab('create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Report
                </Button>
              </div>

              <div className="space-y-4">
                {savedReports.map((report) => (
                  <Card key={report.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-lg">{report.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{report.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>Created: {new Date(report.createdAt).toLocaleDateString()}</span>
                            <span>Type: {report.type}</span>
                            <span>Range: {report.filters.dateRange}</span>
                            <span>{report.data.totalPosts} posts analyzed</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button variant="outline" size="sm">
                            <Share className="w-4 h-4 mr-1" />
                            Share
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4 mr-1" />
                            Export
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => deleteReport(report.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {savedReports.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Reports Yet</h3>
                    <p>Create your first report to start sharing insights</p>
                    <Button className="mt-4" onClick={() => setActiveTab('create')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Report
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
