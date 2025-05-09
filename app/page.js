'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import PostsDashboard from '@/components/post-forge/PostsDashboard'
import PostsStats from '@/components/Dashboard/PostsStats'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, FileText, BarChart3 } from 'lucide-react'
import { getAvailableDocs } from '@/app/utils/docUtils'

export default function HomePage() {
  const [docLinks, setDocLinks] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Fetch documentation links when component mounts
  useEffect(() => {
    async function loadDocs() {
      try {
        setIsLoadingDocs(true);
        const docs = await getAvailableDocs();
        setDocLinks(docs);
      } catch (error) {
        console.error('Failed to load docs:', error);
      } finally {
        setIsLoadingDocs(false);
      }
    }

    loadDocs();
  }, []);

  return (
    <div className="container max-w-6xl py-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to CreatorTask</h1>
      <p className="text-muted-foreground mb-8">
        Select a tool from the sidebar to get started!
      </p>
      
      {/* Original home page cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Access guides and instructions for CreatorTask</p>
            
            {isLoadingDocs ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                <span className="ml-2 text-sm text-muted-foreground">Loading docs...</span>
              </div>
            ) : docLinks.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {docLinks.map((doc) => (
                  <li key={doc.slug}>
                    <Link 
                      href={`/docs/${doc.slug}`} 
                      className="text-blue-600 hover:underline flex items-center"
                    >
                      <FileText className="h-4 w-4 mr-1" /> {doc.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No documentation files found.</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Recent Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">View and manage your recent tasks</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Analytics Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Track your content performance</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Dashboard section */}
      <h2 className="text-2xl font-bold mb-6">Content Dashboard</h2>
      
      {/* Post stats component */}
      <PostsStats />
      
      <PostsDashboard />
    </div>
  )
}