"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar as List, Calendar, Plus } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PostTemplatesList from '@/components/post-forge/PostTemplatesList';
import ScheduledPostsList from '@/components/post-forge/ScheduledPostsList';
import PostEditorDialog from '@/components/post-forge/PostEditorDialog';
import WeeklyKanbanView from '@/components/post-forge/WeeklyKanbanView';

const supabase = createClientComponentClient();

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PostForge() {
  const { toast } = useToast();
  const [activeDay, setActiveDay] = useState(getCurrentDay());
  const [postTemplates, setPostTemplates] = useState([]);
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState('list');
  const [isNextWeek, setIsNextWeek] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isCreatingNewPost, setIsCreatingNewPost] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Get current day of the week
  function getCurrentDay() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = new Date();
    return days[today.getDay()];
  }

  // Get current user
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    }
    getUser();
  }, []);

  // Load post templates and scheduled posts
  useEffect(() => {
    fetchPostTemplates();
    fetchScheduledPosts();
  }, [activeDay, view, isNextWeek]);

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
      // Get the date range for the current week or next week
      const today = new Date();
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Calculate the start of the week (Monday)
      const startOfWeek = new Date(today);
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Adjust for Sunday
      startOfWeek.setDate(today.getDate() - daysFromMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      // If planning for next week, add 7 days
      if (isNextWeek) {
        startOfWeek.setDate(startOfWeek.getDate() + 7);
      }
      
      // Calculate the end of the week (Sunday)
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Fetch posts for the selected week's date range
      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .gte('scheduled_time', startOfWeek.toISOString())
        .lte('scheduled_time', endOfWeek.toISOString())
        .order('scheduled_time');
      
      if (error) throw error;
      
      // If no posts are found for the week, try fetching posts with only day_of_week
      if (!posts || posts.length === 0) {
        const { data: dayPosts, error: dayError } = await supabase
          .from('posts')
          .select('*')
          .order('scheduled_time');
          
        if (dayError) throw dayError;
        
        // Filter by view and date range
        if (view === 'kanban') {
          // For kanban view, filter posts to include only those from the current/next week
          setScheduledPosts(dayPosts.filter(post => {
            // Only include posts that have a day_of_week set
            if (!post.day_of_week) return false;
            
            // Convert the post's scheduled_time to a date
            const postDate = new Date(post.scheduled_time);
            
            // Check if this post is within the selected week
            return postDate >= startOfWeek && postDate <= endOfWeek;
          }) || []);
        } else {
          // For daily view, filter by the active day
          setScheduledPosts(dayPosts.filter(post => post.day_of_week === activeDay) || []);
        }
      } else {
        // Filter posts in JavaScript based on the view type
        if (view === 'kanban') {
          // For kanban view, include all posts within the date range
          setScheduledPosts(posts || []);
        } else {
          // For daily view, filter by the active day
          setScheduledPosts(posts.filter(post => post.day_of_week === activeDay) || []);
        }
      }
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
      // Check if user is authenticated
      if (!currentUser?.id) {
        toast({
          title: "Error",
          description: "You must be logged in to generate content",
          variant: "destructive",
        });
        return;
      }

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
              user_id: currentUser.id,
              content: template.description || `${day} - ${template.title}`,
              status: 'draft',
              scheduled_time: currentDayDate.toISOString(),
              day_of_week: day,
              template_id: template.id,
              platforms: {}
            });

          if (postError) {
            console.error('Error creating post:', postError);
            throw postError;
          }
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
        
        // If planning for next week, add 7 days
        if (isNextWeek) {
          targetDate.setDate(targetDate.getDate() + 7);
        }
        
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
      
      // If planning for next week, add 7 days
      if (isNextWeek) {
        targetDate.setDate(targetDate.getDate() + 7);
      }
      
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

  // Add this new function to handle post movement between days
  async function handleMovePost(postId, newDay) {
    try {
      // Find the post
      const post = scheduledPosts.find(p => p.id.toString() === postId);
      if (!post) return;
      
      // Get the date for the new day
      const today = new Date();
      const dayIndex = DAYS_OF_WEEK.indexOf(newDay);
      const targetDate = new Date(today);
      const diff = dayIndex - today.getDay() + (dayIndex < today.getDay() ? 7 : 0);
      targetDate.setDate(today.getDate() + diff);
      
      // If planning for next week, add 7 days
      if (isNextWeek) {
        targetDate.setDate(targetDate.getDate() + 7);
      }
      
      // Keep the same time, just change the date
      const currentTime = new Date(post.scheduled_time);
      targetDate.setHours(
        currentTime.getHours(),
        currentTime.getMinutes(),
        currentTime.getSeconds()
      );
      
      // Update the post
      const { error } = await supabase
        .from('posts')
        .update({
          day_of_week: newDay,
          scheduled_time: targetDate.toISOString()
        })
        .eq('id', post.id);
        
      if (error) throw error;
      
      // Refresh posts
      fetchScheduledPosts();
      
      toast({
        title: "Post moved",
        description: `Post moved to ${newDay}`,
      });
    } catch (error) {
      console.error('Error moving post:', error);
      toast({
        title: "Error",
        description: "Failed to move post",
        variant: "destructive",
      });
    }
  }

  // Add this function to handle post deletion
  async function handleDeletePost(postId) {
    try {
      // Confirm deletion
      if (!window.confirm("Are you sure you want to delete this post?")) {
        return;
      }
      
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
        
      if (error) throw error;
      
      // Refresh posts
      fetchScheduledPosts();
      
      toast({
        title: "Post deleted",
        description: "The post has been deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
    }
  }

  return (
    <>
      <style jsx global>{`
        .btn-primary {
          background-color: #fb2e01 !important;
          color: white !important;
        }
        .btn-primary:hover {
          background-color: #e02a01 !important;
        }
        .btn-secondary {
          background-color: #2563eb !important;
          color: white !important;
        }
        .btn-secondary:hover {
          background-color: #1d4ed8 !important;
        }
        .btn-success {
          background-color: #16a34a !important;
          color: white !important;
        }
        .btn-success:hover {
          background-color: #15803d !important;
        }
      `}</style>

      <div className="container max-w-7xl mx-auto p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold">Post Forge</h1>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <div className="flex items-center space-x-2">
              <Button
                variant={view === 'list' ? 'default' : 'outline'}
                size="sm"
                className={view === 'list' ? 'bg-slate-700 hover:bg-slate-800' : ''}
                onClick={() => {
                  setView('list');
                  setIsNextWeek(false);
                }}
              >
                <List className="h-4 w-4 mr-2" />
                Daily View
              </Button>
              <Button
                variant={view === 'kanban' && !isNextWeek ? 'default' : 'outline'}
                size="sm"
                className={view === 'kanban' && !isNextWeek ? 'bg-slate-700 hover:bg-slate-800' : ''}
                onClick={() => {
                  setView('kanban');
                  setIsNextWeek(false);
                }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Weekly View
              </Button>
              <Button
                variant={isNextWeek ? 'default' : 'outline'}
                size="sm"
                className={isNextWeek ? 'bg-blue-600 hover:bg-blue-700' : ''}
                onClick={() => {
                  setView('kanban');
                  setIsNextWeek(true);
                }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Next Week
              </Button>
            </div>
            <Button
              onClick={() => {
                setSelectedPost({
                  content: '',
                  platforms: {},
                  scheduledTime: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),
                  requiresApproval: false,
                  approverId: '',
                  mediaFiles: [],
                  day_of_week: activeDay
                });
                setIsCreatingNewPost(true);
                setIsPostEditorOpen(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" /> New Post
            </Button>
            <Button
              onClick={generateWeeklyContent}
              disabled={isGeneratingContent}
              className="bg-[#fb2e01] hover:bg-[#fb2e01]/90 text-white"
              size="sm"
            >
              {isGeneratingContent ? "Generating..." : "Generate Weekly Content"}
            </Button>
            <Link href="/post-forge/builder">
              <Button variant="outline" size="sm">
                Manage Post Templates
              </Button>
            </Link>
          </div>
        </div>

        {view === 'kanban' ? (
          <div>
            {isNextWeek && (
              <div className="bg-blue-50 p-3 rounded-md mb-4 flex items-center justify-between">
                <p className="text-blue-700 text-sm font-medium">
                  You&apos;re viewing next week&apos;s content plan (starting {new Date(new Date().setDate(new Date().getDate() + 7 - new Date().getDay() + 1)).toLocaleDateString()})
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNextWeek(false)}
                >
                  Back to Current Week
                </Button>
              </div>
            )}
            <WeeklyKanbanView
              posts={scheduledPosts}
              isNextWeek={isNextWeek}
              onCreatePost={(day) => {
                setActiveDay(day);
                handleCreatePost();
              }}
              onEditPost={handleEditPost}
              onMovePost={handleMovePost}
              onDeletePost={handleDeletePost}
            />
          </div>
        ) : (
          <Tabs value={activeDay} onValueChange={setActiveDay} className="space-y-6">
            <div className="overflow-x-auto pb-2">
              <TabsList className="w-full min-w-max justify-between">
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
            </div>

            {DAYS_OF_WEEK.map((day) => (
              <TabsContent key={day} value={day} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Post Templates Section */}
                  <PostTemplatesList 
                    day={day}
                    templates={postTemplates}
                    isLoading={isLoading}
                    onCreatePost={handleCreatePost}
                  />

                  {/* Scheduled Posts Section */}
                  <ScheduledPostsList
                    day={day}
                    posts={scheduledPosts}
                    onCreatePost={() => handleCreatePost()}
                    onEditPost={handleEditPost}
                    onDeletePost={handleDeletePost}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Post Editor Dialog */}
        <PostEditorDialog
          isOpen={isPostEditorOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsPostEditorOpen(false);
              fetchScheduledPosts(); // Refresh posts when dialog closes
            }
          }}
          post={selectedPost}
          isNew={isCreatingNewPost}
          onSave={() => {
            fetchScheduledPosts();
            setIsPostEditorOpen(false);
          }}
          onClose={() => setIsPostEditorOpen(false)}
          onDelete={(postId) => {
            handleDeletePost(postId);
            setIsPostEditorOpen(false);
          }}
        />
      </div>
    </>
  );
} 