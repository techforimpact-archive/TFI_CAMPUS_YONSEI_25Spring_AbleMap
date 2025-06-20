# Overview

This is a React-based accessibility mapping application that helps users find and evaluate barrier-free locations. The application provides a map interface with POI (Point of Interest) markers, accessibility scoring, and user-generated content for places in Seoul's Sinchon area. It integrates with Kakao Maps API for location services and includes user authentication, bookmarking functionality, and image upload capabilities.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with shadcn/ui components for consistent design
- **State Management**: React Query for server state and React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Map Integration**: Kakao Maps JavaScript SDK for interactive maps

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API endpoints with JSON responses
- **Authentication**: Kakao OAuth integration for user login
- **File Handling**: Multer for image uploads with local file storage

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations
- **File Storage**: Local filesystem for images with organized directory structure
- **Object Storage**: Replit Object Storage integration for additional file handling

# Key Components

## Database Schema
- **places_accessibility**: Core place data with Kakao place IDs and accessibility scores
- **accessibility_reports**: Detailed accessibility analysis and AI-generated recommendations
- **place_images**: Image metadata linking to physical files
- **users**: User profiles with Kakao authentication
- **bookmarks**: User-place relationship tracking
- **categories**: Place categorization system

## Authentication System
- **Provider**: Kakao OAuth 2.0 REST API
- **Flow**: Authorization code flow with server-side token exchange
- **Storage**: Local storage for access tokens
- **State Management**: Real-time login status tracking across components

## Map Features
- **Base Layer**: Kakao Maps with normal and satellite views
- **Markers**: Custom markers for places with accessibility indicators
- **Search**: Real-time place search with autocomplete
- **Categories**: Filterable POI categories (restaurants, cafes, convenience stores, shopping)
- **Geolocation**: User location detection and map centering

## Accessibility Analysis
- **Scoring System**: 1-10 scale accessibility ratings
- **AI Analysis**: LLM-generated recommendations and observations
- **Image Analysis**: Computer vision for detecting stairs, ramps, and obstacles
- **Facility Information**: Structured data about accessibility features

# Data Flow

## Place Discovery
1. User searches or browses map categories
2. Kakao Maps API provides place data
3. Application checks internal database for accessibility information
4. Places are displayed with accessibility scores and markers

## Accessibility Reporting
1. Places are analyzed using image processing and AI
2. Results stored in accessibility_reports table
3. Images organized in place-specific directories
4. Scores and recommendations made available via API

## User Interactions
1. User authentication through Kakao OAuth
2. Bookmark management with real-time synchronization
3. Image uploads for community-contributed accessibility data
4. Analytics tracking for user behavior and engagement

# External Dependencies

## Required APIs and Services
- **Kakao Maps API**: Core mapping functionality and place search
- **Kakao OAuth API**: User authentication and profile access
- **Neon PostgreSQL**: Serverless database hosting
- **Amplitude Analytics**: User behavior tracking and marketing attribution

## Third-party Libraries
- **React Ecosystem**: React Router, React Query, React Hook Form
- **UI Components**: Radix UI primitives, Lucide icons
- **Utilities**: Zod for validation, date-fns for dates, clsx for styling

# Deployment Strategy

## Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Database**: PostgreSQL 16 module
- **Hot Reload**: Vite development server with HMR
- **Port Configuration**: Development on port 5000

## Production Build
- **Build Process**: Vite builds client, esbuild bundles server
- **Deployment Target**: Replit Autoscale with external port 80
- **Static Assets**: Client files served from dist/public directory
- **Environment Variables**: Database URL and API keys from Replit secrets

## Database Management
- **Migrations**: Drizzle Kit handles schema changes
- **Seeding**: Batch scripts for importing POI data
- **Backup**: Database state managed through migration files

# Changelog

Changelog:
- June 15, 2025. Initial setup

# User Preferences

Preferred communication style: Simple, everyday language.