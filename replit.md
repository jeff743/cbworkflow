# Overview

CB Workflow is a CRO (Conversion Rate Optimization) agency management platform designed to streamline the colorblock creation process for Facebook ads testing. The application allows teams to manage projects, create and review marketing statements, and generate visual colorblocks for social media advertising campaigns. It supports role-based workflows with copywriters creating content, growth strategists reviewing submissions, and designers handling visual production.

# User Preferences

Preferred communication style: Simple, everyday language.

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
The application includes a canvas-based colorblock preview system that generates 1080x1080 pixel images suitable for social media advertising. The system supports custom typography, background colors, images, and text alignment. It uses HTML5 Canvas API for real-time preview rendering with export capabilities for approved designs.

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