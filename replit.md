# Overview

CB Workflow is a CRO (Conversion Rate Optimization) agency management platform designed to streamline the colorblock creation process for Facebook ads testing. The application allows teams to manage projects, create and review marketing statements, and generate visual colorblocks for social media advertising campaigns. It supports role-based workflows with copywriters creating content, growth strategists reviewing submissions, and designers handling visual production.

## Recent Changes (January 2025)
- **Fixed ProjectView routing and layout issues**: Resolved parameter extraction from `/projects/:id` routes and restored missing sidebar navigation
- **Implemented workflow dashboard with stage cards**: Added 4-card overview showing New Tests, Pending Review, Ready to Deploy, and Completed stages with clickable drill-down functionality  
- **Added role-based UI controls**: New Test button visibility adapts to user permissions (visible for all roles with CREATE_TASK permission)
- **Enhanced project navigation**: Fixed project selection from sidebar links with proper state management and navigation flow
- **Resolved navigation and sidebar issues**: Fixed New Tests module card navigation to open statement editor directly via URL query parameters, added sidebar to statement editor, and restored missing delete test functionality
- **Implemented feature preservation workflow**: Added comprehensive mutation handling and UI restoration to prevent accidental feature removal during fixes
- **Added delete functionality to NewTestsView**: Implemented delete buttons directly on test cards in the New Tests page where users expect them, with confirmation dialogs and proper API integration
- **RESOLVED: Cross-project data contamination**: Fixed dashboard card navigation in ProjectView.tsx to include proper project context parameters, eliminating data leakage between different client projects
- **RESOLVED: Statement editor input field blocking**: Updated permission logic to allow Growth Strategists to edit their own draft statements while maintaining workflow integrity where they review others' submissions
- **Simplified project detection logic**: Replaced complex fallback strategies in NewTestsView.tsx with reliable useMemo approach using URL parameters and path matching
- **Implemented role refresh system**: Added comprehensive role caching fix with enhanced useAuth hook, /api/auth/refresh-role endpoint, and refresh button in sidebar to resolve multi-layer authentication caching issues
- **Enhanced Growth Strategist permissions**: Added MANAGE_USER_ROLES and ADD_MEMBERS permissions to growth_strategist role, enabling user management capabilities and role changes directly through the UI

# User Preferences

Preferred communication style: Simple, everyday language.

## Development Workflow Preferences
- **Feature Preservation Priority**: When fixing issues, always check for existing functionality that might be accidentally removed (e.g., delete buttons, mutations, UI components)
- **Comprehensive Testing**: Before marking fixes complete, verify all previously working features remain intact
- **Documentation First**: Always review existing code patterns and implementations before making changes to understand full scope of functionality

# System Architecture

## Frontend Architecture
The client is built with React and TypeScript using Vite as the build tool. The UI leverages shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling. The application uses Wouter for client-side routing and TanStack Query for server state management. The architecture follows a component-based pattern with clear separation between pages, reusable components, and utility functions.

## Backend Architecture
The server uses Express.js with TypeScript in an ESM setup. The API follows RESTful conventions with route handlers organized in a modular structure. The application implements middleware for authentication, request logging, and error handling. The server serves both API endpoints and static assets, with Vite integration for development hot reloading.

## Database Design
The application uses PostgreSQL with Drizzle ORM for type-safe database operations. The schema supports user management, project organization, and statement workflows. Key entities include users with role-based permissions, projects with client information, and statements with approval workflows. The database includes session storage for authentication and supports relational queries with proper indexing.

## Authentication System
Authentication is handled through Replit's OIDC integration using Passport.js strategies. The system maintains user sessions in PostgreSQL and supports automatic user creation/updates. Protected routes require authentication middleware, and the frontend handles auth state through React Query with automatic token management.

## File Storage Integration
The platform integrates with Google Cloud Storage for file uploads, particularly for background images used in colorblock generation. The system implements an object storage service with ACL (Access Control List) policies for fine-grained permissions. File uploads use presigned URLs for direct-to-cloud transfers with proper security controls.

## Visual Generation System
The application includes a canvas-based colorblock preview system that generates 1080x1080 pixel images suitable for social media advertising. The system supports custom typography with independent font sizing for heading, statement, and footer text, background colors, images, and text alignment. It uses HTML5 Canvas API for real-time preview rendering with export capabilities for approved designs. New statements automatically include placeholder text to guide users.

## Deployment Workflow System
The platform implements an automated deployment readiness detection system that monitors test batches for completion. When all statements in a test batch reach approved status, the system automatically triggers a DeploymentReadyDialog component to confirm deployment readiness. Once confirmed, test batches are marked with deployment status tracking (ready, deploying, deployed, failed) and timestamped with deployment ready dates. The DeploymentDashboard provides centralized management of ready-to-deploy tests with bulk export functionality for Facebook ad deployment. The system includes ZIP export capabilities for downloading approved colorblock images with sanitized filenames.

# External Dependencies

## Cloud Services
- **Google Cloud Storage**: File storage and management with ACL-based access control
- **Neon Database**: PostgreSQL hosting with connection pooling via @neondatabase/serverless
- **Replit Authentication**: OIDC-based user authentication and session management

## Third-party APIs
- **Slack Web API**: Integration for team notifications and workflow updates
- **Uppy File Uploader**: Drag-and-drop file upload interface with AWS S3 compatibility

## Development Tools
- **Drizzle Kit**: Database migrations and schema management
- **Vite**: Frontend build tool with HMR support
- **ESBuild**: Server-side bundling for production builds
- **TypeScript**: Type safety across frontend and backend with shared schema definitions