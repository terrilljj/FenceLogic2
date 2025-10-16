# Fence Logic - Modern Glass Pool Fence Calculator

## Overview

Fence Logic is a web-based configurator tool for designing custom fencing and balustrade systems. It offers interactive visualization and precise configuration controls, allowing users to create fence layouts, specify spans and gates, and generate automatic component lists. The tool supports various product types, including Glass Pool Fencing, Glass Balustrade, Aluminium Fencing, and PVC Fencing, with product-specific options and multiple fence shapes. Its primary goal is to streamline the design process and provide accurate material calculations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18+ with TypeScript, Vite, Wouter for routing, and TanStack Query for server state.
- UI built with shadcn/ui (Radix UI + Tailwind CSS), custom theme system (light/dark modes), and Inter/JetBrains Mono fonts.
- Info tooltips provide contextual help.

**Visualization System (V1 - Elevation Only):**
- Canvas-based 2D side elevation rendering for proportionate representations of panels, posts, rails, and hardware across all product types.
- Includes visual representation of top-mounted rails and gate hardware with inverted flip logic.

**State Management:**
- Local React state for configuration.
- `react-hook-form` with Zod for form validation.
- Query client for API data.
- Theme persistence in localStorage.

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript and ESM.
- Custom middleware for logging and error handling.

**API Design:**
- RESTful endpoints for fence design CRUD operations using JSON.
- Zod schema validation.

**Data Storage:**
- In-memory storage for development, adhering to an `IStorage` interface.
- Configured for PostgreSQL via Drizzle ORM.
- UUID-based resource identification.

**Data Models:**
- `FenceDesign`, `SpanConfig`, `Component`, `PanelLayout`.
- `Product`: Stores product catalog information (code, description, price, category paths, physical specs, metadata).
- `ProductUIConfig`: Defines UI configuration for product variants (field visibility, position, labels, tooltips), field mapping to product codes, and numeric field SKU snapping.
- Supports complex gate configurations and custom glass panels.

**Admin Authentication:**
- Session-based authentication for admin panel access (protected routes with `requireAdmin` middleware).
- Login, verify, and logout endpoints.
- Session configured for Replit iframe support (`trust proxy: 1`, `sameSite: "none"`, `secure: true`, `httpOnly: true`).
- Admin panel accessible at `/admin-login`.
- **Product Catalog Management** at `/products` and **Category Manager** at `/categories` (CRUD operations for categories/subcategories with display order control and transactional deletion).
- **UI Configuration portal** at `/ui-config` for defining product groups, field visibility, order, labels, tooltips, and SKU selection behavior.

**Panel Calculation System:**
- Algorithm for mixed panel widths and precise gap spacing.
- Supports raked panels and integrates gates with hardware-specific gap calculations.
- **End Gap Policy System** (`shared/calc/compose.ts`):
  - Default: `LOCKED_OR_RESIDUAL` - tries exact requested end gap first, falls back to computed residual if impossible on 50mm grid
  - Strict mode: `LOCKED_STRICT` via env flag `STRICT_END_GAP=1` - fails with UNREACHABLE if exact end gap impossible
  - Always reports variance from requested end gap in response
  - Provisional target rounded DOWN to nearest 50mm to prevent panel overflow
- **Length Conservation**: Strict ±1mm tolerance for gate scenarios, ±2mm for non-gate
- **Panel Equalization on 50mm Grid**:
  - `equalizePanelsExact()` (`shared/calc/equalize.ts`): Distributes panels on fixed 50mm steps with min/max bounds
  - `findFeasibleN()`: Searches for optimal panel count that achieves target on grid
  - Ensures all panels are multiples of 50mm
  - Integrated into `composeFenceSegments` with proper length accounting

**Numeric Field SKU Selection System:**
- **SKU Selector Service**: Extracts width from product codes, performs tolerance-based matching and snapping to standard sizes.
- Integrates with numeric fields for automatic SKU selection, fallback to UI config defaults, and context filtering.
- **Feature Flag HINGE_AUTO_ENABLED**: Controls hinge panel auto-sizing (default: '0' = disabled). When off, requires explicit hinge widths. Gate fields unaffected. UI banner shown when disabled. API endpoint `/api/feature-flags` exposes status.

### Development Workflow

**Build Process:**
- Separate client (Vite) and server (esbuild) builds.
- TypeScript compilation checking.

**Development Environment:**
- HMR for frontend, Vite middleware mode, Replit-specific plugins.
- Path aliases (`@/`, `@shared/`, `@assets/`).

**Code Organization:**
- Monorepo structure with shared types.
- Component-based, feature-based organization, centralized schema definitions.

## External Dependencies

**Database:**
- Drizzle ORM for PostgreSQL (via Neon serverless driver).
- `drizzle-kit` for migrations.

**UI Components:**
- Radix UI primitives, shadcn/ui.
- `class-variance-authority`, `tailwind-merge`.

**Validation & Forms:**
- Zod for runtime type validation.
- React Hook Form for form state management.
- `@hookform/resolvers` for Zod integration.
- `drizzle-zod` for schema generation from database models.

**Utilities:**
- `date-fns` for date manipulation.
- `clsx`, `nanoid`.

**Data Hygiene Linting:**
- Product Data Linter (`server/scripts/lint-products.ts`) to detect dead category paths, dead subcategories, and orphan SKUs.