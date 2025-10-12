# Fence Logic - Modern Glass Pool Fence Calculator

## Overview

Fence Logic is a web-based configurator tool for designing custom fencing and balustrade systems. The application provides an interactive visualization system combined with precise configuration controls, allowing users to design fence layouts, specify spans and gates, and generate automated component lists. The tool supports multiple product types (Glass Pool Fencing, Glass Balustrade, Aluminium Pool Fencing, Aluminium Balustrade, General Fencing) with product-specific configuration options, multiple fence shapes (1 section, 2 sections, 3 sections, 4 sections, and 5+ sections for custom configurations), and real-time calculation of required materials.

## User Preferences

Preferred communication style: Simple, everyday language.

## Product System

**Product Types & Variants (October 2025):**
- **Glass Pool Fencing**: Spigots (base-plate/core-drilled/side-mounted), Channel System (wall/ground mounting)
- **Glass Balustrade**: Frameless with Spigots, Channel, Standoffs
- **Aluminium Pool Fencing**: Tubular Flat Top, BARR, Blade, PIK
- **Aluminium Balustrade**: Barr, Blade, Visor
- **General Fencing**: Zeus, Blade, Barr

**Channel System Specifications:**
- Versatilt 4200mm aluminum channel (wall or ground mounted)
- Friction clamps positioned at 300mm centers
- End caps for channel termination
- Replaces spigot hardware in component calculations

**BARR Fencing Specifications (October 2025):**
- **Three Heights Available**: 1000mm, 1200mm, 1800mm
- **Panel Dimensions**:
  - 1000mm H × 1733mm W (50×25mm pickets)
  - 1200mm H × 2205mm W (50×25mm pickets)
  - 1800mm H × 1969mm W (50×25mm pickets)
- **Construction**: 50×25mm aluminum pickets with horizontal rails passing through punched holes, welded construction
- **Finishes**: Satin Black (CN150A), Pearl White (GA078A)
- **Gates**: 975mm post-mounted gates with D&D hardware
- **Posts**: 50x25mm (1200mm height), 50mm (1000mm/1800mm heights)
- **Post Types**: Welded base plate (1280mm), standard (1800mm/2500mm)
- **Layout Modes**: Full panels + cut end, Equally spaced (all cut)
- **Features**: Pre-inserted caps on pickets, N+1 post structure

**Blade Fencing Specifications (October 2025):**
- **Two Heights Available**: 1000mm, 1200mm
- **Panel Dimensions**:
  - 1000mm H × 1700mm W (50×16mm vertical blades)
  - 1200mm H × 2200mm W (50×16mm vertical blades)
- **Construction**: 50×16mm aluminum vertical blades with 40×40mm horizontal rails (inset 80mm from top/bottom)
- **Finishes**: Satin Black (CN150A), Pearl White (GA078A)
- **Gates**: 975mm post-mounted gates with D&D hardware
- **Posts**: 50×50mm square posts (all heights)
- **Post Types**: Welded base plate (1280mm), standard (1800mm/2500mm)
- **Layout Modes**: Full panels + cut end, Equally spaced (all cut)
- **Features**: Modern blade design, N+1 post structure, 15mm blade-to-post gap

**Glass Specifications:**
- **12mm Glass**: 300-1500mm width, 970mm height
- **15mm Glass**: 300-1400mm width, 1000mm height
- **15mm Standoff Glass**: 400-1200mm width, 1000mm height
  - 50mm diameter standoffs
  - Finishes: polished, satin, black, white

**Handrail Configuration System:**
- **Nonorail 25×21**: Stainless steel with polished/satin finishes
- **Nanorail 30×21**: Stainless steel with polished/satin finishes
- **Series Rail 35×35**: Anodised aluminium with black/white finishes

