import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PostEditor from '@/components/PostEditor';

export default function PostEditorDialog({ 
  isOpen, 
  onOpenChange, 
  post, 
  isNew, 
  onSave, 
  onClose,
  onDelete
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[80vh] p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>
            {isNew ? "Create New Post" : "Edit Post"}
          </DialogTitle>
        </DialogHeader>
        
        <PostEditor 
          post={post}
          isNew={isNew}
          onSave={onSave}
          onClose={onClose}
          onDelete={onDelete}
        />
      </DialogContent>
    </Dialog>
  );
} 