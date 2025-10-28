# Fence Logic - Modern Glass Pool Fence Calculator

## Overview

Fence Logic is a web-based configurator tool for designing custom fencing and balustrade systems.

## Pending Tasks (Oct 2025)

### Handrail Configuration Modules
**Status**: Awaiting user specifications  
**Request**: Different handrail types need separate config modules since they don't all have the same variables.  
**Action Required**: User needs to provide:
- List of all handrail/top rail types offered
- Specific variables/fields each type requires (e.g., height offset, profile type, finish, mounting specs, drilling specs, etc.)
- Once provided, create dedicated configuration modules for each handrail type with appropriate fields

### Glass-Type-Dependent Max Panel Widths
**Status**: Schema created, implementation pending  
**Request**: Max panel width in database should differentiate by glass type (12x970, 15x1000, 17.52x1100, 15x1280).  
**Approach**: Created `style_field_constraints` table for conditional constraints based on glass selection.  
**Action Required**: Implement constraint rules for each fence style that links glassThickness to maxPanelMm limits.

---

Fence Logic is a web-based configurator tool for designing custom fencing and balustrade systems. It offers interactive visualization and precise configuration controls, allowing users to create fence layouts, specify spans and gates, and generate automatic component lists. The tool supports various product types, including Glass Pool Fencing, Glass Balustrade, Aluminium Fencing, and PVC Fencing, with product-specific options and multiple fence shapes. Its primary goal is to streamline the design process and provide accurate material calculations.

**New Centralized Configuration System (Oct 2025):**
- Fence styles managed via database (`fence_styles` table) with feature toggles (gates, top rail, hinge panels, custom width) and panel width constraints (minPanelWidth, maxPanelWidth)
- Product mappings use slot-based system (`style_product_slots`) allowing products to be reused across multiple styles
- **Calculator fields are database entries** (`style_calculator_fields`) that determine what calculations each style can perform - NOT from CSV imports
- Each calculator field includes: type (number/select), label, min/max/step/default, unit, tooltip, and section grouping (Core/Gate/Custom Panel)
- Calculator UI reads directly from fence style system via `/api/styles/:code/calculator-config` endpoint
- CSV template imports auto-link products to fence styles via `templateId` matching
- Admin UI at `/styles` lists all styles, `/config/:styleCode` provides tabbed interface for Products, Calculator Settings, and Features

## User Preferences

Preferred communication style: Simple, everyday language.

**Admin Credentials:**
- Username: fencelogic
- Password: 7677fencelogic.

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
- `FenceStyle`: Central configuration table with feature toggles and panel width constraints (minPanelWidth: 250mm, maxPanelWidth: 2000mm).
- `StyleCalculatorField`: Database entries defining calculator inputs for each fence style (16 fields for pool spigots: 6 core, 7 gate, 3 custom panel).
- `StyleProductSlot`: Slot-based product mappings allowing product reuse across multiple fence styles.
- `ProductUIConfig`: Legacy UI configuration (being migrated to fence style system).
- Supports complex gate configurations and custom glass panels.

**Admin Authentication:**
- Session-based authentication for admin panel access (protected routes with `requireAdmin` middleware).
- Login, verify, and logout endpoints.
- Session configured for Replit iframe support (`trust proxy: 1`, `sameSite: "none"`, `secure: true`, `httpOnly: true`).
- Admin panel accessible at `/admin-login`.
- **Product Catalog Management** at `/products` and **Category Manager** at `/categories`:
  - Hierarchical structure: Categories represent fence styles (e.g., "Glass Pool Fence", "Aluminium Slat Fence")
  - Subcategories represent components/variants within each fence style (e.g., "Raked Panels", "Gate Master", "Hinge Panels Soft")
  - Each subcategory belongs to one category via `categoryId` foreign key
  - CRUD operations for both categories and subcategories with display order control
  - Transactional deletion prevents orphaned data
  - Category selector in subcategory forms for linking to parent category
  - Table view shows category association for each subcategory
- **UI Configuration portal** at `/ui-config` for defining product groups, field visibility, order, labels, tooltips, and SKU selection behavior.
- **Slot Manager** at `/slot-manager` for self-service product catalog management:
  - Slot-based system with configurable unique prefixed IDs (GP-0001, RP-0002, etc.)
  - Configurable "Unique Prefix" field per field type (auto-populates with defaults, max 10 chars)
  - Define slot counts per field type for each product variant (e.g., 36 Glass Panels, 20 Spigots)
  - Manual product mapping via dropdown selection for each slot
  - Real-time status tracking: Mapped vs Unmapped badges
  - Bulk slot generation with warning about clearing existing mappings
  - Individual slot deletion
  - Isolated from main UI Config to prevent accidental production changes
  - Backend: `product_slots` table with variant, fieldName, internalId (unique prefixed), and productId columns
  - Public API endpoints: `/api/product-slots/:variant` (GET slot mappings), `/api/products/lookup` (GET products by IDs)
  - Admin API endpoints: Generate slots (POST with prefix validation), list slots (GET), update mapping (PUT), delete slots (DELETE)
  - Product lookup via regex matching panel widths in descriptions (e.g., "1200mm" or "1200W")
  - Supports multi-style product reuse (same product can map to multiple fence styles)
  - Backend validates prefix length (max 10 chars) and auto-uppercases input

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
- **Calculator Dependencies** (from `style_calculator_fields` database entries):
  - Core (6): runLengthMm, startGapMm, endGapMm, betweenGapMm, minPanelMm, maxPanelMm
  - Gate (7): gateWidthMm, hingePanelWidthMm, hingeGapMm, latchGapMm, mountMode, hingeSide, gatePosition
  - Custom Panel (3): customPanelWidthMm, gapBeforeMm, gapAfterMm
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