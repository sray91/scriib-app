import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PostsFilter({ 
  selectedTag, 
  setSelectedTag, 
  tags, 
  onManageTags, 
  onShareTag 
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectedTag} onValueChange={setSelectedTag}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tags</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {tag}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button 
        variant="outline" 
        onClick={onManageTags}
      >
        Manage Tags
      </Button>

      <Button
        variant="outline"
        onClick={() => onShareTag(selectedTag)}
        className="flex items-center gap-2"
      >
        <Share2 className="h-4 w-4" />
        Share {selectedTag} posts
      </Button>
    </div>
  );
} 