"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar as CalendarIcon, Plus, Grid, List, ArrowRight } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import PostEditor from '@/components/PostEditor';

const supabase = createClientComponentClient();

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PostForge() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeDay, setActiveDay] = useState(getCurrentDay());
  const [postTemplates, setPostTemplates] = useState([]);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState('list');
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isCreatingNewPost, setIsCreatingNewPost] = useState(false);

  // Get current day of the week
  function getCurrentDay() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    return days[today.getDay()];
  }

  // Load post templates and scheduled posts
  useEffect(() => {
    fetchPostTemplates();
    fetchScheduledPosts();
  }, [activeDay]);

  async function fetchPostTemplates() {
    try {
      setIsLoading(true);
      const { data: templates, error } = await supabase
        .from('user_time_blocks')
        .select(`
          id,
          title,
          description,
          day,
          user_tasks (
            id,
            text
          )
        `)
        .eq('day', activeDay)
        .order('created_at');

      if (error) throw error;
      setPostTemplates(templates || []);
    } catch (error) {
      console.error('Error fetching post templates:', error);
      toast({
        title: "Error",
        description: "Failed to load post templates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchScheduledPosts() {
    try {
      // Get the date range for the current week
      const today = new Date();
      const dayOfWeek = DAYS_OF_WEEK.indexOf(activeDay);
      const currentDayDate = new Date(today);
      
      // Adjust to get the date for the selected day
      const diff = dayOfWeek - today.getDay();
      currentDayDate.setDate(today.getDate() + diff);
      
      // Format as YYYY-MM-DD
      const formattedDate = currentDayDate.toISOString().split('T')[0];

      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('day_of_week', activeDay)
        .gte('scheduled_time', `${formattedDate}T00:00:00`)
        .lte('scheduled_time', `${formattedDate}T23:59:59`)
        .order('scheduled_time');

      if (error) throw error;
      setScheduledPosts(posts || []);
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
      toast({
        title: "Error",
        description: "Failed to load scheduled posts",
        variant: "destructive",
      });
    }
  }

  async function generateWeeklyContent() {
    try {
      setIsGeneratingContent(true);
      toast({
        title: "Generating Content",
        description: "Creating posts for the entire week...",
      });

      // For each day of the week
      for (const day of DAYS_OF_WEEK) {
        // Fetch templates for this day
        const { data: templates, error: templatesError } = await supabase
          .from('user_time_blocks')
          .select(`
            id,
            title,
            description,
            day,
            user_tasks (
              id,
              text
            )
          `)
          .eq('day', day);

        if (templatesError) throw templatesError;
        
        if (!templates || templates.length === 0) continue;

        // Get the date for this day in the current week
        const today = new Date();
        const dayIndex = DAYS_OF_WEEK.indexOf(day);
        const currentDayDate = new Date(today);
        const diff = dayIndex - today.getDay() + (dayIndex < today.getDay() ? 7 : 0);
        currentDayDate.setDate(today.getDate() + diff);
        
        // For each template, create a draft post
        for (const template of templates) {
          // Set scheduled time to noon on the target day
          currentDayDate.setHours(12, 0, 0, 0);
          
          const { error: postError } = await supabase
            .from('posts')
            .insert({
              content: template.description || `${day} - ${template.title}`,
              status: 'draft',
              scheduled_time: currentDayDate.toISOString(),
              day_of_week: day,
              template_id: template.id,
              platforms: {}
            });

          if (postError) throw postError;
        }
      }

      toast({
        title: "Success",
        description: "Weekly content generated successfully!",
      });
      
      // Refresh the current day's posts
      fetchScheduledPosts();
    } catch (error) {
      console.error('Error generating weekly content:', error);
      toast({
        title: "Error",
        description: "Failed to generate weekly content",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingContent(false);
    }
  }

  function handleCreatePost(templateId = null) {
    // Create a new post based on template if provided
    if (templateId) {
      const template = postTemplates.find(t => t.id === templateId);
      if (template) {
        // Get the date for the active day in the current week
        const today = new Date();
        const dayIndex = DAYS_OF_WEEK.indexOf(activeDay);
        const targetDate = new Date(today);
        const diff = dayIndex - today.getDay() + (dayIndex < today.getDay() ? 7 : 0);
        targetDate.setDate(today.getDate() + diff);
        targetDate.setHours(12, 0, 0, 0);

        setSelectedPost({
          content: template.description || '',
          platforms: {},
          scheduledTime: targetDate.toISOString(),
          requiresApproval: false,
          approverId: '',
          mediaFiles: [],
          template_id: templateId,
          day_of_week: activeDay
        });
      }
    } else {
      // Create an empty new post for the current day
      const today = new Date();
      const dayIndex = DAYS_OF_WEEK.indexOf(activeDay);
      const targetDate = new Date(today);
      const diff = dayIndex - today.getDay() + (dayIndex < today.getDay() ? 7 : 0);
      targetDate.setDate(today.getDate() + diff);
      targetDate.setHours(12, 0, 0, 0);

      setSelectedPost({
        content: '',
        platforms: {},
        scheduledTime: targetDate.toISOString(),
        requiresApproval: false,
        approverId: '',
        mediaFiles: [],
        day_of_week: activeDay
      });
    }
    
    setIsCreatingNewPost(true);
    setIsPostEditorOpen(true);
  }

  function handleEditPost(post) {
    setSelectedPost(post);
    setIsCreatingNewPost(false);
    setIsPostEditorOpen(true);
  }

  return (
    <div className="container max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Post Forge</h1>
        <div className="flex gap-4">
          <div className="flex items-center space-x-2">
            <Button
              variant={view === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={generateWeeklyContent}
            disabled={isGeneratingContent}
            className="bg-[#fb2e01] hover:bg-[#fb2e01]/90"
          >
            {isGeneratingContent ? "Generating..." : "Generate Weekly Content"}
          </Button>
          <Link href="/post-forge/builder">
            <Button variant="outline">
              Manage Post Templates
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={activeDay} onValueChange={setActiveDay} className="space-y-6">
        <TabsList className="w-full justify-between">
          {DAYS_OF_WEEK.map((day) => (
            <TabsTrigger 
              key={day} 
              value={day}
              className="flex-1"
            >
              {day}
            </TabsTrigger>
          ))}
        </TabsList>

        {DAYS_OF_WEEK.map((day) => (
          <TabsContent key={day} value={day} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Post Templates Section */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Post Templates</h2>
                </div>
                
                {isLoading ? (
                  <p>Loading templates...</p>
                ) : postTemplates.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg">
                    <p className="text-gray-500 mb-4">No post templates for {day}</p>
                    <Link href="/post-forge/builder">
                      <Button variant="outline">
                        Create Templates
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {postTemplates.map((template) => (
                      <Card key={template.id} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{template.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-500 mb-4">{template.description}</p>
                          {template.user_tasks && template.user_tasks.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium">Content Ideas:</h4>
                              <ul className="list-disc pl-5 text-sm">
                                {template.user_tasks.map((task) => (
                                  <li key={task.id}>{task.text}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <Button 
                            className="mt-4 w-full"
                            onClick={() => handleCreatePost(template.id)}
                          >
                            Create Post <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Scheduled Posts Section */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Scheduled Posts</h2>
                  <Button 
                    size="sm"
                    onClick={() => handleCreatePost()}
                  >
                    <Plus className="mr-2 h-4 w-4" /> New Post
                  </Button>
                </div>
                
                {scheduledPosts.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg">
                    <p className="text-gray-500">No posts scheduled for {day}</p>
                    <Button 
                      className="mt-4"
                      onClick={() => handleCreatePost()}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Create Post
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scheduledPosts.map((post) => (
                      <Card 
                        key={post.id} 
                        className="cursor-pointer hover:border-gray-400 transition-colors"
                        onClick={() => handleEditPost(post)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-center">
                            <Badge className={`
                              ${post.status === 'draft' ? 'bg-gray-100 text-gray-800' : ''}
                              ${post.status === 'scheduled' ? 'bg-blue-100 text-blue-800' : ''}
                              ${post.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' : ''}
                              ${post.status === 'published' ? 'bg-green-100 text-green-800' : ''}
                              ${post.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                            `}>
                              {post.status.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(post.scheduled_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="line-clamp-3">{post.content}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Post Editor Dialog */}
      <Dialog open={isPostEditorOpen} onOpenChange={(open) => {
        if (!open) {
          setIsPostEditorOpen(false);
          fetchScheduledPosts(); // Refresh posts when dialog closes
        }
      }}>
        <DialogContent className="max-w-6xl h-[80vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>
              {isCreatingNewPost ? "Create New Post" : "Edit Post"}
            </DialogTitle>
          </DialogHeader>
          
          <PostEditor 
            post={selectedPost}
            isNew={isCreatingNewPost}
            onSave={() => {
              fetchScheduledPosts();
              setIsPostEditorOpen(false);
            }}
            onClose={() => setIsPostEditorOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
} 