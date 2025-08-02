import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ChevronDown } from 'lucide-react';
import Image from 'next/image';

export default function UserTabs({ 
  selectedUser, 
  onUserChange, 
  currentUser 
}) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (currentUser) {
      fetchRelatedUsers();
    }
  }, [currentUser]);

  const fetchRelatedUsers = async () => {
    try {
      setIsLoading(true);
      
      // Start with current user
      const usersList = [{
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.raw_user_meta_data?.full_name || 
              currentUser.raw_user_meta_data?.name || 
              currentUser.email?.split('@')[0] || 'You',
        role: 'owner',
        avatar: currentUser.raw_user_meta_data?.avatar_url,
        isCurrentUser: true
      }];

      // Fetch ghostwriters (if current user is an approver)
      const { data: ghostwriterLinks, error: ghostwriterError } = await supabase
        .from('ghostwriter_approver_link')
        .select(`
          id,
          ghostwriter_id,
          active
        `)
        .eq('approver_id', currentUser.id)
        .eq('active', true);

      if (!ghostwriterError && ghostwriterLinks?.length > 0) {
        const ghostwriterIds = ghostwriterLinks.map(link => link.ghostwriter_id);
        
        const { data: ghostwriterDetails, error: ghostwriterDetailsError } = await supabase
          .from('users_view')
          .select('id, email, raw_user_meta_data')
          .in('id', ghostwriterIds);

        if (!ghostwriterDetailsError && ghostwriterDetails) {
          ghostwriterDetails.forEach(ghostwriter => {
            const userMetadata = ghostwriter.raw_user_meta_data || {};
            usersList.push({
              id: ghostwriter.id,
              email: ghostwriter.email,
              name: userMetadata.full_name || 
                    userMetadata.name || 
                    ghostwriter.email?.split('@')[0] || 'Unknown',
              role: 'ghostwriter',
              avatar: userMetadata.avatar_url,
              isCurrentUser: false
            });
          });
        }
      }

      // Fetch approvers (if current user is a ghostwriter)
      const { data: approverLinks, error: approverError } = await supabase
        .from('ghostwriter_approver_link')
        .select(`
          id,
          approver_id,
          active
        `)
        .eq('ghostwriter_id', currentUser.id)
        .eq('active', true);

      if (!approverError && approverLinks?.length > 0) {
        const approverIds = approverLinks.map(link => link.approver_id);
        
        const { data: approverDetails, error: approverDetailsError } = await supabase
          .from('users_view')
          .select('id, email, raw_user_meta_data')
          .in('id', approverIds);

        if (!approverDetailsError && approverDetails) {
          approverDetails.forEach(approver => {
            const userMetadata = approver.raw_user_meta_data || {};
            usersList.push({
              id: approver.id,
              email: approver.email,
              name: userMetadata.full_name || 
                    userMetadata.name || 
                    approver.email?.split('@')[0] || 'Unknown',
              role: 'approver',
              avatar: userMetadata.avatar_url,
              isCurrentUser: false
            });
          });
        }
      }

      setUsers(usersList);
      
      // Set current user as selected if no selection yet
      if (!selectedUser && usersList.length > 0) {
        onUserChange(usersList[0]);
      }
    } catch (error) {
      console.error('Error fetching related users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleConfig = (role) => {
    const roleConfig = {
      owner: {
        label: 'You',
        className: 'bg-blue-100 text-blue-800',
        color: 'bg-blue-500'
      },
      ghostwriter: {
        label: 'Ghostwriter',
        className: 'bg-green-100 text-green-800',
        color: 'bg-green-500'
      },
      approver: {
        label: 'Approver',
        className: 'bg-purple-100 text-purple-800',
        color: 'bg-purple-500'
      }
    };
    return roleConfig[role] || roleConfig.owner;
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 p-4 bg-white border-b">
        <div className="animate-pulse flex items-center space-x-2">
          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
          <div className="w-24 h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1 p-4 bg-white border-b overflow-x-auto">
      {users.map((user) => {
        const roleConfig = getRoleConfig(user.role);
        const isSelected = selectedUser?.id === user.id;
        
        return (
          <Button
            key={user.id}
            variant={isSelected ? "default" : "ghost"}
            className={`
              flex items-center space-x-2 px-3 py-2 h-auto whitespace-nowrap
              ${isSelected 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'hover:bg-gray-100'
              }
            `}
            onClick={() => onUserChange(user)}
          >
            {/* Avatar */}
            <div className="relative">
              <Avatar className="w-8 h-8">
                {user.avatar ? (
                  <Image 
                    src={user.avatar} 
                    alt={user.name}
                    width={32}
                    height={32}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className={`
                    w-full h-full rounded-full flex items-center justify-center text-white text-sm font-medium
                    ${roleConfig.color}
                  `}>
                    {getInitials(user.name)}
                  </div>
                )}
              </Avatar>
              
              {/* Role indicator dot */}
              <div className={`
                absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white
                ${roleConfig.color}
              `}></div>
            </div>

            {/* Name and role */}
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">
                {user.name}
              </span>
              <span className={`
                text-xs px-1 py-0.5 rounded
                ${isSelected 
                  ? 'bg-blue-500 text-blue-100' 
                  : roleConfig.className
                }
              `}>
                {user.isCurrentUser ? 'You' : roleConfig.label}
              </span>
            </div>
          </Button>
        );
      })}
      
      {users.length === 0 && (
        <div className="flex items-center space-x-2 text-gray-500">
          <Users size={16} />
          <span className="text-sm">No users found</span>
        </div>
      )}
    </div>
  );
} 