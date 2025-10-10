# Fence Builder - Modern Glass Pool Fence Calculator

## Overview

Fence Builder is a web-based configurator tool for designing custom glass pool fences. The application provides an interactive 3D visualization system combined with precise configuration controls, allowing users to design fence layouts, specify spans and gates, and generate automated component lists. The tool supports multiple fence shapes (inline, L-shape, U-shape, enclosed, and custom configurations) with real-time visual feedback and calculation of required materials.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18+ with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching

**UI Framework:**
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Custom theme system supporting light/dark modes with CSS variables
- Typography: Inter font family for UI, JetBrains Mono for numerical inputs

**Design System:**
- Linear/Figma-inspired clean interface with precision-first approach
- Progressive disclosure pattern for complex configuration options
- Custom color palette with semantic HSL values for light/dark themes
- Consistent spacing scale using Tailwind units (2, 4, 6, 8, 12, 16, 24)

**3D Visualization:**
- Three.js integration for real-time 3D fence rendering
- Interactive camera controls with mouse-based rotation
- Material visualization with transparency for glass panels
- Visual highlighting for active spans and gate configurations

**State Management:**
- Local React state for fence design configuration
- Form state managed through react-hook-form with Zod validation
- Query client for API data fetching and caching
- Theme persistence in localStorage

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript for type-safe API development
- ESM module system throughout the codebase
- Custom middleware for request logging and error handling

**API Design:**
- RESTful endpoints for fence design CRUD operations
- JSON request/response format
- Zod schema validation for data integrity
- Error responses with appropriate HTTP status codes

**Data Storage:**
- In-memory storage implementation (MemStorage class) for development
- IStorage interface defining storage contract for future implementations
- Designed to support PostgreSQL through Drizzle ORM (configuration present)
- UUID-based resource identification

**Data Models:**
- FenceDesign: Main entity containing shape, spans, and configuration
- SpanConfig: Individual fence section with length, panels, gaps, and gates
- Component: Generated parts list with SKU, descriptions, and quantities
- PanelLayout: Calculated panel widths and gaps with panel type identification
- Support for complex gate configurations (hardware types, hinge positions)

**Panel Calculation System:**
- Mixed panel width algorithm distributes variable panels to achieve exact gap spacing
- Supports raked panels (fixed 1200mm width for slopes/stairs)
- Gate integration with two mounting modes:
  - **Glass-to-glass**: Gate positioned by panel index (0, 1, 2, ...) with hinge panel included
  - **Wall/post-mounted**: Gate at start (position=0) or end (position=1) with no hinge panel
- Panel types: standard, raked, gate, hinge (tracked for visualization)
- **Gate Position Preservation**: savedGlassPosition field preserves panel index when switching between glass-to-glass and wall-mounted modes

### Development Workflow

**Build Process:**
- Separate client and server builds
- Vite for frontend bundling with React plugin
- esbuild for server-side bundling (ESM format)
- TypeScript compilation checking without emit

**Development Environment:**
- Hot module replacement (HMR) for instant frontend updates
- Vite middleware mode for integrated dev server
- Replit-specific plugins for error overlay and development banner
- Path aliases for clean imports (@/, @shared/, @assets/)

**Code Organization:**
- Monorepo structure with shared types between client/server
- Component-based architecture with UI primitives
- Feature-based organization for fence builder functionality
- Centralized schema definitions for data validation

### External Dependencies

**Database:**
- Drizzle ORM configured for PostgreSQL via Neon serverless driver
- Schema defined in shared directory for client/server access
- Migration support through drizzle-kit
- Connection via DATABASE_URL environment variable

**UI Components:**
- Extensive Radix UI primitive collection for accessible components
- shadcn/ui configuration for consistent component styling
- Custom component variants using class-variance-authority
- Tailwind merge for dynamic className composition

**Validation & Forms:**
- Zod for runtime type validation and schema generation
- React Hook Form for form state management
- @hookform/resolvers for Zod integration
- drizzle-zod for automatic schema generation from database models

**Utilities:**
- date-fns for date manipulation
- clsx and tailwind-merge for className utilities
- nanoid for unique ID generation
- Three.js types for 3D visualization

**Development Tools:**
- Replit-specific Vite plugins for enhanced development experience
- TypeScript strict mode for type safety
- ESLint/Prettier configuration implied by project structure