import { Plus, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ScheduledPostsList({ day, posts, onCreatePost, onEditPost, onDeletePost }) {
  // Filter posts for the specific day
  const filteredPosts = posts.filter(post => post.day_of_week === day);
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Scheduled Posts</h2>
      </div>
      
      {filteredPosts.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <p className="text-gray-500">No posts scheduled for {day}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <Card 
              key={post.id} 
              className="relative hover:border-gray-400 transition-colors group"
            >
              <div 
                className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePost(post.id);
                }}
              >
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-gray-500 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div 
                className="cursor-pointer"
                onClick={() => onEditPost(post)}
              >
                <CardHeader className="pb-2 pr-10">
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 