**Product Selection:**
- ProductSelector component allows switching between product variants
- Each product type has specific configuration options in SpanConfigPanel
- Component calculations adapt based on selected product (spigots vs. channel vs. posts)
- Product state persists through save/load operations

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
- **Info Tooltips**: Contextual help system using info icons (ⓘ) with hover tooltips:
  - Fence Shape Selector: Explains section count and configuration options
  - Section Configuration: Explains section layout, panels, gaps, gates, and special features
  - Section Length: Explains default 25mm gap for junctions, max 150mm for posts
  - Panel Configuration: Explains max panel width and gap spacing calculation
  - Gate Required: Explains gate hardware types, mounting styles, and positioning
  - Raked Panels: Explains step up panels for retaining walls and height changes with 1200mm fixed width
  - Custom Panel: Explains custom-sized panels with positioning controls

**Visualization System (V1 - Elevation Only):**
- Elevation view only (3D and plan views disabled for initial version)
- Canvas-based 2D side elevation rendering
- Panel labels show width and type (e.g., "1650 Panel", "1200 Hinge", "900 Gate", "1400H Rake")
- **Glass Panels**: Proportionate spigot rendering (50mm wide, 200mm height, 50mm gap below glass, positioned 10% from panel edge)
- **BARR Panels**: Vertical slat rendering with top/bottom rails, panels float 100mm above ground, posts extend to ground line
- BARR posts: N panels = N+1 posts (one before first panel, one after each panel)
- Gates do not display spigots (glass) or are rendered with BARR slat pattern
- Gate hardware (hinges and latches) positioned at panel edges
- Latch positioned at top ¼ of gate panel (75% height from ground)
- Inverted flip logic ensures hinges appear on correct side when gate is flipped
- Clean, modern visual design with Inter typography

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
- Supports raked panels (fixed 1200mm width for step ups at retaining walls/height changes)
- Gate integration with two mounting modes:
  - **Glass-to-glass**: Gate positioned by panel index (0, 1, 2, ...) with hinge panel included
  - **Wall/post-mounted**: Gate at start (position=0) or end (position=1) with no hinge panel
- Panel types: standard, raked (for step ups at retaining walls/height changes), gate, hinge, custom (tracked for visualization)
- **Custom Glass Panels**: Support for custom-sized glass panels with specific width and height dimensions:
  - Width: 200mm to maxPanelWidth (constrained by Max Panel Width setting, up to 2000mm max)
  - Height: 1200-1800mm
  - Custom panels are treated as fixed panels in layout calculations
  - Position controls allow moving custom panel left/right within the panel array
  - Visualization renders custom panels with distinct orange color and WIDTHxHEIGHT labels
  - Component list includes custom panels with format "Custom Glass Panel {width}mm x {height}mm (12mm thick)"
  - Panel calculation allows 0-1 variable panels when custom panel is enabled
  - Helper text displays current maximum width constraint from panel configuration
- **Gate Position Preservation**: savedGlassPosition field preserves panel index when switching between glass-to-glass and wall-mounted modes
- **Hardware-Specific Gate Gaps**: Automatic calculation of correct gaps based on hardware type and mounting:
  - Master Range wall-mounted: latch gap = 9mm (hinge side attached to wall)
  - Master Range glass-to-glass: hinge gap = 9mm, latch gap = 9mm
  - Polaris Soft Close wall-mounted: latch gap = 9mm (hinge side attached to wall)
  - Polaris Soft Close glass-to-glass: hinge gap = 8mm, latch gap = 9mm
  - Wall-mounted gates use single latch gap; glass-to-glass use both hinge and latch gaps
- **Flexible Gap Tolerance**: Algorithm allows up to 50mm total gap deviation to accommodate manufacturing constraints, panel increment rounding, and decimal gap measurements (e.g., 50.5mm gaps)
- **Intelligent Remainder Distribution**: Rounds panel remainders to nearest 50mm increment instead of rejecting non-divisible configurations
- **Gap Scoring**: Penalizes larger gap deviations to prefer configurations closest to target spacing while maintaining flexibility

**Visualization Features:**
- **Elevation View**: Canvas-based 2D rendering with panel size labels, spigot indicators (rectangles at base), and gate hardware visualization (hinges and latches)
- **Component List**: Auto-generated from panelLayout arrays, includes 2 spigots per panel, itemizes gate components (hinge panel, gate panel, hinge set, latch) based on mounting type

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