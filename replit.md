# Fence Logic - Modern Glass Pool Fence Calculator

## Overview

Fence Logic is a web-based configurator tool designed for creating custom fencing and balustrade systems. It provides interactive visualization and precise configuration controls, enabling users to design fence layouts, specify spans and gates, and automatically generate component lists. The tool supports various product types including Glass Pool Fencing, Glass Balustrade, Aluminium Fencing (Pool, Balustrade, General), and PVC Fencing, with product-specific configuration options and multiple fence shapes. Its core purpose is to streamline the design process and provide accurate material calculations.

## User Preferences

Preferred communication style: Simple, everyday language.

## Product System

**Supported Products:**
- **Glass Pool Fencing & Balustrade**: Spigots, Channel mounting, Standoffs
  - **Top-Mounted Rail (Balustrade only)**: Optional handrail system with 3 rail types
    - 25×21mm NonoRail (12mm glass only)
    - 30×21mm NanoRail (universal)
    - 35×35mm Series 35 (universal)
  - **Rail Materials**: Stainless Steel, Anodised Aluminium
  - **Rail Finishes**: Polished, Satin, Black, White
  - **Rail Terminations**: End Cap, Wall Tie, 90° Corner, Adjustable Corner
  - **Rail Optimization**: 5800mm standard lengths with automatic wastage minimization across multiple sections
- **Aluminium Fencing**: BARR (vertical slats), Blade (modern design), Tubular Flat Top
- **Hamptons PVC Fencing**: 5 style variants with 2388mm standard panels and 127mm square posts
  - Full Privacy (1800mm): Solid privacy panels
  - Combo (1800mm): Solid bottom with slat topper
  - Vertical Paling (1800mm): Vertical slats with gaps
  - Semi Privacy (1000mm): Horizontal slats with gaps
  - 3 Rail (1525mm): Three horizontal rails
- **Layout Modes**: Full panels + cut end, Equally spaced (all cut) for aluminium and PVC products
- **Gate Support**: All products support 1000mm gates with hardware integration

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18+ with TypeScript
- Vite for building and development
- Wouter for routing
- TanStack Query for server state management
- shadcn/ui (Radix UI + Tailwind CSS) for UI components and styling
- Custom theme system with light/dark modes
- Inter (UI) and JetBrains Mono (numerical inputs) font families
- Info tooltips for contextual help across various configuration elements.

**Visualization System (V1 - Elevation Only):**
- Canvas-based 2D side elevation rendering.
- Displays proportionate representations of glass panels (with spigots), and various aluminium and PVC panel types (BARR, Blade, Tubular, Hamptons PVC) with appropriate posts, rails, and hardware.
- Top-mounted rails shown on glass balustrades when enabled (thin horizontal line at top of panels).
- N+1 post structure for aluminium products.
- Gate hardware (hinges, latches) is visually represented, with inverted flip logic for correct hinge placement.

**State Management:**
- Local React state for configuration.
- `react-hook-form` with Zod validation for form state.
- Query client for API data.
- Theme persistence in localStorage.

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript.
- ESM module system.
- Custom middleware for logging and error handling.

**API Design:**
- RESTful endpoints for fence design CRUD operations.
- JSON format for requests/responses.
- Zod schema validation.
- Error responses with appropriate HTTP status codes.

**Data Storage:**
- In-memory storage (MemStorage class) for development, adhering to an `IStorage` interface for future extensibility.
- Configured for PostgreSQL via Drizzle ORM.
- UUID-based resource identification.

**Data Models:**
- `FenceDesign`, `SpanConfig`, `Component`, `PanelLayout`.
- `Product` - Product catalog with comprehensive fields:
  - **Core fields**: code, description, category, subcategory, price, active status
  - **Selection identifiers**: selectionId (legacy snake_case), categoryPaths (hierarchical array)
  - **Physical specs**: weight, dimensions, units
  - **Metadata**: tags (array), notes (internal), imageUrl
  - All optional fields support CSV import/export
- `ProductUIConfig` - UI configuration for product variants (field visibility, position, labels, tooltips):
  - **Field mapping**: optionPaths (hierarchical category paths), categoryPaths for toggle fields
  - **Legacy support**: optionProducts, products (deprecated, use category paths instead)
  - **Path format**: Hierarchical slash-separated (e.g., `pool_fence/frameless/glass_panels`, `pool_fence/frameless/master_gate`)
  - Products automatically resolved by matching categoryPaths array
- Supports complex gate configurations (hardware types, hinge positions) and custom glass panels (width, height, positioning, distinct visualization).
- Top rail configurations with type, material, finish, and termination options.

