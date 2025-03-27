import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { TwitterEmbed } from './TwitterEmbed';

export default function PostsList({ posts, onDeletePost }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto px-4">
      {posts.map((post) => (
        <Card key={post.id} className="relative overflow-hidden">
          {/* Header section with tag and delete button */}
          <div className="flex justify-between items-center p-4 pb-2">
            <Badge className="bg-[#FF4400] hover:bg-[#FF4400]/90">
              {post.tag}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDeletePost(post.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Description if available */}
          {post.description && (
            <div className="px-4 pb-2">
              <p className="text-sm text-gray-700">{post.description}</p>
            </div>
          )}
          
          {/* Tweet embed */}
          <CardContent className="pt-0">
            <TwitterEmbed tweetId={post.tweet_id} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 