import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AddPostDialog({ isOpen, setIsOpen, onAddPost, tags }) {
  const [newPost, setNewPost] = useState({ url: '', description: '', tag: '' });

  const handleSubmit = () => {
    onAddPost(newPost);
    setNewPost({ url: '', description: '', tag: '' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#FF4400] hover:bg-[#FF4400]/90 mt-2 md:mt-0 w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Add New X Post
        </Button>
      </DialogTrigger>
      <DialogContent className="border-[#FF4400] border-2 bg-white">
        <DialogHeader>
          <DialogTitle className="text-[#FF4400] font-bebas-neue text-3xl">
            ADD NEW X POST
          </DialogTitle>
          <DialogDescription>
            Add a new X (Twitter) post to your viral posts collection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <Label htmlFor="url">X POST URL</Label>
          <Input
            id="url"
            placeholder="Enter X post URL"
            value={newPost.url}
            onChange={(e) => setNewPost({ ...newPost, url: e.target.value })}
          />
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            placeholder="Add a description (optional)"
            value={newPost.description}
            onChange={(e) => setNewPost({ ...newPost, description: e.target.value })}
          />
          <Label htmlFor="tag">Tag</Label>
          <Select value={newPost.tag} onValueChange={(value) => setNewPost({ ...newPost, tag: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select a tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="untagged">Untagged</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSubmit} className="w-full bg-[#FF4400] hover:bg-[#FF4400]/90">
            ADD X POST
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 