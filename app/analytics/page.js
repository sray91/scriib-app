'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronUp, ChevronDown, TrendingUp, Eye, Heart, MessageCircle, Repeat2, BarChart3, AlertCircle, RefreshCw, ExternalLink, Settings } from 'lucide-react'

const MetricCard = ({ title, value, change, icon: Icon, trend = 'up' }) => (
  <Card className="p-6 bg-white border border-gray-200">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {change && (
          <div className={`flex items-center mt-2 text-sm ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
            {change}
          </div>
        )}
      </div>
      <div className="p-3 bg-blue-50 rounded-lg">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
    </div>
  </Card>
)

export default function AnalyticsPage() {
  const [sortBy, setSortBy] = useState('latest')
  const [sortOrder, setSortOrder] = useState('desc')
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeRange, setTimeRange] = useState('30')
  const [syncing, setSyncing] = useState(false)

  // Fetch LinkedIn analytics data
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/linkedin/analytics?timeRange=${timeRange}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch analytics data')
        }

        setAnalyticsData(data)
      } catch (err) {
        console.error('Analytics fetch error:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalyticsData()
  }, [timeRange])

  // Sync LinkedIn posts
  const handleSyncPosts = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/linkedin/posts/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ count: 50 })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync posts')
      }

      // Refresh analytics data after sync
      setLoading(true)
      const analyticsResponse = await fetch(`/api/linkedin/analytics?timeRange=${timeRange}`)
      const analyticsData = await analyticsResponse.json()

      if (analyticsResponse.ok) {
        setAnalyticsData(analyticsData)
      }

    } catch (err) {
      console.error('Sync error:', err)
      setError(err.message)
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }

  // Calculate aggregate metrics from API data
  const metrics = analyticsData?.metrics || {
    totalViews: 0,
    totalImpressions: 0,
    totalReactions: 0,
    averageEngagement: 0
  }
  
  // Format numbers for display
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  // Sort posts based on selected criteria
  const sortedPosts = useMemo(() => {
    const posts = analyticsData?.posts || []
    if (!posts.length) return []
    
    return [...posts].sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'views':
          aValue = a.metrics?.views || 0
          bValue = b.metrics?.views || 0
          break
        case 'impressions':
          aValue = a.metrics?.impressions || 0
          bValue = b.metrics?.impressions || 0
          break
        case 'reactions':
          aValue = a.metrics?.reactions || 0
          bValue = b.metrics?.reactions || 0
          break
        case 'comments':
          aValue = a.metrics?.comments || 0
          bValue = b.metrics?.comments || 0
          break
        case 'reposts':
          aValue = a.metrics?.shares || 0
          bValue = b.metrics?.shares || 0
          break
        case 'engagement':
          aValue = a.metrics?.engagement || 0
          bValue = b.metrics?.engagement || 0
          break
        default: // latest
          aValue = new Date(a.publishedAt)
          bValue = new Date(b.publishedAt)
          break
      }
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1
      } else {
        return aValue > bValue ? 1 : -1
      }
    })
  }, [analyticsData, sortBy, sortOrder])

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const SortButton = ({ field, children }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => handleSort(field)}
      className="h-auto p-1 text-gray-600 hover:text-gray-900 flex items-center gap-1"
    >
      {children}
      {sortBy === field && (
        sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
      )}
    </Button>
  )

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-lg text-gray-600">Loading LinkedIn analytics...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-center h-64">
            <Card className="p-8 max-w-md text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              {error.includes('not connected') && (
                <Button onClick={() => window.location.href='/settings?tab=social'} className="gap-2">
                  <Settings className="w-4 h-4" />
                  Connect LinkedIn Account
                </Button>
              )}
              {!error.includes('not connected') && (
                <Button onClick={() => window.location.reload()} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
              )}
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">LinkedIn Analytics</h1>
            <p className="text-gray-600 mt-1">Track your post performance and engagement</p>
            {analyticsData?.profile && (
              <p className="text-sm text-gray-500 mt-1">Connected: {analyticsData.profile.name}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncPosts}
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Posts'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* API Limitation Notice */}
        {analyticsData?.apiLimitation && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">API Limitations</h4>
                <p className="text-sm text-blue-700 mt-1">{analyticsData.apiLimitation.message}</p>
                <p className="text-sm text-blue-600 mt-2">{analyticsData.apiLimitation.upgradeInfo}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Post Views"
            value={formatNumber(metrics.totalViews)}
            change="+12%"
            icon={Eye}
            trend="up"
          />
          <MetricCard
            title="Impressions"
            value={formatNumber(metrics.totalImpressions)}
            change="+8%"
            icon={TrendingUp}
            trend="up"
          />
          <MetricCard
            title="Avg Engagement"
            value={`${metrics.averageEngagement?.toFixed(1) || '0.0'}%`}
            change="+0.3%"
            icon={BarChart3}
            trend="up"
          />
          <MetricCard
            title="Total Reactions"
            value={formatNumber(metrics.totalReactions)}
            change="+15%"
            icon={Heart}
            trend="up"
          />
        </div>

        {/* Posts Table */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="bg-white border border-gray-200">
            <TabsTrigger value="posts" className="data-[state=active]:bg-gray-100">
              Posts
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="posts" className="mt-6">
            <Card className="bg-white">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Post Performance</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Sort by:</span>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="latest">Latest</SelectItem>
                        <SelectItem value="views">Views</SelectItem>
                        <SelectItem value="impressions">Impressions</SelectItem>
                        <SelectItem value="reactions">Reactions</SelectItem>
                        <SelectItem value="comments">Comments</SelectItem>
                        <SelectItem value="reposts">Reposts</SelectItem>
                        <SelectItem value="engagement">Engagement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200">
                      <TableHead className="w-1/2">Post</TableHead>
                      <TableHead className="text-center">
                        <SortButton field="views">Views</SortButton>
                      </TableHead>
                      <TableHead className="text-center">
                        <SortButton field="impressions">Impressions</SortButton>
                      </TableHead>
                      <TableHead className="text-center">
                        <SortButton field="reactions">Reactions</SortButton>
                      </TableHead>
                      <TableHead className="text-center">
                        <SortButton field="comments">Comments</SortButton>
                      </TableHead>
                      <TableHead className="text-center">
                        <SortButton field="reposts">Reposts</SortButton>
                      </TableHead>
                      <TableHead className="text-center">
                        <SortButton field="engagement">Engagement</SortButton>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPosts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <BarChart3 className="w-12 h-12 text-gray-400" />
                            <div>
                              <p className="text-gray-900 font-medium mb-1">No posts found</p>
                              <p className="text-sm text-gray-500 mb-3">
                                Sync your LinkedIn posts to see analytics data
                              </p>
                              <Button
                                onClick={handleSyncPosts}
                                disabled={syncing}
                                className="gap-2"
                              >
                                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                {syncing ? 'Syncing Posts...' : 'Sync LinkedIn Posts'}
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedPosts.map((post) => (
                        <TableRow key={post.id} className="hover:bg-gray-50 border-gray-200">
                          <TableCell>
                            <div className="flex items-start gap-3">
                              <Avatar className="w-10 h-10 flex-shrink-0">
                                <AvatarImage src="/placeholder-avatar.jpg" />
                                <AvatarFallback>
                                  {analyticsData?.profile?.name?.split(' ').map(n => n[0]).join('') || 'YP'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-gray-900 line-clamp-2">
                                  {post.content}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-xs text-gray-500">
                                    {new Date(post.publishedAt).toLocaleDateString()}
                                  </p>
                                  {post.postUrl && (
                                    <a
                                      href={post.postUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                      View on LinkedIn
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {formatNumber(post.metrics?.views || 0)}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {formatNumber(post.metrics?.impressions || 0)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Heart className="w-4 h-4 text-red-500" />
                              {post.metrics?.reactions || 0}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <MessageCircle className="w-4 h-4 text-blue-500" />
                              {post.metrics?.comments || 0}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Repeat2 className="w-4 h-4 text-green-500" />
                              {post.metrics?.shares || 0}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={(post.metrics?.engagement || 0) >= 2.0 ? "default" : "secondary"}
                              className={(post.metrics?.engagement || 0) >= 2.0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                            >
                              {(post.metrics?.engagement || 0).toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 