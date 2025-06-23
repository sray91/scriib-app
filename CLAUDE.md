# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint to check code quality

## Architecture Overview

This is a Next.js 14 creator app built for LinkedIn content creation with AI assistance. The app uses the App Router with a Supabase backend for authentication, database, and storage.

### Key Technology Stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Radix UI components, shadcn/ui
- **Backend**: Next.js API routes, Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with OAuth (LinkedIn, Twitter)
- **AI Integration**: OpenAI (GPT-4o, GPT o3, Whisper, GPT-Image-1)
- **Storage**: Supabase Storage for media and documents

### Core Application Features

1. **CoCreate**: AI-powered LinkedIn post generation using voice analysis and training documents
2. **Post Forge**: Content management with scheduling, approval workflows, and media handling  
3. **InfoGen**: AI infographic generator with 9 predefined templates
4. **Viral Posts**: "Swipe file" for collecting and organizing reference content
5. **Analytics**: Post performance tracking and engagement metrics

### User Roles & Workflow
- **Ghostwriters**: Create and draft content
- **Approvers**: Review and approve content before publishing
- **Many-to-many relationship**: Ghostwriters can have multiple approvers and vice versa
- **Post status flow**: draft → pending_approval → approved/rejected → scheduled → published

### Database Architecture
- **User Management**: `profiles` table with role-based access control
- **Content**: `posts` table with workflow status tracking
- **Relationships**: `ghostwriter_approver_link` junction table
- **Training Data**: `training_documents` for AI voice analysis
- **Analytics**: `past_posts` and `trending_posts` for performance tracking
- **Social**: `social_accounts` for OAuth token management

All tables use Row Level Security (RLS) policies for user-scoped data access.

### Key Directories
- `app/` - Next.js App Router pages and API routes
- `components/` - Reusable React components organized by feature
- `lib/` - Utility functions, Supabase client, database schema files
- `docs/` - Feature documentation and guides

### Environment Variables
See `docs/ENVIRONMENT_VARIABLES.md` for complete setup. Key variables:
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Supabase
- `SUPABASE_SERVICE_ROLE_KEY` for admin operations
- Social OAuth credentials for LinkedIn and Twitter integration

### Component Architecture
- Uses shadcn/ui components in `components/ui/`
- Feature-specific components organized by domain (settings/, post-forge/, etc.)
- MainLayout with conditional sidebar based on route
- Providers component wraps the app for context and authentication

### API Integration Patterns
- OpenAI client configuration with error handling and retry logic  
- Supabase real-time subscriptions for live updates
- OAuth token management with refresh handling
- File upload processing for training documents (PDF, DOC, TXT, MD, CSV)

### Common Development Patterns
- Server components for data fetching with Supabase
- Client components for interactive features with 'use client'
- API routes handle external service integration and complex operations
- Custom hooks for reusable stateful logic
- Toast notifications for user feedback using shadcn/ui toast system