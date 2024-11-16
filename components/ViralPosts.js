'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from 'lucide-react'

const POSTS_PER_PAGE = 6 // Changed to 6 for better grid layout

const TwitterEmbed = ({ tweetId }) => {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [tweetId])

  return (
    <div className="twitter-embed">
      <blockquote className="twitter-tweet" data-dnt="true">
        <a href={`https://twitter.com/x/status/${tweetId}`}></a>
      </blockquote>
    </div>
  )
}

export default function ViralPostSwipeFile() {
  const { toast } = useToast()
  const [posts, setPosts] = useState([])
  const [newPost, setNewPost] = useState({ url: '', description: '', tag: '' })
  const [tags, setTags] = useState(['tech', 'marketing', 'design', 'development'])
  const [selectedTag, setSelectedTag] = useState('all')
  const [page, setPage] = useState(1)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newTag, setNewTag] = useState('')

  const handleAddPost = () => {
    if (!newPost.url) {
      toast({
        title: "Error",
        description: "Please enter a valid X post URL",
        variant: "destructive",
      })
      return
    }

    const tweetIdMatch = newPost.url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
    if (!tweetIdMatch) {
      toast({
        title: "Error",
        description: "Invalid X post URL. Please use a valid twitter.com or x.com status URL.",
        variant: "destructive",
      })
      return
    }

    const tweetId = tweetIdMatch[1]
    const newPostObj = {
      id: Date.now().toString(),
      description: newPost.description,
      tweetId: tweetId,
      tag: newPost.tag || 'untagged'
    }
    setPosts(prevPosts => [newPostObj, ...prevPosts])
    setNewPost({ url: '', description: '', tag: '' })
    setIsDialogOpen(false)
    toast({
      title: "Success",
      description: "X post added successfully",
    })
  }

  const handleAddTag = () => {
    if (!newTag) return
    if (tags.includes(newTag)) {
      toast({
        title: "Error",
        description: "Tag already exists",
        variant: "destructive",
      })
      return
    }
    setTags(prev => [...prev, newTag])
    setNewTag('')
    toast({
      title: "Success",
      description: "Tag added successfully",
    })
  }

  const handleDeletePost = (id) => {
    setPosts(prevPosts => prevPosts.filter(post => post.id !== id))
    toast({
      title: "Success",
      description: "Post deleted successfully",
    })
  }

  const filteredPosts = selectedTag === 'all'
    ? posts
    : posts.filter(post => post.tag === selectedTag)

  const paginatedPosts = filteredPosts.slice(
    (page - 1) * POSTS_PER_PAGE,
    page * POSTS_PER_PAGE
  )

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <Select value={selectedTag} onValueChange={setSelectedTag}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map(tag => (
              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#FF4400] hover:bg-[#FF4400]/90">
              <Plus className="mr-2 h-4 w-4" /> Add New X Post
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#FF4400] border-2">
            <DialogHeader>
              <DialogTitle className="text-[#FF4400] font-bebas-neue text-3xl">ADD NEW X POST</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="url" className="font-bebas-neue text-xl">X POST URL</Label>
                <Input
                  id="url"
                  placeholder="Enter X post URL"
                  value={newPost.url}
                  onChange={(e) => setNewPost({ ...newPost, url: e.target.value })}
                  className="font-lexend-deca"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="font-bebas-neue text-xl">DESCRIPTION (OPTIONAL)</Label>
                <Input
                  id="description"
                  placeholder="Add a description (optional)"
                  value={newPost.description}
                  onChange={(e) => setNewPost({ ...newPost, description: e.target.value })}
                  className="font-lexend-deca"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag" className="font-bebas-neue text-xl">TAG</Label>
                <div className="flex gap-2">
                  <Select value={newPost.tag} onValueChange={(value) => setNewPost({ ...newPost, tag: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="untagged">Untagged</SelectItem>
                      {tags.map(tag => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Add new tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="font-lexend-deca"
                  />
                  <Button onClick={handleAddTag} variant="outline">Add Tag</Button>
                </div>
              </div>
              <Button 
                onClick={handleAddPost} 
                className="w-full bg-[#FF4400] hover:bg-[#FF4400]/90 font-bebas-neue text-xl"
              >
                ADD X POST
              </Button>
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
            <CardContent className="p-4">
              {post.tag && (
                <Badge className="mb-2 bg-[#FF4400]">{post.tag}</Badge>
              )}
              {post.description && (
                <p className="mb-2 font-lexend-deca text-sm">{post.description}</p>
              )}
              <div className="overflow-hidden" style={{ maxHeight: '300px' }}>
                <TwitterEmbed tweetId={post.tweetId} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => (
            <Button
              key={i + 1}
              variant={page === i + 1 ? "default" : "outline"}
              onClick={() => setPage(i + 1)}
              className={page === i + 1 ? "bg-[#FF4400]" : ""}
            >
              {i + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}