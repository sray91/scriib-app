import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';
import PostCard from './PostCard';

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeeklyKanbanView({ 
  posts, 
  isNextWeek = false,
  onCreatePost, 
  onEditPost,
  onMovePost,
  onDeletePost,
  onArchive,
  currentUser
}) {
  // For mobile view, we'll show only a subset of days
  const [visibleDayIndex, setVisibleDayIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Navigate days on mobile
  const showNextDay = () => {
    setVisibleDayIndex(prev => Math.min(prev + 1, DAYS_OF_WEEK.length - 1));
  };

  const showPrevDay = () => {
    setVisibleDayIndex(prev => Math.max(prev - 1, 0));
  };

  // Handle drag end event
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { source, destination } = result;
    
    // If dropped in a different column (day)
    if (source.droppableId !== destination.droppableId) {
      const postId = result.draggableId;
      const newDay = destination.droppableId;
      
      // Call the parent handler to update the post's day
      onMovePost(postId, newDay);
    }
  };

  // Determine which days to show based on screen size
  const visibleDays = isMobile 
    ? [DAYS_OF_WEEK[visibleDayIndex]] 
    : DAYS_OF_WEEK;

  return (
    <div className="mt-6">
      {/* Mobile navigation controls */}
      {isMobile && (
        <div className="flex justify-between items-center mb-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={showPrevDay}
            disabled={visibleDayIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-medium">{DAYS_OF_WEEK[visibleDayIndex]}</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={showNextDay}
            disabled={visibleDayIndex === DAYS_OF_WEEK.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-7'} gap-4`}>
          {visibleDays.map((day) => {
            const dayPosts = posts.filter(post => post.day_of_week === day);
            const pendingApprovalPosts = dayPosts.filter(post => post.status === 'pending_approval');
            const getDateForDay = () => {
              const today = new Date();
              const dayIndex = DAYS_OF_WEEK.indexOf(day);
              
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
              
              return targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            };

            return (
              <div key={day} className="flex flex-col h-full">
                {/* Day Header */}
                <div className="flex justify-between items-center mb-3 px-3 py-2 bg-white rounded-lg border">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-gray-900">{day}</h3>
                    <span className="text-xs text-gray-500">{getDateForDay()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {dayPosts.length}
                    </Badge>
                    {pendingApprovalPosts.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {pendingApprovalPosts.length} pending
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => onCreatePost(day)}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
                
                {/* Posts Column */}
                <Droppable droppableId={day}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 p-2 rounded-md ${isMobile ? 'min-h-[50vh]' : 'min-h-[60vh]'} max-h-[80vh] overflow-y-auto transition-colors ${
                        snapshot.isDraggingOver ? 'bg-blue-50' : 'bg-gray-50'
                      }`}
                    >
                      {dayPosts.map((post, index) => (
                        <Draggable 
                          key={post.id} 
                          draggableId={post.id.toString()} 
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="mb-3"
                            >
                              <PostCard
                                post={post}
                                onEdit={onEditPost}
                                onDelete={onDeletePost}
                                onArchive={onArchive}
                                onDuplicate={(post) => onCreatePost(day, post.id)}
                                isDragging={snapshot.isDragging}
                                currentUser={currentUser}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {/* Add Post Button for empty columns */}
                      {dayPosts.length === 0 && (
                        <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg">
                          <Button
                            variant="ghost"
                            className="flex flex-col items-center gap-2 text-gray-500 hover:text-gray-700"
                            onClick={() => onCreatePost(day)}
                          >
                            <Plus size={24} />
                            <span className="text-sm">Add Post</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
} 