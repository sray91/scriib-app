'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Linkedin, Search, Database } from 'lucide-react';
import PastPostsViewer from '@/components/PastPostsViewer';
import LinkedInScraperComponent from '@/components/LinkedInScraperComponent';

export default function LinkedInTab() {
  const [activeSubTab, setActiveSubTab] = useState('scraper');

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Linkedin className="w-4 h-4 text-white" />
            </div>
            LinkedIn Posts Manager
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Scrape LinkedIn posts using professional APIs and manage your imported post data.
          </p>
        </CardHeader>
      </Card>

      {/* Sub-tabs for Scraper and Posts */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scraper" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Scrape Posts
          </TabsTrigger>
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            My Posts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scraper" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>LinkedIn Post Scraper</CardTitle>
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
        </TabsContent>

        <TabsContent value="posts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Imported LinkedIn Posts</CardTitle>
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

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Search className="w-4 h-4 text-orange-600" />
                Smart Presets
              </h4>
              <p className="text-sm text-muted-foreground">
                Pre-configured searches for trending topics like AI, marketing, business insights, and career advice.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 