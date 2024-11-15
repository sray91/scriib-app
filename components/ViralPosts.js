import { Bebas_Neue, Lexend_Deca } from 'next/font/google'
import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MessageSquare, Heart, Search, Plus, Trash2 } from 'lucide-react'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas-neue',
})

const lexendDeca = Lexend_Deca({
  subsets: ['latin'],
  variable: '--font-lexend-deca',
})

export default function Component() {
  const [posts, setPosts] = useState([
    {
      id: '1',
      author: {
        name: 'John Doe',
        avatar: '/placeholder.svg?height=40&width=40',
        handle: '@johndoe'
      },
      date: '2024-01-15',
      content: 'Check out my latest article on coaching techniques!',
      likes: 5,
      comments: 2,
      tag: 'coaching',
      url: 'https://twitter.com/johndoe/status/123'
    },
    {
      id: '2',
      author: {
        name: 'Jane Smith',
        avatar: '/placeholder.svg?height=40&width=40',
        handle: '@janesmith'
      },
      date: '2024-01-16',
      content: 'New blog post about service-based businesses. Give it a read!',
      likes: 8,
      comments: 3,
      tag: 'service-based',
      url: 'https://linkedin.com/in/janesmith/post/456'
    },
  ])
  const [searchTerm, setSearchTerm] = useState('')
  const [newPost, setNewPost] = useState({
    url: '',
    tag: '',
    description: ''
  })
  const [tags, setTags] = useState(['coaching', 'service-based', 'tech', 'marketing'])
  const [newTag, setNewTag] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleAddPost = () => {
    const newPostObj = {
      id: Date.now().toString(),
      author: {
        name: 'Current User',
        avatar: '/placeholder.svg?height=40&width=40',
        handle: '@currentuser'
      },
      date: new Date().toISOString().split('T')[0],
      content: newPost.description,
      likes: 0,
      comments: 0,
      tag: newPost.tag,
      url: newPost.url
    }
    setPosts([newPostObj, ...posts])
    setNewPost({ url: '', tag: '', description: '' })
  }

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
      setIsDialogOpen(false)
    }
  }

  const handleRemovePost = (id) => {
    setPosts(posts.filter(post => post.id !== id))
  }

  const filteredPosts = posts.filter(post => 
    post.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className={`${bebasNeue.variable} ${lexendDeca.variable} font-sans max-w-2xl mx-auto p-4 space-y-6`}>
      <style jsx global>{`
        :root {
          --color-primary: #fb2e01;
        }
      `}</style>
      {/* Add new post form */}
      <Card className="p-4 border-primary border-2">
        <CardHeader className="pb-4">
          <h2 className="text-lg font-semibold font-bebas-neue text-primary">Add New Link</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url" className="font-bebas-neue">URL</Label>
            <Input
              id="url"
              placeholder="Enter Twitter or LinkedIn URL"
              value={newPost.url}
              onChange={(e) => setNewPost({ ...newPost, url: e.target.value })}
              className="font-lexend-deca border-primary focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tag" className="font-bebas-neue">Tag</Label>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="font-bebas-neue border-primary text-primary hover:bg-primary hover:text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Tag
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-primary border-2">
                  <DialogHeader>
                    <DialogTitle className="font-bebas-neue text-primary">Add New Tag</DialogTitle>
                  </DialogHeader>
                  <div className="flex items-center space-x-2">
                    <Input
                      placeholder="Enter new tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      className="font-lexend-deca border-primary focus:ring-primary"
                    />
                    <Button onClick={handleAddTag} className="font-bebas-neue bg-primary text-white hover:bg-primary/90">Add</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Select
              value={newPost.tag}
              onValueChange={(value) => setNewPost({ ...newPost, tag: value })}
            >
              <SelectTrigger className="font-bebas-neue border-primary focus:ring-primary">
                <SelectValue placeholder="Select a tag" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag} value={tag} className="font-bebas-neue">
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="font-bebas-neue">Description</Label>
            <Input
              id="description"
              placeholder="Add a description"
              value={newPost.description}
              onChange={(e) => setNewPost({ ...newPost, description: e.target.value })}
              className="font-lexend-deca border-primary focus:ring-primary"
            />
          </div>
          <Button className="w-full font-bebas-neue bg-primary text-white hover:bg-primary/90" onClick={handleAddPost}>
            Add Post
          </Button>
        </CardContent>
      </Card>

      {/* Search bar for tag filtering */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-primary" />
        <Input
          type="text"
          placeholder="Search by tag or content"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 font-lexend-deca border-primary focus:ring-primary"
        />
      </div>

      {/* Posts list */}
      <div className="space-y-4">
        {filteredPosts.map((post) => (
          <Card key={post.id} className="bg-card border-primary border-2">
            <CardHeader className="flex flex-row items-center space-x-4 pb-4">
              <Avatar>
                <AvatarImage src={post.author.avatar} alt={post.author.name} />
                <AvatarFallback>{post.author.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="font-semibold font-bebas-neue">{post.author.name}</div>
                <div className="text-sm text-muted-foreground font-lexend-deca">
                  {post.author.handle} · {post.date}
                </div>
              </div>
              <Badge className="ml-auto font-bebas-neue bg-primary text-white">{post.tag}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-lexend-deca">{post.content}</p>
              <a 
                href={post.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm text-primary hover:underline mt-2 inline-block font-lexend-deca"
              >
                View on {post.url.includes('twitter') ? 'Twitter' : 'LinkedIn'}
              </a>
            </CardContent>
            <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
              <div className="flex gap-4">
                <button className="flex items-center gap-1 hover:text-primary font-lexend-deca">
                  <Heart className="h-4 w-4" />
                  {post.likes}
                </button>
                <button className="flex items-center gap-1 hover:text-primary font-lexend-deca">
                  <MessageSquare className="h-4 w-4" />
                  {post.comments}
                </button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemovePost(post.id)}
                className="text-primary hover:bg-primary hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete post</span>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}