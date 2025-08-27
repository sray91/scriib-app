import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

// Import our new components
import UserTabs from './UserTabs';
import TemplatesColumn from './TemplatesColumn';
import WeeklyKanbanView from './WeeklyKanbanView';
import PostEditorDialog from './PostEditorDialog';

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function KanbanBoard() {
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  // User state
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // View state
  const [isNextWeek, setIsNextWeek] = useState(false);
  
  // Posts and templates state
  const [posts, setPosts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Post editor state
  const [selectedPost, setSelectedPost] = useState(null);
  const [isPostEditorOpen, setIsPostEditorOpen] = useState(false);
  const [isCreatingNewPost, setIsCreatingNewPost] = useState(false);
  
  // Content generation state
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);

  // Initialize user on component mount
  useEffect(() => {
    async function getUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    }
    getUser();
  }, []);

  // Load posts when user or view changes
  useEffect(() => {
    if (selectedUser) {
      fetchPosts();
    }
  }, [selectedUser, isNextWeek]);

  // Fetch posts for selected user
  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      
      // Get the date range for the current week or next week
      const today = new Date();
      
      // Calculate the start of the week (Monday) - use consistent logic with getDateForDay
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      const adjustedTodayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday-first system
      const diff = 0 - adjustedTodayIndex; // Days to go back to Monday
      startOfWeek.setDate(today.getDate() + diff);
      startOfWeek.setHours(0, 0, 0, 0);
      
      // If planning for next week, add 7 days
      if (isNextWeek) {
        startOfWeek.setDate(startOfWeek.getDate() + 7);
      }
      
      // Calculate the end of the week (Sunday)
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      console.log('Debug - Date range:', {
        today: today.toISOString(),
        startOfWeek: startOfWeek.toISOString(),
        endOfWeek: endOfWeek.toISOString(),
        isNextWeek,
        selectedUser: selectedUser?.id
      });

      // Fetch posts for the selected user and date range
      // First, get posts with scheduled_time in the current week (excluding archived posts)
      const { data: scheduledPosts, error: scheduledError } = await supabase
        .from('posts')
        .select('*')
        .or(`user_id.eq."${selectedUser.id}",approver_id.eq."${selectedUser.id}",ghostwriter_id.eq."${selectedUser.id}"`)
        .eq('archived', false)
        .gte('scheduled_time', startOfWeek.toISOString())
        .lte('scheduled_time', endOfWeek.toISOString())
        .order('scheduled_time');
      
      if (scheduledError) throw scheduledError;
      
      console.log('Debug - Scheduled posts found:', scheduledPosts?.length || 0);
      console.log('Debug - Scheduled posts:', scheduledPosts);
      
      // Second, get posts that are pending approval for this user and within the current week (excluding archived posts)
      const { data: pendingPosts, error: pendingError } = await supabase
        .from('posts')
        .select('*')
        .or(`user_id.eq."${selectedUser.id}",approver_id.eq."${selectedUser.id}",ghostwriter_id.eq."${selectedUser.id}"`)
        .eq('status', 'pending_approval')
        .eq('archived', false)
        .gte('scheduled_time', startOfWeek.toISOString())
        .lte('scheduled_time', endOfWeek.toISOString())
        .order('created_at');
      
      if (pendingError) throw pendingError;
      
      console.log('Debug - Pending posts found:', pendingPosts?.length || 0);
      console.log('Debug - Pending posts:', pendingPosts);
      
      // Combine and deduplicate posts
      const allPosts = [...(scheduledPosts || []), ...(pendingPosts || [])];
      const uniquePosts = allPosts.filter((post, index, self) => 
        index === self.findIndex(p => p.id === post.id)
      );
      
      // Transform posts to include day_of_week and user info
      const transformedPosts = uniquePosts.map(post => {
        let day_of_week;
        if (post.scheduled_time) {
          day_of_week = getDayOfWeek(post.scheduled_time);
        } else if (post.status === 'pending_approval') {
          // For pending approval posts, assign to their scheduled day if they have one, otherwise current day
          day_of_week = post.scheduled_time ? getDayOfWeek(post.scheduled_time) : getCurrentDay();
        } else {
          day_of_week = 'Unassigned';
        }
        
        return {
          ...post,
          day_of_week,
          creator_name: selectedUser.name // We'll enhance this later with proper user lookup
        };
      });
      
      setPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get day of week from date
  const getDayOfWeek = (dateString) => {
    const date = new Date(dateString);
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    // Convert JavaScript's 0-6 (Sunday-Saturday) to our 0-6 (Monday-Sunday) format
    const dayIndex = date.getDay();
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Sunday becomes 6, Monday becomes 0, etc.
    return days[adjustedIndex];
  };

  // Handle user selection change
  const handleUserChange = (user) => {
    setSelectedUser(user);
  };

  // Handle post creation
  const handleCreatePost = (templateId = null, day = null) => {
    let newPost = {
      content: '',
      platforms: {},
      scheduledTime: new Date().toISOString(),
      requiresApproval: false,
      approverId: '',
      mediaFiles: [],
      day_of_week: day || getCurrentDay()
    };

    // If creating from template
    if (templateId) {
      // We'll implement template-to-post logic here
      // For now, just set the day
      newPost.day_of_week = day || getCurrentDay();
    }

    // If creating for a specific day
    if (day) {
      const targetDate = getDateForDay(day);
      targetDate.setHours(12, 0, 0, 0);
      newPost.scheduledTime = targetDate.toISOString();
      newPost.day_of_week = day;
    }

    setSelectedPost(newPost);
    setIsCreatingNewPost(true);
    setIsPostEditorOpen(true);
  };

  // Handle post editing
  const handleEditPost = (post) => {
    setSelectedPost(post);
    setIsCreatingNewPost(false);
    setIsPostEditorOpen(true);
  };

  // Handle post deletion
  const handleDeletePost = async (postId) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post deleted successfully",
      });
      
      fetchPosts(); // Refresh posts
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
    }
  };

  // Handle post archiving
  const handleArchivePost = async (postId, archived = true) => {
    try {
      const response = await fetch('/api/posts/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: postId, archived }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to archive post');
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: result.message,
      });
      
      fetchPosts(); // Refresh posts
    } catch (error) {
      console.error('Error archiving post:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to archive post",
        variant: "destructive",
      });
    }
  };

  // Handle post save
  const handlePostSave = () => {
    fetchPosts();
    setIsPostEditorOpen(false);
  };

  // Handle post move (drag and drop)
  const handleMovePost = async (postId, newDay) => {
    try {
      const targetDate = getDateForDay(newDay);
      const post = posts.find(p => p.id === postId);
      
      if (post) {
        // Keep the same time, just change the day
        const currentTime = new Date(post.scheduled_time);
        targetDate.setHours(currentTime.getHours(), currentTime.getMinutes(), 0, 0);
        
        const { error } = await supabase
          .from('posts')
          .update({ 
            scheduled_time: targetDate.toISOString(),
            day_of_week: newDay
          })
          .eq('id', postId);

        if (error) throw error;
        
        fetchPosts(); // Refresh posts
      }
    } catch (error) {
      console.error('Error moving post:', error);
      toast({
        title: "Error",
        description: "Failed to move post",
        variant: "destructive",
      });
    }
  };

  // Handle template usage
  const handleUseTemplate = (templateId, day) => {
    handleCreatePost(templateId, day);
  };

  // Handle template management
  const handleManageTemplates = () => {
    router.push('/post-forge/builder');
  };

  // Generate weekly content
  const generateWeeklyContent = async () => {
    try {
      setIsGeneratingContent(true);
      
      toast({
        title: "Generating Content",
        description: "Creating posts for the entire week...",
      });

      // Get the user to use for post creation
      const userToUse = selectedUser || currentUser;
      
      // Fetch all templates for the selected user
      const { data: templates, error: templatesError } = await supabase
        .from('user_time_blocks')
        .select(`
          id,
          title,
          description,
          day,
          user_id,
          user_tasks (
            id,
            text
          )
        `)
        .eq('user_id', userToUse.id)
        .order('day', { ascending: true });

      if (templatesError) {
        console.error('Error fetching templates:', templatesError);
        throw templatesError;
      }

      if (!templates || templates.length === 0) {
        toast({
          title: "No Templates Found",
          description: "Please create some templates first to generate weekly content.",
          variant: "destructive",
        });
        return;
      }

      // Create posts from templates
      const createdPosts = [];
      
      for (const template of templates) {
        // Build post content from template
        let postContent = `${template.title}\n\n`;
        
        if (template.description) {
          postContent += `${template.description}\n\n`;
        }
        
        // Add content ideas if available
        if (template.user_tasks && template.user_tasks.length > 0) {
          postContent += template.user_tasks.map(task => `• ${task.text}`).join('\n');
        }
        
        // Calculate scheduled time for this day
        const targetDate = getDateForDay(template.day);
        targetDate.setHours(12, 0, 0, 0); // Set to noon
        
        // Create the post
        const postData = {
          content: postContent,
          scheduled_time: targetDate.toISOString(),
          day_of_week: template.day,
          template_id: template.id,
          status: 'draft',
          user_id: userToUse.id,
          platforms: {},
          scheduled: false,
          approver_id: null,
          ghostwriter_id: null,
          created_at: new Date().toISOString()
        };
        
        const { data: newPost, error: postError } = await supabase
          .from('posts')
          .insert(postData)
          .select()
          .single();
          
        if (postError) {
          console.error('Error creating post from template:', postError);
          continue; // Skip this template and continue with others
        }
        
        createdPosts.push(newPost);
      }
      
      if (createdPosts.length === 0) {
        toast({
          title: "No Posts Created",
          description: "Failed to create posts from templates. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Success",
        description: `Created ${createdPosts.length} posts from ${templates.length} templates`,
      });
      
      fetchPosts(); // Refresh posts to show new content
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
  };

  // Helper functions
  const getCurrentDay = () => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const dayIndex = new Date().getDay();
    const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Sunday becomes 6, Monday becomes 0, etc.
    return days[adjustedIndex];
  };

  const getDateForDay = (dayName) => {
    const today = new Date();
    const dayIndex = DAYS_OF_WEEK.indexOf(dayName);
    
    // Get the start of the current week (Monday)
    const startOfWeek = new Date(today);
    const todayDayIndex = today.getDay();
    const adjustedTodayIndex = todayDayIndex === 0 ? 6 : todayDayIndex - 1;
    const daysToMonday = -adjustedTodayIndex;
    startOfWeek.setDate(today.getDate() + daysToMonday);
    
    // Calculate target date from start of week
    const targetDate = new Date(startOfWeek);
    targetDate.setDate(startOfWeek.getDate() + dayIndex);
    
    if (isNextWeek) {
      targetDate.setDate(targetDate.getDate() + 7);
    }
    
    return targetDate;
  };

  const getWeekLabel = () => {
    const startDate = getDateForDay('Monday');
    const endDate = getDateForDay('Sunday');
    
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Post Forge</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant={!isNextWeek ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsNextWeek(false)}
              >
                This Week
              </Button>
              <Button
                variant={isNextWeek ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsNextWeek(true)}
              >
                Next Week
              </Button>
            </div>
            
            {/* Action Buttons */}
            <Button
              onClick={() => handleCreatePost()}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Post
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
                <Settings className="h-4 w-4 mr-2" />
                Manage Templates
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Week indicator */}
        <div className="mt-3 text-sm text-gray-600">
          <span className="font-medium">
            {isNextWeek ? 'Next Week' : 'This Week'}: {getWeekLabel()}
          </span>
          {posts.filter(post => post.status === 'pending_approval').length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                ⚠️ {posts.filter(post => post.status === 'pending_approval').length} posts pending approval
              </span>
            </div>
          )}
        </div>
      </div>

      {/* User Tabs */}
      <UserTabs
        selectedUser={selectedUser}
        onUserChange={handleUserChange}
        currentUser={currentUser}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Templates Sidebar */}
        <TemplatesColumn
          selectedUser={selectedUser}
          onUseTemplate={handleUseTemplate}
          onManageTemplates={handleManageTemplates}
          currentUser={currentUser}
        />

        {/* Main Board */}
        <div className="flex-1 overflow-auto p-4">
                    <WeeklyKanbanView 
            posts={posts}
            isNextWeek={isNextWeek}
            onCreatePost={handleCreatePost}
            onEditPost={handleEditPost}
            onMovePost={handleMovePost}
            onDeletePost={handleDeletePost}
            onArchive={handleArchivePost}
            currentUser={currentUser}
          />
        </div>
      </div>

      {/* Post Editor Dialog */}
      <PostEditorDialog
        isOpen={isPostEditorOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsPostEditorOpen(false);
          }
        }}
        post={selectedPost}
        isNew={isCreatingNewPost}
        onSave={handlePostSave}
        onClose={() => setIsPostEditorOpen(false)}
        onDelete={(postId) => {
          handleDeletePost(postId);
          setIsPostEditorOpen(false);
        }}
      />
    </div>
  );
} 