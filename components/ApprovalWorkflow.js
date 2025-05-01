import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle, Users, Edit, ExternalLink } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const ApprovalWorkflow = ({ 
  post,
  isOpen,
  onClose,
  onApprove,
  onReject,
  isApprover 
}) => {
  const [approvalComment, setApprovalComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClientComponentClient();

  const handleAction = async (isApproved) => {
    try {
      setIsSubmitting(true);
      await (isApproved ? onApprove : onReject)(approvalComment);
      setApprovalComment('');
      onClose();
    } catch (error) {
      console.error('Error processing approval action:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInstead = async () => {
    try {
      setIsSubmitting(true);
      
      // Update the post status to needs_edit and set it back to the ghostwriter
      const { error } = await supabase
        .from('posts')
        .update({
          status: 'needs_edit',
          approval_comment: approvalComment,
          edited_at: new Date().toISOString()
        })
        .eq('id', post.id);
      
      if (error) throw error;
      
      setApprovalComment('');
      onClose();
      
      // Refresh the page to show the updated status
      window.location.reload();
    } catch (error) {
      console.error('Error sending post back for edits:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    const statusConfig = {
      draft: {
        label: 'Draft',
        className: 'bg-gray-100 text-gray-800',
        icon: Edit
      },
      pending_approval: {
        label: 'Pending Review',
        className: 'bg-yellow-100 text-yellow-800',
        icon: AlertCircle
      },
      needs_edit: {
        label: 'Needs Edit',
        className: 'bg-blue-100 text-blue-800',
        icon: Edit
      },
      approved: {
        label: 'Approved',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle2
      },
      scheduled: {
        label: 'Scheduled',
        className: 'bg-purple-100 text-purple-800',
        icon: ExternalLink
      },
      rejected: {
        label: 'Rejected',
        className: 'bg-red-100 text-red-800',
        icon: XCircle
      }
    };

    const config = statusConfig[post?.status] || statusConfig.pending_approval;
    const Icon = config.icon;

    return (
      <Badge className={`flex items-center gap-1 ${config.className}`}>
        <Icon size={14} />
        {config.label}
      </Badge>
    );
  };

  if (!post) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Review Post
            {getStatusBadge()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-4">
          {/* Post Content Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">
              Scheduled for: {new Date(post.scheduled_time).toLocaleString()}
            </div>
            <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
            
            {post.platforms && (
              <div className="flex gap-2 mt-3">
                {Object.entries(post.platforms).map(([platform, enabled]) => 
                  enabled && (
                    <Badge key={platform} variant="secondary" className="text-xs capitalize">
                      {platform}
                    </Badge>
                  )
                )}
              </div>
            )}

            {post.user_id && (
              <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                <span>Created by: {post.creator_name || 'Unknown'}</span>
              </div>
            )}
          </div>

          {/* Previous Approval Comments */}
          {post.approval_comment && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-1">
                Previous Review Comments
              </h4>
              <p className="text-sm text-blue-700">{post.approval_comment}</p>
            </div>
          )}

          {/* Approval Comment Input */}
          {isApprover && post.status === 'pending_approval' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Review Comments
                <span className="text-gray-500 ml-1">(required)</span>
              </label>
              <Textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                placeholder="Add your review comments..."
                rows={3}
                className="resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          {isApprover && post.status === 'pending_approval' ? (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleEditInstead}
                disabled={isSubmitting || !approvalComment.trim()}
              >
                <Edit className="mr-2 h-4 w-4" />
                Send Back for Edits
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleAction(false)}
                disabled={isSubmitting || !approvalComment.trim()}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Post
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleAction(true)}
                disabled={isSubmitting || !approvalComment.trim()}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve Post
              </Button>
            </div>
          ) : (
            <Button onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalWorkflow;