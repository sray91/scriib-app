'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, RefreshCw, Search, User, Briefcase, Mail, Linkedin, X } from 'lucide-react'
import PostScraperProgress from '@/components/crm/PostScraperProgress'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function CRMPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [scrapingProgress, setScrapingProgress] = useState(null)
  const [posts, setPosts] = useState([])
  const [currentPost, setCurrentPost] = useState(-1)
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Fetch contacts from database
  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setContacts(data || [])
    } catch (error) {
      console.error('Error fetching contacts:', error)
      toast({
        title: 'Error',
        description: 'Failed to load contacts',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [supabase, toast])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // Handle populate button click - triggers Apify scraping with SSE
  const handlePopulate = async () => {
    setScraping(true)
    setPosts([])
    setCurrentPost(-1)
    setScrapingProgress({ message: 'Initializing...' })

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to populate CRM',
          variant: 'destructive'
        })
        setScraping(false)
        setScrapingProgress(null)
        return
      }

      // Check if user has a connected LinkedIn account
      const { data: linkedInAccount, error: accountError } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', 'linkedin')
        .single()

      if (accountError || !linkedInAccount) {
        toast({
          title: 'LinkedIn Account Not Connected',
          description: 'Please connect your LinkedIn account in Settings > Social',
          variant: 'destructive'
        })
        setScraping(false)
        setScrapingProgress(null)
        return
      }

      // Connect to SSE endpoint
      const eventSource = new EventSource('/api/crm/scrape-linkedin-stream')

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'status':
            setScrapingProgress({ message: data.message })
            break

          case 'posts_found':
            // Initialize posts array
            const initialPosts = Array.from({ length: data.count }, (_, i) => ({
              status: 'pending',
              likersProgress: 0,
              commentersProgress: 0,
              totalContacts: 0
            }))
            setPosts(initialPosts)
            setScrapingProgress({ message: `Found ${data.count} posts. Starting to scrape engagements...` })
            break

          case 'post_start':
            setCurrentPost(data.postIndex)
            setPosts(prev => {
              const updated = [...prev]
              updated[data.postIndex] = {
                ...updated[data.postIndex],
                status: 'processing',
                likersProgress: 0,
                commentersProgress: 0
              }
              return updated
            })
            break

          case 'engagement_start':
            setScrapingProgress({
              message: `Post ${data.postIndex + 1}: Scraping ${data.engagementType}...`
            })
            break

          case 'engagement_complete':
            setPosts(prev => {
              const updated = [...prev]
              const field = data.engagementType === 'likers' ? 'likersProgress' : 'commentersProgress'
              updated[data.postIndex] = {
                ...updated[data.postIndex],
                [field]: 100
              }
              return updated
            })
            break

          case 'post_complete':
            setPosts(prev => {
              const updated = [...prev]
              updated[data.postIndex] = {
                ...updated[data.postIndex],
                status: 'completed',
                totalContacts: data.totalContacts
              }
              return updated
            })
            break

          case 'enrichment_start':
            setScrapingProgress({ message: data.message })
            break

          case 'enrichment_progress':
            setScrapingProgress({
              message: `Enriching profiles: ${data.current} / ${data.total}`
            })
            break

          case 'complete':
            eventSource.close()
            setScraping(false)
            setScrapingProgress(null)
            toast({
              title: 'Success!',
              description: `Added ${data.contactsAdded} contacts and enriched ${data.profilesEnriched} profiles`,
            })
            // Refresh contacts list
            fetchContacts()
            break

          case 'error':
            eventSource.close()
            setScraping(false)
            setScrapingProgress(null)
            toast({
              title: 'Error',
              description: data.message,
              variant: 'destructive'
            })
            break
        }
      }

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error)
        eventSource.close()
        setScraping(false)
        setScrapingProgress(null)
        toast({
          title: 'Error',
          description: 'Connection to scraping service lost',
          variant: 'destructive'
        })
      }

    } catch (error) {
      console.error('Error populating CRM:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to populate CRM',
        variant: 'destructive'
      })
      setScraping(false)
      setScrapingProgress(null)
    }
  }

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      contact.name?.toLowerCase().includes(search) ||
      contact.subtitle?.toLowerCase().includes(search) ||
      contact.job_title?.toLowerCase().includes(search) ||
      contact.company?.toLowerCase().includes(search) ||
      contact.email?.toLowerCase().includes(search)
    )
  })

  return (
    <div className="container py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
          <p className="text-muted-foreground mt-1">
            Manage your LinkedIn engagement contacts
          </p>
        </div>
        <Button
          onClick={handlePopulate}
          disabled={scraping}
          size="lg"
        >
          {scraping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scraping LinkedIn...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Populate from LinkedIn
            </>
          )}
        </Button>
      </div>

      {/* Progress Modal/Overlay */}
      <AnimatePresence>
        {scraping && scrapingProgress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              // Prevent closing while scraping
              e.preventDefault()
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background border rounded-lg shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Scraping Progress</h2>
                <div className="text-sm text-muted-foreground">
                  Please don&apos;t close this window
                </div>
              </div>

              {posts.length > 0 ? (
                <PostScraperProgress
                  posts={posts}
                  currentPost={currentPost}
                  overallProgress={scrapingProgress}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
                  <p className="text-lg font-medium">{scrapingProgress.message}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
          <div className="flex items-center gap-4 pt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-1">No contacts yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Click &quot;Populate from LinkedIn&quot; to import contacts from your post engagements
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Subtitle</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Engagement Type</TableHead>
                    <TableHead>Source Post</TableHead>
                    <TableHead>Profile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.subtitle || '-'}
                      </TableCell>
                      <TableCell>{contact.job_title || '-'}</TableCell>
                      <TableCell>{contact.company || '-'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          contact.engagement_type === 'like'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {contact.engagement_type || 'unknown'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.post_url ? (
                          <a
                            href={contact.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            View post
                          </a>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {contact.profile_url ? (
                          <a
                            href={contact.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="sm">
                              <Linkedin className="h-4 w-4" />
                            </Button>
                          </a>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
