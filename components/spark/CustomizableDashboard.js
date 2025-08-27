'use client';

import { useState, useCallback } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  TrendingUp, 
  Flame, 
  Users, 
  Heart, 
  BarChart3,
  Star,
  Settings,
  Move,
  Eye,
  EyeOff,
  RotateCcw,
  Save
} from 'lucide-react';

import { EngagementBreakdownChart, TrendChart, TopicPerformanceChart } from './charts';

// Define widget types
const WIDGET_TYPES = {
  METRICS: 'metrics',
  TRENDING_TOPICS: 'trending_topics',
  TOP_INFLUENCERS: 'top_influencers',
  ENGAGEMENT_CHART: 'engagement_chart',
  TREND_CHART: 'trend_chart',
  TOPIC_PERFORMANCE: 'topic_performance',
  RECENT_VIRAL: 'recent_viral'
};

// Default widget configuration
const DEFAULT_WIDGETS = [
  { id: 'metrics', type: WIDGET_TYPES.METRICS, title: 'Key Metrics', visible: true, position: 0 },
  { id: 'engagement_chart', type: WIDGET_TYPES.ENGAGEMENT_CHART, title: 'Engagement Distribution', visible: true, position: 1 },
  { id: 'topic_performance', type: WIDGET_TYPES.TOPIC_PERFORMANCE, title: 'Topic Performance', visible: true, position: 2 },
  { id: 'trend_chart', type: WIDGET_TYPES.TREND_CHART, title: 'Viral Content Trends', visible: true, position: 3 },
  { id: 'trending_topics', type: WIDGET_TYPES.TRENDING_TOPICS, title: 'Trending Topics', visible: true, position: 4 },
  { id: 'top_influencers', type: WIDGET_TYPES.TOP_INFLUENCERS, title: 'Top Influencers', visible: true, position: 5 },
  { id: 'recent_viral', type: WIDGET_TYPES.RECENT_VIRAL, title: 'Recent Viral Posts', visible: true, position: 6 }
];

