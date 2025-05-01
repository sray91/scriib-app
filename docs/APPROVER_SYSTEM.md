# Approver Invitation System

This document explains how the approver invitation system works and how to troubleshoot common issues.

## Overview

The approver invitation system allows users (ghostwriters) to invite other users to approve their content before publishing. The process involves:

1. Sending an invitation email
2. The approver clicking the link in the email
3. The approver being redirected to accept the invitation
4. Creating a link between the ghostwriter and approver in the database
5. Prompting the approver to set a password for enhanced security

## Authentication Methods

The system supports multiple authentication methods to accommodate both new and existing users:

1. **Password Authentication**: Regular sign-up and login with email/password
2. **Magic Link Authentication**: Passwordless login via email links - ideal for approvers

When a user is invited as an approver, they receive a magic link email. This allows them to sign in securely without needing to create a password. After signing in, they can accept the invitation to become an approver.

### Magic Link Flow

1. Approver receives invitation email with a secure link
2. Clicking the link logs them in automatically (one-time use)
3. They're redirected to accept the invitation
4. After accepting the invitation, they're prompted to set a password
5. For future logins, they can:
   - Request another magic link by clicking "Email Magic Link"
   - Use their email and password if they've set one
   - Manage their password through the account settings

This approach ensures that approvers can get started immediately without the friction of creating a password, but still have the option to set one for added security.

## Password Management

After accepting an invitation, approvers are encouraged to set a password for their account:

1. A prompt is displayed after accepting the invitation
2. The approver can click the "Set Password" button to go to the password settings
3. They can set a password without needing to know their current password (for accounts created via Magic Link)
4. Once set, they can use either password login or Magic Link for future logins

Approvers can always manage their password later through the Settings > Password tab.

## Database Schema

The system relies on the following database tables:

- `auth.users` - Supabase's built-in user authentication table
- `public.profiles` - User profile information
- `public.ghostwriter_approver_link` - Links between ghostwriters and approvers

The `ghostwriter_approver_link` table has foreign key constraints to `auth.users` for both the ghostwriter and approver IDs.

## Invitation Flow

1. **Invitation Sent**: 
   - User enters an email address to invite an approver
   - System checks if the email already exists in the system
   - If the user exists, creates a link in the database
   - If the user doesn't exist, sends an invitation email

2. **Authentication**: 
   - Approver clicks the link in the email
   - They're redirected to `/auth/callback` with a code parameter
   - If not logged in, they're redirected to login/signup

3. **Acceptance**:
   - After authentication, approver is redirected to `/accept`
   - System verifies the ghostwriter exists
   - System creates or activates the approver-ghostwriter link
   - Success/error message is displayed

## Troubleshooting

### Common Issues

1. **"Could not find the user who invited you"**:
   - Cause: The ghostwriter ID in the URL doesn't exist in the database
   - Solution: Verify the ghostwriter exists in `auth.users` and has a profile
   - The system tries multiple fallback options to find a user:
     1. RPC function if available (`get_user_details`)
     2. Check-ghostwriter API endpoint
     3. Direct profile table lookup
     4. Users_view lookup (existing view of auth.users)

2. **Error: "supabase.auth.admin.getUserByEmail is not a function"**:
   - Cause: The admin API is not available in the client component
   - Solution: Use the regular authentication methods and profiles table lookups
   - We've removed this API call and use multiple fallback methods instead

3. **Foreign Key Constraint Errors**:
   - Cause: Trying to create a link to a user that doesn't exist in `auth.users`
   - Solution: Ensure both users exist before creating the link
   - Use the `sync_ghostwriter_approvers.sql` script to fix this issue:
     - It adds a trigger to automatically ensure users exist in profiles
     - It provides a one-time fix for existing data issues
  
4. **Redirect Issues**:
   - Cause: Incorrect environment variables (especially in production)
   - Solution: Check `NEXT_PUBLIC_SITE_URL` and `APPROVER_CALLBACK_URL` for trailing slashes and correct domains

### Database Views and Tables

The system uses these database objects:

1. **`ghostwriter_approver_link`** - Links ghostwriters and approvers
2. **`profiles`** - User profiles with metadata (id, full_name, username, etc. - no email field)
3. **`users_view`** - View of `auth.users` for easy access (includes email)
4. **`get_user_details`** - RPC function to get user info  

The system does NOT create or use:
- `public.users` table (don't confuse with `auth.users` or `users_view`)
- `auth_public_users` view (we use the existing `users_view` instead)

### Profiles Table Structure

The actual profile table structure:

```sql
create table public.profiles (
  id uuid not null,
  full_name text null,
  username text null,
  bio text null,
  website text null,
  avatar_url text null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint profiles_pkey primary key (id),
  constraint profiles_username_key unique (username),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;
```

Note that profiles does NOT have an email column - the email is stored in auth.users and can be accessed via users_view.

### Adding a Database Trigger for Auto-Sync

Running the following SQL will create a trigger that automatically ensures users exist in the profiles table before they're linked:

```sql
-- Create a function to sync users
CREATE OR REPLACE FUNCTION public.sync_auth_users_for_ghostwriter_links()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the ghostwriter exists in the users_view or auth.users
  -- If not, find it in auth.users and ensure there's a corresponding profile
  IF NOT EXISTS (
    SELECT 1 FROM public.users_view WHERE id = NEW.ghostwriter_id
  ) THEN
    -- Insert might fail if the user doesn't exist in auth.users at all
    -- But we try anyway
    BEGIN
      INSERT INTO public.profiles (id, created_at)
      SELECT id, created_at
      FROM auth.users
      WHERE id = NEW.ghostwriter_id
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Just log and continue - the trigger shouldn't prevent the INSERT/UPDATE
      RAISE NOTICE 'Could not sync ghostwriter ID: %', NEW.ghostwriter_id;
    END;
  END IF;

  -- Same for approver
  IF NOT EXISTS (
    SELECT 1 FROM public.users_view WHERE id = NEW.approver_id
  ) THEN
    BEGIN
      INSERT INTO public.profiles (id, created_at)
      SELECT id, created_at
      FROM auth.users
      WHERE id = NEW.approver_id
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not sync approver ID: %', NEW.approver_id;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS sync_users_for_links ON public.ghostwriter_approver_link;
CREATE TRIGGER sync_users_for_links
BEFORE INSERT OR UPDATE ON public.ghostwriter_approver_link
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_users_for_ghostwriter_links();
```

This trigger will help prevent foreign key constraint errors by automatically ensuring that users referenced in the ghostwriter_approver_link table exist in the profiles table.

## Environment Variables

Ensure these environment variables are properly set:

```
# Site URLs - NO trailing slashes!
NEXT_PUBLIC_SITE_URL=https://your-domain.com
APPROVER_CALLBACK_URL=https://your-domain.com/auth/callback
``` 