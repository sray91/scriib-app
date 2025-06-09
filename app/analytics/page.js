'use client'

import { useState, useMemo } from 'react'
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
import { ChevronUp, ChevronDown, TrendingUp, Eye, Heart, MessageCircle, Repeat2, BarChart3 } from 'lucide-react'

// Mock data for LinkedIn posts - replace with real data from your API
const mockPostData = [
  {
    id: 1,
    content: "Just launched our new AI-powered content creation tool! 🚀 Excited to see how it helps creators...",
    author: "Your Profile",
    date: "2024-01-15",
    views: 15743,
    impressions: 8234,
    reactions: 234,
    comments: 45,
    reposts: 12,
    engagement: 2.8
  },
  {
    id: 2,
    content: "5 tips for better LinkedIn engagement that actually work 💡",
    author: "Your Profile", 
    date: "2024-01-12",
    views: 9876,
    impressions: 12456,
    reactions: 189,
    comments: 32,
    reposts: 8,
    engagement: 1.9
  },
  {
    id: 3,
    content: "Behind the scenes of building a creator-focused startup 🎬",
    author: "Your Profile",
    date: "2024-01-10", 
    views: 12334,
    impressions: 15678,
    reactions: 145,
    comments: 28,
    reposts: 5,
    engagement: 1.4
  },
  {
    id: 4,
    content: "The future of content creation is collaborative 🤝",
    author: "Your Profile",
    date: "2024-01-08",
    views: 7891,
    impressions: 9823,
    reactions: 156,
    comments: 19,
    reposts: 7,
    engagement: 2.3
  },
  {
    id: 5,
    content: "Why authenticity beats perfection every time ✨",
    author: "Your Profile",
    date: "2024-01-05",
    views: 18234,
    impressions: 22156,
    reactions: 312,
    comments: 67,
    reposts: 23,
    engagement: 2.2
  }
]

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

  // Calculate aggregate metrics
  const totalViews = mockPostData.reduce((sum, post) => sum + post.views, 0)
  const totalImpressions = mockPostData.reduce((sum, post) => sum + post.impressions, 0)
  const avgEngagement = mockPostData.reduce((sum, post) => sum + post.engagement, 0) / mockPostData.length
  const totalReactions = mockPostData.reduce((sum, post) => sum + post.reactions, 0)

  // Format numbers for display
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  // Sort posts based on selected criteria
  const sortedPosts = useMemo(() => {
    return [...mockPostData].sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'views':
          aValue = a.views
          bValue = b.views
          break
        case 'impressions':
          aValue = a.impressions
          bValue = b.impressions
          break
        case 'reactions':
          aValue = a.reactions
          bValue = b.reactions
          break
        case 'comments':
          aValue = a.comments
          bValue = b.comments
          break
        case 'reposts':
          aValue = a.reposts
          bValue = b.reposts
          break
        case 'engagement':
          aValue = a.engagement
          bValue = b.engagement
          break
        default: // latest
          aValue = new Date(a.date)
          bValue = new Date(b.date)
          break
      }
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1
      } else {
        return aValue > bValue ? 1 : -1
      }
    })
  }, [sortBy, sortOrder])

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">LinkedIn Analytics</h1>
            <p className="text-gray-600 mt-1">Track your post performance and engagement</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm">
              Last 30 days
            </Badge>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Post Views"
            value={formatNumber(totalViews)}
            change="+12%"
            icon={Eye}
            trend="up"
          />
          <MetricCard
            title="Impressions"
            value={formatNumber(totalImpressions)}
            change="+8%"
            icon={TrendingUp}
            trend="up"
          />
          <MetricCard
            title="Avg Engagement"
            value={`${avgEngagement.toFixed(1)}%`}
            change="+0.3%"
            icon={BarChart3}
            trend="up"
          />
          <MetricCard
            title="Total Reactions"
            value={formatNumber(totalReactions)}
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
                    {sortedPosts.map((post) => (
                      <TableRow key={post.id} className="hover:bg-gray-50 border-gray-200">
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10 flex-shrink-0">
                              <AvatarImage src="/placeholder-avatar.jpg" />
                              <AvatarFallback>YP</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-gray-900 line-clamp-2">
                                {post.content}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(post.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {formatNumber(post.views)}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {formatNumber(post.impressions)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Heart className="w-4 h-4 text-red-500" />
                            {post.reactions}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <MessageCircle className="w-4 h-4 text-blue-500" />
                            {post.comments}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Repeat2 className="w-4 h-4 text-green-500" />
                            {post.reposts}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={post.engagement >= 2.0 ? "default" : "secondary"}
                            className={post.engagement >= 2.0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                          >
                            {post.engagement}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
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