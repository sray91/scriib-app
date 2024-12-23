'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Share2, X } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const POSTS_PER_PAGE = 6;

export const TwitterEmbed = ({ tweetId }) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [tweetId]);

  return (
    <div className="twitter-embed">
      <blockquote className="twitter-tweet" data-dnt="true">
        <a href={`https://twitter.com/x/status/${tweetId}`}></a>
      </blockquote>
    </div>
  );
};

export default function ViralPostSwipeFile() {
  const supabase = createClientComponentClient();
  const session = useSession();
  const { toast } = useToast();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ url: '', description: '', tag: '' });
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('all');
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);

  const fetchPosts = async () => {
    if (!supabase?.from) {
      console.error('Supabase client not properly initialized');
      toast({ 
        title: "Error", 
        description: "Database connection error. Please try again later.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reference_posts')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
        toast({ title: 'Error', description: 'Failed to fetch posts.', variant: 'destructive' });
      } else {
        setPosts(data);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  const fetchTags = async () => {
    if (!supabase?.from || !session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', session.user.id);

      if (error) {
        console.error('Error fetching tags:', error);
        toast({ 
          title: 'Error', 
          description: 'Failed to fetch tags.', 
          variant: 'destructive' 
        });
      } else {
        setTags(data.map(tag => tag.name)); // Assuming tag table has 'name' field
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  };

  useEffect(() => {
    if (session) {
      fetchPosts();
      fetchTags();
    }
  }, [session]);

  const handleAddPost = async () => {
    if (!supabase?.from) {
      console.error('Supabase client not properly initialized');
      toast({ 
        title: "Error", 
        description: "Database connection error. Please try again later.", 
        variant: "destructive" 
      });
      return;
    }

    if (!newPost.url) {
      toast({ title: "Error", description: "Please enter a valid X post URL", variant: "destructive" });
      return;
    }

    const tweetIdMatch = newPost.url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (!tweetIdMatch) {
      toast({
        title: "Error",
        description: "Invalid X post URL. Please use a valid twitter.com or x.com status URL.",
        variant: "destructive",
      });
      return;
    }

    const tweetId = tweetIdMatch[1];
    const newPostObj = {
      user_id: session?.user?.id || null,
      description: newPost.description,
      tweet_id: tweetId,
      tag: newPost.tag || 'untagged',
    };

    try {
      const { error: insertError } = await supabase
        .from('reference_posts')
        .insert([newPostObj]);

      if (insertError) {
        console.error('Supabase Insertion Error:', insertError);
        throw insertError;
      }

      await fetchPosts();
      setNewPost({ url: '', description: '', tag: '' });
      setIsDialogOpen(false);
      toast({ title: 'Success', description: 'X post added successfully!' });
    } catch (error) {
      console.error('Error in handleAddPost:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to add post to the database.', 
        variant: 'destructive' 
      });
    }
  };

  const handleAddTag = async () => {
    if (!newTag || !session?.user?.id) return;
    if (tags.includes(newTag)) {
      toast({ title: 'Error', description: 'Tag already exists', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('tags')
        .insert([{ 
          name: newTag,
          user_id: session.user.id 
        }]);

      if (error) throw error;

      setTags(prev => [...prev, newTag]);
      setNewTag('');
      toast({ title: 'Success', description: 'Tag added successfully' });
    } catch (error) {
      console.error('Error adding tag:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to add tag', 
        variant: 'destructive' 
      });
    }
  };

  const handleDeletePost = async (id) => {
    try {
      const { error } = await supabase.from('reference_posts').delete().eq('id', id);

      if (error) {
        console.error('Supabase Deletion Error:', error);
        toast({ title: 'Error', description: 'Failed to delete post.', variant: 'destructive' });
      } else {
        setPosts((prevPosts) => prevPosts.filter((post) => post.id !== id));
        toast({ title: 'Success', description: 'Post deleted successfully' });
      }
    } catch (error) {
      console.error('Error in handleDeletePost:', error);
      toast({ title: 'Error', description: 'Unexpected error during deletion.', variant: 'destructive' });
    }
  };

  const handleShareTag = async (tag) => {
    try {
      if (tag === 'all') {
        toast({ 
          title: 'Error', 
          description: 'Please select a specific tag to share',
          variant: 'destructive'
        });
        return;
      }

      const shareId = Math.random().toString(36).substring(2, 15);
      const shareUrl = `${window.location.origin}/shared/${shareId}`;
      
      // Get posts for this tag
      const postsToShare = posts
        .filter(post => post.tag === tag)
        .map(post => ({
          id: post.id,
          tweet_id: post.tweet_id,
          description: post.description,
          tag: post.tag
        }));

      // Save to shared_collections
      const { error } = await supabase
        .from('shared_collections')
        .insert({
          share_id: shareId,
          user_id: session?.user?.id,
          tag: tag,
          posts: postsToShare  // Make sure your Supabase table column 'posts' is of type JSONB
        });

      if (error) throw error;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      toast({ 
        title: 'Success', 
        description: 'Share URL copied to clipboard!',
        duration: 5000,
      });
    } catch (error) {
      console.error('Error:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to create share link',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteTag = async (tagToDelete) => {
    if (!session?.user?.id) return;

    // Check if tag is in use
    const postsUsingTag = posts.some(post => post.tag === tagToDelete);
    if (postsUsingTag) {
      toast({ 
        title: 'Cannot Delete Tag', 
        description: 'There are posts using this tag. Please update or delete those posts first.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('name', tagToDelete)
        .eq('user_id', session.user.id);

      if (error) throw error;

      setTags(prev => prev.filter(tag => tag !== tagToDelete));
      if (selectedTag === tagToDelete) {
        setSelectedTag('all');
      }
      toast({ title: 'Success', description: 'Tag deleted successfully' });
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to delete tag', 
        variant: 'destructive' 
      });
    }
  };

  const filteredPosts = selectedTag === 'all' ? posts : posts.filter((post) => post.tag === selectedTag);

  const paginatedPosts = filteredPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);

  return (
    <>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
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
              onClick={() => setIsTagDialogOpen(true)}
            >
              Manage Tags
            </Button>

            <Button
              variant="outline"
              onClick={() => handleShareTag(selectedTag)}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share {selectedTag} posts
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#FF4400] hover:bg-[#FF4400]/90">
                  <Plus className="mr-2 h-4 w-4" /> Add New X Post
                </Button>
              </DialogTrigger>
              <DialogContent className="border-[#FF4400] border-2 bg-white">
                <DialogHeader>
                  <DialogTitle className="text-[#FF4400] font-bebas-neue text-3xl">
                    ADD NEW X POST
                  </DialogTitle>
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
                  <Button onClick={handleAddPost} className="w-full bg-[#FF4400] hover:bg-[#FF4400]/90">
                    ADD X POST
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
          <DialogContent className="border-[#FF4400] border-2 bg-white">
            <DialogHeader>
              <DialogTitle className="text-[#FF4400] font-bebas-neue text-3xl">
                MANAGE TAGS
              </DialogTitle>
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
                        onClick={() => handleDeleteTag(tag)}
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        {paginatedPosts.map((post) => (
          <Card key={post.id} className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10"
              onClick={() => handleDeletePost(post.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <CardContent>
              <Badge className="bg-[#FF4400] hover:bg-[#FF4400]/90">{post.tag}</Badge>
              {post.description && <p>{post.description}</p>}
              <TwitterEmbed tweetId={post.tweet_id} />
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => (
            <Button
              key={i + 1}
              variant={page === i + 1 ? 'default' : 'outline'}
              onClick={() => setPage(i + 1)}
              className={page === i + 1 ? 'bg-[#FF4400]' : ''}
            >
              {i + 1}
            </Button>
          ))}
        </div>
      )}
      <Toaster />
    </>
  );
}