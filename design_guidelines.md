# Design Guidelines: Modern Glass Pool Fence Calculator

## Design Approach
**System-Based with Visual Enhancement**: Utility-focused configurator tool inspired by Linear's clean interface and Figma's tool precision, enhanced with 3D visualization. Prioritizes clarity, efficiency, and professional aesthetics over decorative elements.

## Core Design Principles
- **Precision First**: Every control provides immediate, accurate visual feedback
- **Progressive Disclosure**: Complex options revealed contextually as users configure
- **Visual Hierarchy**: 3D preview dominates, controls are accessible but secondary
- **Spatial Efficiency**: Maximum workspace for visualization, organized control panels

## Color Palette

**Light Mode:**
- Primary: 210 85% 45% (Professional blue for actions and highlights)
- Surface: 210 20% 98% (Near white backgrounds)
- Surface Elevated: 0 0% 100% (Pure white cards)
- Border: 210 20% 88% (Subtle dividers)
- Text Primary: 210 25% 15%
- Text Secondary: 210 15% 45%

**Dark Mode:**
- Primary: 210 95% 65% (Brighter blue for contrast)
- Surface: 210 20% 12% (Deep charcoal)
- Surface Elevated: 210 18% 16% (Elevated panels)
- Border: 210 15% 25% (Visible dividers)
- Text Primary: 210 10% 95%
- Text Secondary: 210 10% 65%

**Accent Colors:**
- Success (Valid Config): 142 70% 45%
- Warning (Constraint Issues): 38 90% 55%
- Error (Invalid): 0 75% 55%
- Gate Highlight: 280 65% 55% (Purple for gate elements)

## Typography
- **Primary Font**: Inter (via Google Fonts CDN)
- **Headings**: Inter 600 (Semibold)
  - H1: text-2xl (24px)
  - H2: text-xl (20px)
  - H3: text-lg (18px)
- **Body**: Inter 400 (Regular)
  - Base: text-base (16px)
  - Small: text-sm (14px)
  - Labels: text-sm font-medium
- **Monospace (Measurements)**: JetBrains Mono 500 for numerical inputs and dimensions

## Layout System

**Spacing Scale**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 24 for consistent rhythm
- Component padding: p-6 to p-8
- Section spacing: gap-8 to gap-12
- Tight spacing: gap-2 to gap-4
- Form controls: space-y-4

**Grid Structure**:
- Main Layout: 70/30 split (3D preview / Controls panel)
- Desktop: `grid grid-cols-[1fr_420px]`
- Tablet: Stack vertically with preview first
- Mobile: Full-width stacked

**Container Widths**:
- Maximum app width: w-full (edge-to-edge)
- Control panel: fixed 420px width
- Mobile: Full viewport width

## Component Library

### Interactive Controls
**Shape Selector**: 
- Large visual buttons with fence shape icons (Inline, L-Shape, U-Shape, Enclosed, Custom)
- Custom shape reveals numerical input (3-10 sides)
- Active state: primary color background with white icon

**Span Configuration Panel**:
- Collapsible sections per span (A, B, C, D...)
- Click to expand/focus selected span
- Active span highlighted in 3D preview

**Slider Controls** (Gap Size):
- Custom styled range input with value display
- Track: border color with primary fill
- Thumb: Primary color circle with shadow
- Live value tooltip above thumb
- Min/max labels at track ends

**Numerical Inputs** (End Gaps):
- Inline label + input + unit suffix (mm)
- Stepper buttons (+/-) integrated
- Focus state: primary border
- Validation: real-time with error states

**Gate Positioning**:
- Visual gate icon overlay on 3D preview
- Drag-to-position with snap guides
- Flip/Move controls as icon buttons below preview
- Position indicator showing distance from start

### 3D Visualization Area
**Canvas Container**:
- Full height of viewport minus header
- Dark gradient background (from surface to darker)
- Grid floor for depth perception
- Orbit controls (click-drag rotate, scroll zoom)
- Reset view button (top-right corner)

**Fence Rendering**:
- Glass panels: Semi-transparent with subtle reflections
- Posts: Solid with metallic appearance
- Gates: Highlighted with accent color
- Active span: Brightened/outlined when selected
- Measurements overlay: White text with dark background pills

### Component List Panel
**Parts Table**:
- Sticky header with column labels
- Zebra striping for readability
- Columns: QTY, Description, SKU
- Total count in footer
- Export to PDF/Email buttons

### Navigation & Actions
**Top Header Bar**:
- Logo/Brand (left)
- Progress indicator showing configuration completion %
- Save/Load Design buttons
- Dark mode toggle (top-right)

**Action Buttons**:
- Primary CTA: "Email Quote" (primary color, prominent)
- Secondary: "Save Design" (outline style)
- Tertiary: "Reset" (text only)

## Interaction Patterns

**Real-time Calculation**:
- Debounced input updates (300ms)
- Loading skeleton during calculations
- Smooth transitions between states

**Visual Feedback**:
- Panel count updates instantly
- Cost estimates (if applicable) animate
- Constraint violations show warning badges
- Success checkmarks for valid configurations

**Step Progression**:
1. Shape selection (visual icons)
2. Span configuration (expand/collapse)
3. Gate & hardware options (conditional)
4. Review & export (component list)

## Accessibility & UX
- Keyboard navigation: Tab through controls, Enter to toggle
- Focus indicators: 2px primary color ring
- Error messages: Icon + text below inputs
- Tooltips: On hover for technical terms
- Screen reader labels for all interactive elements

## Responsive Behavior

**Desktop (1280px+)**:
- Side-by-side preview and controls
- Full feature set visible

**Tablet (768px - 1279px)**:
- Stacked layout: Preview top, controls below
- Controls in tabs to save space

**Mobile (< 768px)**:
- Preview in modal/fullscreen mode
- Step-by-step wizard interface
- Bottom sheet for controls

## No Images Required
This is a functional tool - no decorative imagery needed. All visuals are generated by the 3D renderer showing the actual fence configuration.