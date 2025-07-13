import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  Edit, 
  XCircle, 
  Users, 
  Image,
  Video,
  FileText,
  Trash2
} from 'lucide-react';

export default function PostCard({ 
  post, 
  onEdit, 
  onStatusChange, 
  onDelete,
  onDuplicate,
  isDragging = false,
  currentUser
}) {
  // Get status configuration
  const getStatusConfig = (status) => {
    const statusConfig = {
      draft: {
        label: 'Draft',
        className: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
        icon: Edit,
        color: 'gray'
      },
      pending_approval: {
        label: 'Pending Approval',
        className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
        icon: Clock,
        color: 'yellow'
      },
      needs_edit: {
        label: 'Needs Edit',
        className: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
        icon: Edit,
        color: 'blue'
      },
      approved: {
        label: 'Approved',
        className: 'bg-green-100 text-green-800 hover:bg-green-200',
        icon: CheckCircle,
        color: 'green'
      },
      scheduled: {
        label: 'Scheduled',
        className: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
        icon: Calendar,
        color: 'purple'
      },
      rejected: {
        label: 'Rejected',
        className: 'bg-red-100 text-red-800 hover:bg-red-200',
        icon: XCircle,
        color: 'red'
      },
      published: {
        label: 'Published',
        className: 'bg-green-100 text-green-800 hover:bg-green-200',
        icon: CheckCircle,
        color: 'green'
      }
    };
    return statusConfig[status] || statusConfig.draft;
  };

  // Get platform icons
  const getPlatformIcons = (platforms) => {
    const platformIcons = {
      linkedin: { icon: '💼', color: 'text-blue-600' },
      twitter: { icon: '🐦', color: 'text-blue-400' },
      facebook: { icon: '📘', color: 'text-blue-700' },
      instagram: { icon: '📷', color: 'text-pink-600' }
    };
    
    return Object.entries(platforms || {})
      .filter(([_, enabled]) => enabled)
      .map(([platform, _]) => platformIcons[platform] || { icon: '🌐', color: 'text-gray-600' });
  };

  // Get user role display
  const getUserRole = () => {
    if (!currentUser) return null;
    
    if (post.user_id === currentUser.id) return 'owner';
    if (post.approver_id === currentUser.id) return 'approver';
    if (post.ghostwriter_id === currentUser.id) return 'ghostwriter';
    return null;
  };

  // Check if post has media
  const hasMedia = () => {
    return post.mediaFiles && post.mediaFiles.length > 0;
  };

  const statusConfig = getStatusConfig(post.status);
  const StatusIcon = statusConfig.icon;
  const platformIcons = getPlatformIcons(post.platforms);
  const userRole = getUserRole();

  // Handle click to edit post
  const handleCardClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(post);
  };

  // Handle status change
  const handleStatusClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onStatusChange) {
      onStatusChange(post.id, post.status);
    }
  };

  // Handle delete
  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(post.id);
    }
  };

  return (
    <Card 
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md border-l-4 
        ${isDragging ? 'opacity-50 rotate-2 scale-95' : 'hover:scale-102'}
        border-l-${statusConfig.color}-400
      `}
      onClick={handleCardClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header with status and actions */}
        <div className="flex items-center justify-between">
          <Badge 
            className={`${statusConfig.className} flex items-center gap-1 text-xs`}
            onClick={handleStatusClick}
          >
            <StatusIcon size={12} />
            {statusConfig.label}
          </Badge>
          
          <div className="flex items-center gap-1">
            {/* Platform indicators */}
            {platformIcons.map((platform, index) => (
              <span key={index} className={`text-sm ${platform.color}`}>
                {platform.icon}
              </span>
            ))}
            
            {/* Media indicator */}
            {hasMedia() && (
              <div className="flex items-center gap-1">
                <Image size={12} className="text-gray-500" />
                <span className="text-xs text-gray-500">{post.mediaFiles.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Post content preview */}
        <div className="min-h-[60px]">
          <p className="text-sm text-gray-800 line-clamp-3 leading-tight">
            {post.content || 'No content...'}
          </p>
        </div>

        {/* User and time info */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Users size={12} />
            <span>
              {post.user_id === currentUser?.id 
                ? 'You' 
                : (post.creator_name || 'Unknown')
              }
            </span>
            {userRole && userRole !== 'owner' && (
              <Badge className="bg-blue-50 text-blue-700 text-xs px-1 py-0">
                {userRole}
              </Badge>
            )}
          </div>
          
          {post.scheduled_time && (
            <div className="flex items-center gap-1">
              <Calendar size={12} />
              <span>
                {new Date(post.scheduled_time).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}
        </div>

        {/* Approval/workflow info */}
        {post.approver_id && post.approver_name && (
          <div className="flex items-center gap-1 text-xs">
            <Badge className="bg-blue-50 text-blue-800 flex items-center gap-1">
              <Users size={10} />
              {post.status === 'pending_approval' ? 'Awaiting' : 'Approved by'} {post.approver_name}
            </Badge>
          </div>
        )}

        {/* Quick actions on hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate && onDuplicate(post);
            }}
          >
            Copy
          </Button>
          {(userRole === 'owner' || userRole === 'approver') && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
              onClick={handleDeleteClick}
            >
              <Trash2 size={12} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 