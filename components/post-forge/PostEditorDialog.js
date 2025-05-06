import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PostEditor from '@/components/PostEditor';

/**
 * Standardized post editor dialog component
 * This component ensures a consistent post editing experience
 * regardless of where it's called from in the application.
 */
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
      <DialogContent 
        className="max-w-6xl h-[80vh] p-0 overflow-hidden" 
        aria-describedby="post-editor-description"
      >
        <DialogHeader className="p-4 border-b bg-white sticky top-0 z-10">
          <DialogTitle className="text-xl font-semibold">
            {isNew ? "Create New Post" : "Edit Post"}
          </DialogTitle>
          <DialogDescription id="post-editor-description" className="sr-only">
            {isNew ? "Create a new post" : "Edit your existing post"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-y-auto">
          <PostEditor 
            post={post}
            isNew={isNew}
            onSave={onSave}
            onClose={onClose}
            onDelete={onDelete}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 