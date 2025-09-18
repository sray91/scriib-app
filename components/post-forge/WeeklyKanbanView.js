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
        <div className="flex justify-between items-center mb-6 p-4 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={showPrevDay}
            disabled={visibleDayIndex === 0}
            className="h-10 w-10 p-0 rounded-full bg-gray-50 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <h3 className="font-semibold text-gray-900 text-lg">{DAYS_OF_WEEK[visibleDayIndex]}</h3>
            <p className="text-sm text-gray-500 mt-1">Swipe or use arrows to navigate</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={showNextDay}
            disabled={visibleDayIndex === DAYS_OF_WEEK.length - 1}
            className="h-10 w-10 p-0 rounded-full bg-gray-50 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={`${
          isMobile
            ? 'grid grid-cols-1 gap-4'
            : 'flex gap-4 min-w-max overflow-x-auto'
        }`}>
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
              <div key={day} className={`flex flex-col h-full ${isMobile ? 'w-full' : 'w-80 flex-shrink-0'}`}>
                {/* Day Header */}
                <div className="mb-3 p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100/50 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">{day}</h3>
                      <span className="text-xs text-gray-500 font-medium">{getDateForDay()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Post count */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-xs font-semibold text-gray-700">{dayPosts.length}</span>
                        </div>
                      </div>
                      
                      {/* Pending approval indicator */}
                      {pendingApprovalPosts.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          <span className="text-xs font-medium text-amber-700">
                            {pendingApprovalPosts.length} pending
                          </span>
                        </div>
                      )}
                      
                      {/* Add post button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-full bg-gray-50 hover:bg-gray-100 border-0"
                        onClick={() => onCreatePost(day)}
                      >
                        <Plus size={16} className="text-gray-600" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Posts Column */}
                <Droppable droppableId={day}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`flex-1 p-2 rounded-xl transition-all duration-300 ${isMobile ? 'min-h-[50vh]' : 'min-h-[60vh]'} max-h-[70vh] overflow-y-auto ${
                        snapshot.isDraggingOver
                          ? 'bg-blue-50/70 backdrop-blur-sm border-2 border-blue-200 border-dashed'
                          : 'bg-gray-50/30'
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
                              className="mb-4"
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
                        <div className="flex items-center justify-center h-40 rounded-xl border-2 border-dashed border-gray-200 bg-white/30 hover:bg-white/50 transition-all duration-200">
                          <Button
                            variant="ghost"
                            className="flex flex-col items-center gap-2 text-gray-400 hover:text-gray-600 p-4 rounded-xl hover:bg-white/70 transition-all duration-200"
                            onClick={() => onCreatePost(day)}
                          >
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <Plus size={18} />
                            </div>
                            <div className="text-center">
                              <div className="font-medium text-sm">Add Post</div>
                              <div className="text-xs text-gray-400 mt-1">Create content for {day}</div>
                            </div>
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