**Admin Authentication:**
- Session-based authentication for admin panel access.
- Protected routes verify server session (not just localStorage).
- Login endpoint: POST /api/admin/login (custom credentials via ADMIN_USERNAME/ADMIN_PASSWORD env vars).
- Session verification: GET /api/admin/verify.
- Logout endpoint: POST /api/admin/logout.
- All product CRUD and CSV endpoints protected by `requireAdmin` middleware.
- Session configuration for iframe support:
  - `trust proxy: 1` enabled for Replit iframe context
  - `sameSite: "none"` and `secure: true` for third-party cookie support
  - `httpOnly: true` for security
  - 24-hour expiry
- Credentials include "include" on all fetch requests for proper cookie handling.
- Admin panel accessible at `/admin-login` (direct URL, not in navigation).
- Product catalog management at `/products` (requires authentication).
- **Category Manager** at `/categories` (requires authentication):
  - Database-driven category and subcategory management system
  - Full CRUD operations (Create, Read, Update, Delete) for both categories and subcategories
  - Display order control for organizing taxonomy hierarchy
  - Database tables: `categories` and `subcategories` with id, name, displayOrder fields
  - Transactional deletion with automatic cleanup:
    - When category/subcategory is deleted, atomically removed from all UI configs using SQL
    - JSONB `?` operator checks containment, COALESCE ensures empty arrays instead of NULL
    - Transaction wraps UPDATE (cleanup) and DELETE operations for atomicity
  - Storage by name (not ID) in UI config JSONB arrays
  - Current subcategories include: Spigots, Channel, Standoffs, BARR, Blade, Tubular, PIK, Visor, Zeus, Gate Master, Gate Polaris/Atlantic, Raked, Hinge Panels Master, Hinge Panels Polaris/Atlantic, and Hamptons variants
  - Accessible from Products page navigation
- UI Configuration portal at `/ui-config` (requires authentication):
  - **Product Groups Selection**: Define which product categories and subcategories apply to each variant
    - Categories fetched dynamically from database (not hardcoded)
    - Subcategories fetched dynamically from database (not hardcoded)
    - Multi-select checkboxes for both categories and subcategories
    - Selections persist independently per variant in database
  - Configure which input fields appear for each product variant
  - Control field visibility (toggle on/off)
  - Set field display order/position
  - Customize field labels and tooltip text
  - Product mapping system:
    - Dropdown fields: Map each option value to specific product codes (e.g., "12mm" → [PROD-1, PROD-2])
    - Toggle fields: Associate products directly with the feature (e.g., Gate Config → [GATE-1, GATE-2])
    - Supports both text and numeric dropdowns (max-panel-width, glass-thickness, etc.)
  - Tab-based interface for 13 product variants
  - Saves configurations to database with JSONB storage (allowedCategories, allowedSubcategories, fieldConfigs)

**Panel Calculation System:**
- Algorithm for mixed panel widths to achieve precise gap spacing.
- Supports raked panels (fixed 1200mm width for height changes).
- Integrates gates with glass-to-glass and wall/post-mounted modes, preserving position during mode switches.
- Automatic calculation of hardware-specific gate gaps (e.g., Master Range, Polaris Soft Close).
- Flexible gap tolerance (up to 50mm deviation) and intelligent remainder distribution for manufacturing constraints.
- Gap scoring penalizes larger deviations.

### Development Workflow

**Build Process:**
- Separate client (Vite) and server (esbuild) builds.
- TypeScript compilation checking.

**Development Environment:**
- HMR for frontend.
- Vite middleware mode for integrated dev server.
- Replit-specific plugins for error overlay and development banner.
- Path aliases (`@/`, `@shared/`, `@assets/`).

**Code Organization:**
- Monorepo structure with shared types.
- Component-based architecture with UI primitives.
- Feature-based organization.
- Centralized schema definitions.

## External Dependencies

**Database:**
- Drizzle ORM for PostgreSQL (via Neon serverless driver).
- `drizzle-kit` for migrations.

**UI Components:**
- Radix UI primitives.
- shadcn/ui.
- `class-variance-authority` for component variants.
- `tailwind-merge` for dynamic class names.

**Validation & Forms:**
- Zod for runtime type validation and schema generation.
- React Hook Form for form state management.
- `@hookform/resolvers` for Zod integration.
- `drizzle-zod` for automatic schema generation from database models.

**Utilities:**
- `date-fns` for date manipulation.
- `clsx` and `tailwind-merge` for class name utilities.
- `nanoid` for unique ID generation.
- Three.js types (for potential future 3D visualization).