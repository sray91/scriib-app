'use client';

import React, { useState, useEffect } from 'react';
import { Users, Check } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

const UserSelector = ({ selectedUserId, onUserSelect, currentUserRole = 'ghostwriter' }) => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientComponentClient();
  const { toast } = useToast();

  useEffect(() => {
    fetchAvailableUsers();
  }, [currentUserRole]);

  const fetchAvailableUsers = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current user details first
      const { data: currentUserData, error: currentUserError } = await supabase
        .from('users_view')
        .select('id, email, raw_user_meta_data')
        .eq('id', user.id)
        .single();

      if (currentUserError) throw currentUserError;

      const currentUserMetadata = currentUserData.raw_user_meta_data || {};
      const currentUserProfile = {
        id: currentUserData.id,
        email: currentUserData.email,
        full_name: currentUserMetadata.full_name || currentUserMetadata.name || currentUserData.email.split('@')[0],
        role: 'current_user',
        isCurrent: true
      };

      // Get ghostwriter-approver links for current user
      let links;
      if (currentUserRole === 'ghostwriter') {
        // Ghostwriter can access their approvers' training data
        const { data, error } = await supabase
          .from('ghostwriter_approver_link')
          .select('approver_id')
          .eq('ghostwriter_id', user.id)
          .eq('active', true);

        if (error) throw error;
        links = data;
      } else {
        // Approvers can access their ghostwriters' training data
        const { data, error } = await supabase
          .from('ghostwriter_approver_link')
          .select('ghostwriter_id')
          .eq('approver_id', user.id)
          .eq('active', true);

        if (error) throw error;
        links = data;
      }

      let linkedUserProfiles = [];
      if (links.length > 0) {
        // Get user details from users_view
        const userIds = links.map(link =>
          currentUserRole === 'ghostwriter' ? link.approver_id : link.ghostwriter_id
        );

        const { data: userDetails, error: userError } = await supabase
          .from('users_view')
          .select('id, email, raw_user_meta_data')
          .in('id', userIds);

        if (userError) throw userError;

        // Transform the data to get user profiles
        linkedUserProfiles = userDetails.map(linkedUser => {
          const userMetadata = linkedUser.raw_user_meta_data || {};
          return {
            id: linkedUser.id,
            email: linkedUser.email,
            full_name: userMetadata.full_name || userMetadata.name || linkedUser.email.split('@')[0],
            role: currentUserRole === 'ghostwriter' ? 'approver' : 'ghostwriter'
          };
        });
      }

      // Combine current user and linked users, with current user first
      setUsers([currentUserProfile, ...linkedUserProfiles]);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available users',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getUserDisplayName = (user) => {
    if (user.full_name) {
      return `${user.full_name} (${user.email})`;
    }
    return user.email;
  };

  const handleUserSelect = (userId) => {
    const selectedUser = users.find(user => user.id === userId);
    onUserSelect(userId, selectedUser);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="user-selector" className="text-sm font-medium">
        <Users className="w-4 h-4 inline mr-2" />
        Select Training Data Source
      </Label>

      <Select value={selectedUserId || ''} onValueChange={handleUserSelect} disabled={isLoading}>
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={
              isLoading
                ? 'Loading users...'
                : users.length === 0
                  ? 'No users available'
                  : 'Select a user'
            }
          />
        </SelectTrigger>
        <SelectContent>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 ${user.isCurrent ? 'bg-green-500' : 'bg-blue-500'} rounded-full flex items-center justify-center text-white text-xs`}>
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <span>{getUserDisplayName(user)}</span>
                {user.isCurrent ? (
                  <span className="text-xs text-green-600 ml-1">
                    (My Data)
                  </span>
                ) : user.role && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({user.role})
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {users.length <= 1 && !isLoading && (
        <p className="text-sm text-muted-foreground">
          {currentUserRole === 'ghostwriter'
            ? 'Link with approvers to access their training data.'
            : 'Link with ghostwriters to access their training data.'}
        </p>
      )}
    </div>
  );
};

export default UserSelector;