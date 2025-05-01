import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeeklyKanbanView({ 
  posts, 
  onCreatePost, 
  onEditPost,
  onMovePost,
  onDeletePost
}) {
  // For mobile view, we'll show only a subset of days
  const [visibleDayIndex, setVisibleDayIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile
  useState(() => {
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
          {visibleDays.map((day) => (
            <div key={day} className="flex flex-col h-full">
              {!isMobile && (
                <div className="flex justify-between items-center mb-2 px-2">
                  <h3 className="font-medium">{day}</h3>
                </div>
              )}
              
              <Droppable droppableId={day}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`flex-1 p-2 rounded-md ${isMobile ? 'min-h-[60vh]' : 'min-h-[70vh]'} overflow-y-auto ${
                      snapshot.isDraggingOver ? 'bg-gray-100' : 'bg-gray-50'
                    }`}
                  >
                    {posts
                      .filter(post => post.day_of_week === day)
                      .map((post, index) => (
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
                              className={`mb-2 relative ${snapshot.isDragging ? 'opacity-70' : ''}`}
                            >
                              <Card className="relative group">
                                <div 
                                  className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onDeletePost(post.id);
                                  }}
                                >
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-gray-500 hover:text-red-500 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div 
                                  className="cursor-pointer"
                                  onClick={() => onEditPost(post)}
                                >
                                  <CardHeader className="py-2 px-3 pr-8">
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
                                  <CardContent className="py-2 px-3">
                                    <p className="line-clamp-3 text-sm">{post.content}</p>
                                  </CardContent>
                                </div>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
} 