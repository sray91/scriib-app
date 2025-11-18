'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, RefreshCw, Search, User, Briefcase, Mail, Linkedin, X, Trash2, UserPlus, Workflow, Send, Download, Upload } from 'lucide-react'
import PostScraperProgress from '@/components/crm/PostScraperProgress'
import ProfileModal from '@/components/crm/ProfileModal'
import AddContactModal from '@/components/crm/AddContactModal'
import PipelineBuilder from '@/components/crm/PipelineBuilder'
import PipelineAssignment from '@/components/crm/PipelineAssignment'
import AddToCampaignModal from '@/components/crm/AddToCampaignModal'
import { contactsToCSV, downloadCSV, parseCSV } from '@/lib/csv-utils'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function CRMPage() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [scrapingProgress, setScrapingProgress] = useState(null)
  const [posts, setPosts] = useState([])
  const [currentPost, setCurrentPost] = useState(-1)
  const [deleteContactId, setDeleteContactId] = useState(null)
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [selectedContact, setSelectedContact] = useState(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false)
  const [isPipelineBuilderOpen, setIsPipelineBuilderOpen] = useState(false)
  const [pipelines, setPipelines] = useState([])
  const [selectedPipelineFilter, setSelectedPipelineFilter] = useState('all')
  const [pipelineContacts, setPipelineContacts] = useState([])
  const [selectedContacts, setSelectedContacts] = useState([])
  const [isAddToCampaignModalOpen, setIsAddToCampaignModalOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
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

  // Fetch pipelines for the filter dropdown
  const fetchPipelines = useCallback(async () => {
    try {
      const response = await fetch('/api/pipelines')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch pipelines')
      }

      setPipelines(data.pipelines || [])
    } catch (error) {
      console.error('Error fetching pipelines:', error)
    }
  }, [])

  // Fetch all pipeline contacts to determine which contacts are in which pipeline
  const fetchPipelineContacts = useCallback(async () => {
    try {
      const response = await fetch('/api/pipelines/contacts')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch pipeline contacts')
      }

      setPipelineContacts(data.pipeline_contacts || [])
    } catch (error) {
      console.error('Error fetching pipeline contacts:', error)
    }
  }, [])

  useEffect(() => {
    fetchContacts()
    fetchPipelines()
    fetchPipelineContacts()

    // Set up real-time subscription for pipeline_contacts changes
    const channel = supabase
      .channel('pipeline_contacts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pipeline_contacts'
        },
        () => {
          // Refresh pipeline contacts when they change
          fetchPipelineContacts()
        }
      )
      .subscribe()

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchContacts, fetchPipelines, fetchPipelineContacts, supabase])

  // Delete a single contact
  const handleDeleteContact = async () => {
    if (!deleteContactId) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/crm/contacts?id=${deleteContactId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete contact')
      }

      toast({
        title: 'Success',
        description: 'Contact deleted successfully',
      })

      // Refresh contacts list
      fetchContacts()
    } catch (error) {
      console.error('Error deleting contact:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete contact',
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
      setDeleteContactId(null)
    }
  }

  // Handle row click to open profile modal
  const handleRowClick = (contact) => {
    setSelectedContact(contact)
    setIsProfileModalOpen(true)
  }

  // Handle profile enriched callback
  const handleProfileEnriched = (updatedContact) => {
    // Update the contact in the local state
    setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c))
    setSelectedContact(updatedContact)
  }

  // Handle contact added callback
  const handleContactAdded = (newContact) => {
    // Refresh the contacts list
    fetchContacts()
  }

  // Handle select all contacts
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedContacts(filteredContacts.map(c => c.id))
    } else {
      setSelectedContacts([])
    }
  }

  // Handle individual contact selection
  const handleSelectContact = (contactId, checked) => {
    if (checked) {
      setSelectedContacts([...selectedContacts, contactId])
    } else {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId))
    }
  }

  // Handle add to campaign success
  const handleAddToCampaignSuccess = () => {
    setSelectedContacts([])
  }

  // Handle CSV export
  const handleExportCSV = async () => {
    setExporting(true)
    try {
      if (contacts.length === 0) {
        toast({
          title: 'No Contacts',
          description: 'There are no contacts to export',
          variant: 'destructive'
        })
        return
      }

      const csvContent = contactsToCSV(contacts)
      const timestamp = new Date().toISOString().split('T')[0]
      downloadCSV(csvContent, `crm-contacts-${timestamp}.csv`)

      toast({
        title: 'Success',
        description: `Exported ${contacts.length} contacts to CSV`,
      })
    } catch (error) {
      console.error('Error exporting CSV:', error)
      toast({
        title: 'Error',
        description: 'Failed to export contacts',
        variant: 'destructive'
      })
    } finally {
      setExporting(false)
    }
  }

  // Handle CSV import
  const handleImportCSV = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const parsedContacts = parseCSV(text)

      if (parsedContacts.length === 0) {
        toast({
          title: 'No Contacts',
          description: 'No valid contacts found in CSV file',
          variant: 'destructive'
        })
        return
      }

      // Send to API
      const response = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'import_csv',
          contacts: parsedContacts
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import contacts')
      }

      toast({
        title: 'Success',
        description: data.message || `Imported ${data.imported} contacts`,
      })

      // Refresh contacts list
      fetchContacts()
    } catch (error) {
      console.error('Error importing CSV:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to import contacts',
        variant: 'destructive'
      })
    } finally {
      setImporting(false)
      // Reset file input
      event.target.value = ''
    }
  }

  // Delete all contacts
  const handleDeleteAll = async () => {
    setDeleting(true)
    try {
      const response = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'delete_all' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete contacts')
      }

      toast({
        title: 'Success',
        description: 'All contacts deleted successfully',
      })

      // Refresh contacts list
      fetchContacts()
    } catch (error) {
      console.error('Error deleting all contacts:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete contacts',
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
      setShowDeleteAllDialog(false)
    }
  }

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

          case 'complete':
            eventSource.close()
            setScraping(false)
            setScrapingProgress(null)
            toast({
              title: 'Success!',
              description: `Added ${data.contactsAdded} contacts from ${data.postsScraped} posts`,
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

        // Provide more helpful error message
        let errorMessage = 'Connection to scraping service lost'

        // Check if it's a timeout issue (common on Vercel Hobby plan)
        if (error.target?.readyState === EventSource.CLOSED) {
          errorMessage = 'The scraping process is taking longer than expected. This may be due to server timeout limits. Please try again or contact support if the issue persists.'
        }

        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
          duration: 10000 // Show for longer
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

  // Filter contacts based on search and pipeline
  const filteredContacts = contacts.filter(contact => {
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const matchesSearch = (
        contact.name?.toLowerCase().includes(search) ||
        contact.subtitle?.toLowerCase().includes(search) ||
        contact.job_title?.toLowerCase().includes(search) ||
        contact.company?.toLowerCase().includes(search) ||
        contact.email?.toLowerCase().includes(search)
      )
      if (!matchesSearch) return false
    }

    // Apply pipeline filter
    if (selectedPipelineFilter && selectedPipelineFilter !== 'all') {
      const isInPipeline = pipelineContacts.some(
        pc => pc.contact_id === contact.id && pc.pipeline_id === selectedPipelineFilter
      )
      if (!isInPipeline) return false
    }

    return true
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
          onClick={() => setIsPipelineBuilderOpen(true)}
          variant="outline"
          size="lg"
        >
          <Workflow className="mr-2 h-4 w-4" />
          Pipeline Builder
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedPipelineFilter} onValueChange={setSelectedPipelineFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All Pipelines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pipelines</SelectItem>
                  {pipelines.map(pipeline => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {selectedContacts.length > 0 && (
                <Button
                  onClick={() => setIsAddToCampaignModalOpen(true)}
                  className="bg-[#fb2e01] hover:bg-[#e02a01]"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Add to Campaign ({selectedContacts.length})
                </Button>
              )}
              {contacts.length > 0 && (
                <>
                  <Button
                    onClick={handleExportCSV}
                    disabled={scraping || exporting}
                    variant="outline"
                  >
                    {exporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Export CSV
                  </Button>
                  <Button
                    onClick={() => setShowDeleteAllDialog(true)}
                    disabled={scraping || deleting}
                    variant="outline"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All
                  </Button>
                </>
              )}
              <Button
                onClick={() => document.getElementById('csv-import-input').click()}
                disabled={scraping || importing}
                variant="outline"
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import CSV
              </Button>
              <input
                id="csv-import-input"
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
              <Button
                onClick={() => setIsAddContactModalOpen(true)}
                disabled={scraping}
                variant="outline"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
              <Button
                onClick={handlePopulate}
                disabled={scraping}
                className="bg-[#fb2e01] hover:bg-[#e02a01]"
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
                    <TableHead className="w-[50px]">
                      <input
                        type="checkbox"
                        checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Subtitle</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Engagement Type</TableHead>
                    <TableHead>Source Post</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="hover:bg-muted/50"
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedContacts.includes(contact.id)}
                          onChange={(e) => handleSelectContact(contact.id, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell className="font-medium cursor-pointer" onClick={() => handleRowClick(contact)}>
                        {contact.name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground cursor-pointer" onClick={() => handleRowClick(contact)}>
                        {contact.subtitle || '-'}
                      </TableCell>
                      <TableCell className="cursor-pointer" onClick={() => handleRowClick(contact)}>{contact.job_title || '-'}</TableCell>
                      <TableCell className="cursor-pointer" onClick={() => handleRowClick(contact)}>{contact.company || '-'}</TableCell>
                      <TableCell className="cursor-pointer" onClick={() => handleRowClick(contact)}>
                        <div className="flex gap-1 flex-wrap">
                          {(contact.engagement_type || 'unknown').split(',').map((type, idx) => (
                            <span key={idx} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              type.trim() === 'like'
                                ? 'bg-blue-100 text-blue-700'
                                : type.trim() === 'comment'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {type.trim()}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact.post_url ? (
                          <a
                            href={contact.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
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
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="sm">
                              <Linkedin className="h-4 w-4" />
                            </Button>
                          </a>
                        ) : '-'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <PipelineAssignment
                          contactId={contact.id}
                          contactName={contact.name}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteContactId(contact.id)
                          }}
                          disabled={deleting}
                        >
                          <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete single contact confirmation */}
      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => !open && setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContact}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete all contacts confirmation */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Contacts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {contacts.length} contacts? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete All'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Modal */}
      <ProfileModal
        contact={selectedContact}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileEnriched={handleProfileEnriched}
      />

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={isAddContactModalOpen}
        onClose={() => setIsAddContactModalOpen(false)}
        onContactAdded={handleContactAdded}
      />

      {/* Pipeline Builder Modal */}
      <PipelineBuilder
        isOpen={isPipelineBuilderOpen}
        onClose={() => setIsPipelineBuilderOpen(false)}
        onPipelineCreated={() => {
          // Refresh pipelines when a new one is created
          fetchPipelines()
        }}
      />

      {/* Add to Campaign Modal */}
      <AddToCampaignModal
        isOpen={isAddToCampaignModalOpen}
        onClose={() => setIsAddToCampaignModalOpen(false)}
        selectedContactIds={selectedContacts}
        onSuccess={handleAddToCampaignSuccess}
      />
    </div>
  )
}
