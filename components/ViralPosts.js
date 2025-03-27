'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { TwitterEmbed } from './viral-posts/TwitterEmbed';
import PostsList from './viral-posts/PostsList';
import AddPostDialog from './viral-posts/AddPostDialog';
import TagsManager from './viral-posts/TagsManager';
import PostsFilter from './viral-posts/PostsFilter';
import Pagination from './viral-posts/Pagination';

const POSTS_PER_PAGE = 6;

export default function ViralPostSwipeFile() {
  const supabase = createClientComponentClient();
  const session = useSession();
  const { toast } = useToast();
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('all');
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset to page 1 when changing tags
  useEffect(() => {
    setPage(1);
  }, [selectedTag]);

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

    setIsLoading(true);
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
        console.log('Fetched posts:', data);
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    } finally {
      setIsLoading(false);
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
        console.log('Fetched tags:', data);
        // Check the structure of your tag data
        if (data && data.length > 0) {
          // Adjust this based on your actual data structure
          const tagNames = data.map(tag => tag.name || tag.tag_name || tag.tag);
          console.log('Extracted tag names:', tagNames);
          setTags(tagNames);
        } else {
          setTags([]);
        }
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

  // Debug logging
  useEffect(() => {
    console.log('Current state:', {
      posts: posts.length,
      tags: tags.length,
      selectedTag,
      page,
      filteredPosts: filteredPosts.length,
      paginatedPosts: paginatedPosts.length,
      totalPages
    });
  }, [posts, tags, selectedTag, page]);

  const handleAddPost = async (newPostData) => {
    if (!supabase?.from) {
      console.error('Supabase client not properly initialized');
      toast({ 
        title: "Error", 
        description: "Database connection error. Please try again later.", 
        variant: "destructive" 
      });
      return;
    }

    if (!newPostData.url) {
      toast({ title: "Error", description: "Please enter a valid X post URL", variant: "destructive" });
      return;
    }

    const tweetIdMatch = newPostData.url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
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
      description: newPostData.description,
      tweet_id: tweetId,
      tag: newPostData.tag || 'untagged',
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

  const handleAddTag = async (newTagName) => {
    if (!newTagName || !session?.user?.id) return;
    if (tags.includes(newTagName)) {
      toast({ title: 'Error', description: 'Tag already exists', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('tags')
        .insert([{ 
          name: newTagName,
          user_id: session.user.id 
        }]);

      if (error) throw error;

      setTags(prev => [...prev, newTagName]);
      setIsTagDialogOpen(false);
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

  const filteredPosts = selectedTag === 'all' ? posts : posts.filter((post) => post.tag === selectedTag);
  const paginatedPosts = filteredPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);

  return (
    <>
      <div className="max-w-4xl mx-auto p-4 pt-16 md:pt-4 space-y-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <PostsFilter 
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
            tags={tags}
            onManageTags={() => setIsTagDialogOpen(true)}
            onShareTag={handleShareTag}
          />

          <AddPostDialog 
            isOpen={isDialogOpen}
            setIsOpen={setIsDialogOpen}
            onAddPost={handleAddPost}
            tags={tags}
          />
        </div>

        <TagsManager
          isOpen={isTagDialogOpen}
          setIsOpen={setIsTagDialogOpen}
          tags={tags}
          onAddTag={handleAddTag}
          onDeleteTag={handleDeleteTag}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-10">Loading posts...</div>
      ) : (
        <>
          {posts.length === 0 ? (
            <div className="text-center py-10">
              No posts found. Add your first X post to get started!
            </div>
          ) : (
            <>
              <PostsList 
                posts={paginatedPosts}
                onDeletePost={handleDeletePost}
              />

              {totalPages > 1 && (
                <Pagination 
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </>
      )}
      <Toaster />
    </>
  );
}