// Draggable Widget Component
function DraggableWidget({ widget, index, moveWidget, children, customizationMode }) {
  const [{ isDragging }, drag] = useDrag({
    type: 'widget',
    item: { id: widget.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: customizationMode
  });

  const [, drop] = useDrop({
    accept: 'widget',
    hover: (draggedItem) => {
      if (draggedItem.index !== index) {
        moveWidget(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  const opacity = isDragging ? 0.5 : 1;

  return (
    <div
      ref={(node) => customizationMode ? drag(drop(node)) : null}
      style={{ opacity }}
      className={`relative ${customizationMode ? 'cursor-move' : ''}`}
    >
      {customizationMode && (
        <div className="absolute top-2 right-2 z-10 bg-white rounded-md shadow-md p-1 border">
          <Move className="w-4 h-4 text-gray-500" />
        </div>
      )}
      {children}
    </div>
  );
}

// Widget Content Components
function MetricsWidget({ dashboardMetrics, formatNumber }) {
  const metrics = [
    {
      title: 'Total Posts',
      value: formatNumber(dashboardMetrics.totalPosts),
      icon: BarChart3,
      color: 'text-blue-600',
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
    },
    {
      title: 'Viral Posts',
      value: formatNumber(dashboardMetrics.viralPosts),
      icon: Flame,
      color: 'text-red-600',
      bg: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
    },
    {
      title: 'Avg Viral Score',
      value: dashboardMetrics.avgViralScore.toFixed(1),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
    },
    {
      title: 'Total Engagement',
      value: formatNumber(dashboardMetrics.totalEngagement),
      icon: Heart,
      color: 'text-purple-600',
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => {
        const IconComponent = metric.icon;
        return (
          <Card key={metric.title} className={metric.bg}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{metric.title}</p>
                  <p className="text-3xl font-bold">{metric.value}</p>
                </div>
                <IconComponent className={`w-8 h-8 ${metric.color}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TrendingTopicsWidget({ topics, onTopicSelect }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5" />
          <span>Trending Topics</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topics.slice(0, 10).map((topic, index) => (
            <div 
              key={topic.name}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
              onClick={() => onTopicSelect(topic)}
            >
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-sm">{topic.name}</p>
                  <p className="text-xs text-gray-600">{topic.postCount} posts</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-600">{topic.viralScore.toFixed(1)}</p>
                <p className="text-xs text-gray-500">score</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TopInfluencersWidget({ topInfluencers, formatNumber }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="w-5 h-5" />
          <span>Top Influencers</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topInfluencers.map((influencer, index) => (
            <div key={influencer.name} className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
                {index + 1}
              </div>
              {influencer.image && (
                <img
                  src={influencer.image}
                  alt={influencer.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{influencer.name}</p>
                {influencer.title && (
                  <p className="text-xs text-gray-600 truncate">{influencer.title}</p>
                )}
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{influencer.viralPosts} viral posts</span>
                  <span>•</span>
                  <span>{formatNumber(influencer.totalEngagement)} engagement</span>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                <Star className="w-3 h-3 mr-1" />
                {influencer.maxViralScore.toFixed(1)}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Customizable Dashboard Component
export default function CustomizableDashboard({
  posts = [],
  topics = [],
  dashboardMetrics,
  onTopicSelect,
  formatNumber
}) {
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [customizationMode, setCustomizationMode] = useState(false);

  // Move widget function for drag and drop
  const moveWidget = useCallback((dragIndex, hoverIndex) => {
    setWidgets((prevWidgets) => {
      const newWidgets = [...prevWidgets];
      const draggedWidget = newWidgets[dragIndex];
      
      newWidgets.splice(dragIndex, 1);
      newWidgets.splice(hoverIndex, 0, draggedWidget);
      
      // Update positions
      return newWidgets.map((widget, index) => ({
        ...widget,
        position: index
      }));
    });
  }, []);

  // Toggle widget visibility
  const toggleWidgetVisibility = (widgetId) => {
    setWidgets(prevWidgets =>
      prevWidgets.map(widget =>
        widget.id === widgetId ? { ...widget, visible: !widget.visible } : widget
      )
    );
  };

  // Reset to default layout
  const resetLayout = () => {
    setWidgets(DEFAULT_WIDGETS);
  };

  // Save layout (in a real app, this would save to backend/localStorage)
  const saveLayout = () => {
    localStorage.setItem('sparkDashboardLayout', JSON.stringify(widgets));
    setCustomizationMode(false);
  };

  // Generate trend data for charts
  const trendData = (() => {
    const trendMap = new Map();
    posts.forEach(post => {
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
    
    return Array.from(trendMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-7);
  })();

  // Render widget content based on type
  const renderWidgetContent = (widget) => {
    switch (widget.type) {
      case WIDGET_TYPES.METRICS:
        return <MetricsWidget dashboardMetrics={dashboardMetrics} formatNumber={formatNumber} />;
      
      case WIDGET_TYPES.TRENDING_TOPICS:
        return <TrendingTopicsWidget topics={topics} onTopicSelect={onTopicSelect} />;
      
      case WIDGET_TYPES.TOP_INFLUENCERS:
        return <TopInfluencersWidget topInfluencers={dashboardMetrics.topInfluencers} formatNumber={formatNumber} />;
      
      case WIDGET_TYPES.ENGAGEMENT_CHART:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Engagement Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <EngagementBreakdownChart
                likes={posts.reduce((sum, post) => sum + (post.likes_count || 0), 0)}
                comments={posts.reduce((sum, post) => sum + (post.comments_count || 0), 0)}
                shares={posts.reduce((sum, post) => sum + (post.shares_count || 0), 0)}
              />
            </CardContent>
          </Card>
        );
      
      case WIDGET_TYPES.TREND_CHART:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Viral Content Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart trendData={trendData} />
            </CardContent>
          </Card>
        );
      
      case WIDGET_TYPES.TOPIC_PERFORMANCE:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Topic Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <TopicPerformanceChart topics={topics} />
            </CardContent>
          </Card>
        );
      
      case WIDGET_TYPES.RECENT_VIRAL:
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Flame className="w-5 h-5" />
                <span>Recent Viral Posts</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardMetrics.recentViralPosts.map((post) => (
                  <div key={post.id} className="p-3 rounded-lg bg-red-50 border border-red-100">
                    <div className="flex items-start space-x-3">
                      {post.author_image_url && (
                        <img
                          src={post.author_image_url}
                          alt={post.author_name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{post.author_name}</p>
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                          {post.content.substring(0, 100)}...
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 text-xs text-gray-500">
                            <span className="flex items-center">
                              <Heart className="w-3 h-3 mr-1" />
                              {formatNumber(post.likes_count || 0)}
                            </span>
                          </div>
                          <Badge variant="destructive" className="text-xs">
                            {post.viral_score?.toFixed(1)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      
      default:
        return <div>Unknown widget type</div>;
    }
  };

  const visibleWidgets = widgets.filter(widget => widget.visible).sort((a, b) => a.position - b.position);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        {/* Customization Controls */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Dashboard Customization</span>
              </CardTitle>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="customization-mode"
                    checked={customizationMode}
                    onCheckedChange={setCustomizationMode}
                  />
                  <Label htmlFor="customization-mode">Customize Layout</Label>
                </div>
                {customizationMode && (
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={resetLayout}>
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Reset
                    </Button>
                    <Button size="sm" onClick={saveLayout}>
                      <Save className="w-4 h-4 mr-1" />
                      Save Layout
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          
          {customizationMode && (
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Drag widgets to reorder them, or toggle their visibility below:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {widgets.map((widget) => (
                    <div key={widget.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-sm font-medium">{widget.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleWidgetVisibility(widget.id)}
                      >
                        {widget.visible ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Customizable Widget Grid */}
        <div className="space-y-6">
          {visibleWidgets.map((widget, index) => (
            <DraggableWidget
              key={widget.id}
              widget={widget}
              index={index}
              moveWidget={moveWidget}
              customizationMode={customizationMode}
            >
              {renderWidgetContent(widget)}
            </DraggableWidget>
          ))}
        </div>

        {customizationMode && (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500">Drag widgets above to reorder your dashboard</p>
          </div>
        )}
      </div>
    </DndProvider>
  );
}
