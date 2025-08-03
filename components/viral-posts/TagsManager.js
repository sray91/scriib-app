import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function TagsManager({ isOpen, setIsOpen, tags, onAddTag, onDeleteTag }) {
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAddTag(newTag);
      setNewTag('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="border-[#FF4400] border-2 bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#FF4400] font-bebas-neue text-3xl">
            MANAGE TAGS
          </DialogTitle>
          <DialogDescription>
            Create and manage tags to organize your viral posts collection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="New tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
            />
            <Button onClick={handleAddTag} variant="outline">
              Add Tag
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label>Existing Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} className="flex items-center gap-1">
                  {tag}
                  <button
                    onClick={() => onDeleteTag(tag)}
                    className="ml-1 hover:text-[#FF4400]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 