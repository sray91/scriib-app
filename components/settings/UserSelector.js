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

      if (links.length === 0) {
        setUsers([]);
        return;
      }

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
      const userProfiles = userDetails.map(user => {
        const userMetadata = user.raw_user_meta_data || {};
        return {
          id: user.id,
          email: user.email,
          full_name: userMetadata.full_name || userMetadata.name || user.email.split('@')[0],
          role: currentUserRole === 'ghostwriter' ? 'approver' : 'ghostwriter'
        };
      });

      setUsers(userProfiles);
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
        {currentUserRole === 'ghostwriter'
          ? 'Select Approver\'s Training Data'
          : 'Select Ghostwriter\'s Training Data'
        }
      </Label>

      <Select value={selectedUserId || ''} onValueChange={handleUserSelect} disabled={isLoading}>
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={
              isLoading
                ? 'Loading users...'
                : users.length === 0
                  ? `No ${currentUserRole === 'ghostwriter' ? 'approvers' : 'ghostwriters'} found`
                  : `Select a ${currentUserRole === 'ghostwriter' ? 'approver' : 'ghostwriter'}`
            }
          />
        </SelectTrigger>
        <SelectContent>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <span>{getUserDisplayName(user)}</span>
                {user.role && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({user.role})
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {users.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">
          {currentUserRole === 'ghostwriter'
            ? 'You need to be linked with approvers to access their training data.'
            : 'You need to be linked with ghostwriters to access their training data.'
          }
        </p>
      )}
    </div>
  );
};

export default UserSelector;