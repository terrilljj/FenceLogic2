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
- **PDF Export**: Download fence visualization as PDF for printing or sharing (captures canvas and opens print dialog).

**State Management:**
- Local React state for configuration.
- `react-hook-form` with Zod for form validation.
- Query client for API data.
- Theme persistence in localStorage.
- **Add Section Feature**: Users can incrementally add fence sections without losing work (auto-generates sequential IDs, copies last section's settings).

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

**Google Sheets OAuth Sync:**
- **Secure credential storage**: AES-256-GCM encryption with auto-generated 32-byte keys, ENV-first fallback to encrypted file storage.
- **OAuth flow**: Google OAuth 2.0 with refresh token persistence in `systemSettings` database table.
- **Admin settings page** at `/admin-settings`: Configure OAuth credentials, connect to Google, manage sync settings.
- **Sync endpoints**: `/api/admin/sheets/pull?dryRun=1|0` for preview-before-apply workflow with diff visualization.
- **Diff engine**: Compares Google Sheets data with database, identifies added/updated/deactivated products and UI config changes.
- **Data validation**: Zod schemas validate sheet data before sync, with detailed error reporting.
- **Sync UI**: Products page includes "Sync from Google Sheets" button with diff preview dialog showing summary stats and sample changes.
- **Bug fix (Oct 2025)**: Blank "Active" cells now correctly default to `true` via `parseBoolOrUndefined` helper, preventing mass deactivations.
- **Logging**: Sync operations write JSON and markdown logs to `./logs/sync-{timestamp}.{json,md}` for audit trail.
- **Test coverage**: Config encryption tests (`server/utils/config.test.ts`) and row parsing regression tests (`server/utils/rows.test.ts`).

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
- **Panel Layout Scoring** (`shared/panelCalculations.ts`):
  - Strongly prefers fewer panels (penalty: 500 per panel) to maintain layout stability
  - Accepts up to 100mm gap variance from equalization (50mm grid constraint)
  - Prioritizes configurations with required components (gates, custom panels) first
- **Custom Frameless Spigots Auto-Calculator**:
  - Auto-calculates optimal panel count based on max panel width constraint
  - Panel type options: Standard Glass (auto-sized), Gate Panel (customizable width, default 900mm), Hinge Panel (customizable width, default 1200mm), Custom Width (any specific width, default 1000mm)
  - Individual gap controls: Default gap applies to all, with override capability for each gap
  - Standard panels auto-distribute space around fixed-width panels (Gate/Hinge/Custom)
  - Real-time visualization and component list updates

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