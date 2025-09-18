# Ghostwriter Training Data Access Feature

## Overview

This feature allows ghostwriters to access and manage their approvers' training data, including context documents, trending training data, LinkedIn posts, and context guides. This enables ghostwriters to better understand their approvers' voice and style preferences.

## How It Works

### User Roles
- **Ghostwriters**: Can access their linked approvers' training data
- **Approvers**: Can access their linked ghostwriters' training data

### User Interface

The user selector is located in the top-right section of the Training Data Manager in the Account Settings page (`/settings`). It includes:

1. **User Selector Dropdown**: Shows available linked users (approvers for ghostwriters, ghostwriters for approvers)
2. **Current Context Display**: Shows which user's training data is currently being managed
3. **Role-based Labels**: Clear indication of the relationship type

### Features Accessible

When a user is selected, ghostwriters can:

1. **Context Guide Management**
   - View and edit the selected user's context guide
   - Save changes to the selected user's preferences
   - Run AI-powered context guide training using the selected user's data

2. **Trending Training Data**
   - Add LinkedIn posts to the selected user's trending training data
   - View, activate/deactivate, and delete existing trending posts
   - Extract data from LinkedIn URLs for the selected user

3. **Context Documents**
   - Upload training documents for the selected user
   - View, activate/deactivate, and delete existing documents
   - Process various file formats (PDF, DOC, DOCX, TXT, MD, CSV)

4. **LinkedIn Posts**
   - Scrape LinkedIn posts for the selected user
   - View and manage imported posts

## Technical Implementation

### Components

- **UserSelector**: React component for selecting linked users
- **TrainingDataTab**: Updated to support multi-user context
- **API Endpoints**: New `/api/training-data/user` endpoint for cross-user access

### Database Schema

- **ghostwriter_approver_link**: Existing table that defines relationships
- **RLS Policies**: Updated to allow cross-access for linked users
- **Helper Function**: `can_access_user_training_data()` for permission checking

### Security

- **Row Level Security (RLS)**: Ensures users can only access data from linked accounts
- **API Authorization**: Server-side validation of user relationships
- **Permission Checking**: Every data access request validates user relationships

## Usage Instructions

### For Ghostwriters

1. Navigate to Account Settings → Training Data tab
2. In the top-right section, select an approver from the dropdown
3. The interface will show "Currently managing training data for: [Approver Name]"
4. All training data operations will now apply to the selected approver
5. Upload documents, add trending posts, and manage context guides for the approver
6. Use the AI training feature to analyze the approver's data and generate context guides

### For Approvers

1. Navigate to Account Settings → Training Data tab
2. Select a ghostwriter from the dropdown (if linked to any)
3. Manage the ghostwriter's training data as needed
4. Help improve the ghostwriter's understanding of your brand voice

## Database Migration

To enable this feature, run the following SQL file:

```sql
-- Execute this file to add the necessary policies and user_id column
\i lib/table-definitions/training_data_cross_access_policies.sql
```

## API Endpoints

### GET `/api/training-data/user`

Query parameters:
- `userId`: Target user ID
- `type`: Data type (`trending_posts`, `training_documents`, `context_guide`)

### POST `/api/training-data/user`

Body:
```json
{
  "targetUserId": "uuid",
  "dataType": "string",
  "data": "object"
}
```

## Error Handling

- **Permission Denied (403)**: User doesn't have access to target user's data
- **Unauthorized (401)**: User is not authenticated
- **Bad Request (400)**: Missing or invalid parameters

## Benefits

1. **Improved Voice Matching**: Ghostwriters can better understand approver preferences
2. **Collaborative Training**: Both parties can contribute to AI training data
3. **Streamlined Workflow**: Single interface for managing multiple users' training data
4. **Enhanced AI Performance**: Better training data leads to more accurate content generation

## Limitations

- Only linked users (via ghostwriter_approver_link) can access each other's data
- Changes are immediately reflected across all users
- No version control for shared modifications
- Requires active relationship status in the database