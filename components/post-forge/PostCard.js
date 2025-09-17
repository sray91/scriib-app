import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Trash2,
  Archive,
  Copy,
  MoreHorizontal,
  Linkedin,
  Twitter,
  Facebook,
  Instagram
} from 'lucide-react';

export default function PostCard({ 
  post, 
  onEdit, 
  onStatusChange, 
  onDelete,
  onDuplicate,
  onArchive,
  isDragging = false,
  currentUser
}) {
  // Get status configuration with Apple-inspired colors
  const getStatusConfig = (status) => {
    const statusConfig = {
      draft: {
        label: 'Draft',
        className: 'bg-gray-50 text-gray-700 border border-gray-200',
        icon: Edit,
        color: 'gray',
        dotColor: 'bg-gray-400'
      },
      pending_approval: {
        label: 'Pending',
        className: 'bg-amber-50 text-amber-700 border border-amber-200',
        icon: Clock,
        color: 'amber',
        dotColor: 'bg-amber-500'
      },
      needs_edit: {
        label: 'Needs Edit',
        className: 'bg-blue-50 text-blue-700 border border-blue-200',
        icon: Edit,
        color: 'blue',
        dotColor: 'bg-blue-500'
      },
      approved: {
        label: 'Approved',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        icon: CheckCircle,
        color: 'emerald',
        dotColor: 'bg-emerald-500'
      },
      scheduled: {
        label: 'Scheduled',
        className: 'bg-purple-50 text-purple-700 border border-purple-200',
        icon: Calendar,
        color: 'purple',
        dotColor: 'bg-purple-500'
      },
      rejected: {
        label: 'Rejected',
        className: 'bg-red-50 text-red-700 border border-red-200',
        icon: XCircle,
        color: 'red',
        dotColor: 'bg-red-500'
      },
      published: {
        label: 'Published',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        icon: CheckCircle,
        color: 'emerald',
        dotColor: 'bg-emerald-500'
      },
      archived: {
        label: 'Archived',
        className: 'bg-gray-50 text-gray-600 border border-gray-200',
        icon: Archive,
        color: 'gray',
        dotColor: 'bg-gray-400'
      }
    };
    return statusConfig[status] || statusConfig.draft;
  };

  // Get platform icons with proper Lucide icons
  const getPlatformIcons = (platforms) => {
    const platformIcons = {
      linkedin: { icon: Linkedin, color: 'text-blue-600', bgColor: 'bg-blue-50' },
      twitter: { icon: Twitter, color: 'text-sky-500', bgColor: 'bg-sky-50' },
      facebook: { icon: Facebook, color: 'text-blue-700', bgColor: 'bg-blue-50' },
      instagram: { icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-50' }
    };
    
    return Object.entries(platforms || {})
      .filter(([_, enabled]) => enabled)
      .map(([platform, _]) => platformIcons[platform] || { icon: Users, color: 'text-gray-600', bgColor: 'bg-gray-50' });
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

  // Use archived status if post is archived, otherwise use the actual status
  const displayStatus = post.archived ? 'archived' : post.status;
  const statusConfig = getStatusConfig(displayStatus);
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

  // Handle archive
  const handleArchiveClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onArchive) {
      onArchive(post.id, !post.archived);
    }
  };

  return (
    <Card 
      className={`
        group cursor-pointer transition-all duration-300 ease-out
        bg-white/80 backdrop-blur-sm border-0 shadow-sm hover:shadow-lg 
        hover:shadow-black/5 hover:-translate-y-0.5 rounded-2xl overflow-hidden
        h-[280px] flex flex-col
        ${isDragging ? 'opacity-60 rotate-1 scale-95 shadow-xl' : ''}
      `}
      onClick={handleCardClick}
    >
      <CardContent className="p-0 h-full flex flex-col">
        {/* Status indicator bar */}
        <div className={`h-1 w-full ${statusConfig.dotColor} flex-shrink-0`} />
        
        <div className="p-5 space-y-4 flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {/* Status dot and label */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                <span className="text-sm font-medium text-gray-700">
                  {statusConfig.label}
                </span>
              </div>
            </div>
            
            {/* Platform indicators */}
            <div className="flex items-center gap-1.5">
              {platformIcons.map((platform, index) => {
                const PlatformIcon = platform.icon;
                return (
                  <div 
                    key={index} 
                    className={`w-6 h-6 rounded-full ${platform.bgColor} flex items-center justify-center`}
                  >
                    <PlatformIcon size={12} className={platform.color} />
                  </div>
                );
              })}
              
              {/* Media indicator */}
              {hasMedia() && (
                <div className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center">
                  <Image size={12} className="text-gray-500" />
                </div>
              )}
            </div>
          </div>

          {/* Content preview */}
          <div className="space-y-3 min-h-0 flex-1">
            <div className="overflow-hidden">
              <p className="text-gray-800 text-sm leading-relaxed font-normal line-clamp-4 break-words">
                {post.content || (
                  <span className="text-gray-400 italic">No content...</span>
                )}
              </p>
            </div>
          </div>

          {/* Metadata footer */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-50 flex-shrink-0 mt-auto">
            {/* Author info */}
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="w-6 h-6 flex-shrink-0">
                <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                  {post.user_id === currentUser?.id 
                    ? currentUser?.email?.charAt(0)?.toUpperCase() || 'Y'
                    : (post.creator_name || 'U').charAt(0).toUpperCase()
                  }
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-gray-700 truncate">
                  {post.user_id === currentUser?.id 
                    ? 'You' 
                    : (post.creator_name || 'Unknown')
                  }
                </span>
                {userRole && userRole !== 'owner' && (
                  <span className="text-xs text-gray-500 capitalize truncate">
                    {userRole}
                  </span>
                )}
              </div>
            </div>
            
            {/* Time and schedule info */}
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
              {post.scheduled_time && (
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  <span className="whitespace-nowrap">
                    {new Date(post.scheduled_time).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              <span className="whitespace-nowrap">
                {new Date(post.created_at || Date.now()).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>

          {/* Approval info */}
          {post.approver_id && post.approver_name && (
            <div className="flex items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Users size={12} className="text-blue-600" />
                </div>
                <span className="text-sm text-blue-700 truncate">
                  {post.status === 'pending_approval' ? 'Awaiting approval from' : 
                   post.status === 'approved' ? 'Approved by' : 'Reviewed by'} {post.approver_name}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions overlay - appears on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-200 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
          <div className="absolute top-4 right-4 flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white border-0"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate && onDuplicate(post);
              }}
              title="Duplicate post"
            >
              <Copy size={14} className="text-gray-600" />
            </Button>
            
            {(userRole === 'owner' || userRole === 'approver') && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white border-0"
                  onClick={handleArchiveClick}
                  title={post.archived ? 'Unarchive post' : 'Archive post'}
                >
                  <Archive size={14} className="text-gray-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white border-0"
                  onClick={handleDeleteClick}
                  title="Delete post"
                >
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 