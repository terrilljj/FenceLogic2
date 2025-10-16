/**
 * Gate Mode Shim - Resolver-side logic to map gate mounting modes to product subcategories
 * 
 * This shim bridges the gap between frontend gate configuration and product catalog
 * until UI config mappings are fully implemented in the admin panel.
 */

export type GateMode = 'GLASS_TO_GLASS' | 'POST' | 'WALL';
export type GateSystem = 'MASTER' | 'POLARIS';

export interface GateModeMapping {
  includeSubcats: string[];
  excludeSubcats: string[];
  includePaths?: string[];
  excludePaths?: string[];
}

/**
 * Map gate mode and system to catalog subcategories for product resolution
 * 
 * @param variantKey - The product variant (e.g., 'glass-pool-spigots')
 * @param mode - Gate mounting mode (GLASS_TO_GLASS, POST, or WALL)
 * @param system - Gate hardware system (MASTER or POLARIS)
 * @returns Mapping with subcategories/paths to include/exclude
 */
export function mapGateModeToCatalog(
  variantKey: string,
  mode: GateMode,
  system: GateSystem
): GateModeMapping {
  // Only apply shim for frameless glass pool fence variants
  if (!variantKey.includes('pool') && !variantKey.includes('spigot')) {
    return { includeSubcats: [], excludeSubcats: [] };
  }

  const isMaster = system === 'MASTER';

  switch (mode) {
    case 'GLASS_TO_GLASS':
      // Glass-to-glass gates require hinge panels (no posts)
      return {
        includeSubcats: [
          // Gate hardware based on system
          isMaster ? 'Gate Master' : 'Gate Polaris/Atlantic',
          // Hinge panels based on system
          isMaster ? 'Hinge Panels Master' : 'Hinge Panels Polaris/Atlantic',
        ],
        excludeSubcats: [
          // Explicitly exclude post-mounted hardware
          'Posts',
          'Gate to Post Hardware',
          'Post Anchors',
          // Exclude the opposite system's products
          isMaster ? 'Gate Polaris/Atlantic' : 'Gate Master',
          isMaster ? 'Hinge Panels Polaris/Atlantic' : 'Hinge Panels Master',
        ],
      };

    case 'POST':
      // Post-mounted gates require posts and gate hardware (no hinge panels)
      return {
        includeSubcats: [
          // Gate hardware based on system
          isMaster ? 'Gate Master' : 'Gate Polaris/Atlantic',
          // Post mounting hardware
          'Posts',
          'Gate to Post Hardware',
          'Post Anchors',
        ],
        excludeSubcats: [
          // Explicitly exclude glass-to-glass hinge panels
          'Hinge Panels Master',
          'Hinge Panels Polaris/Atlantic',
          // Exclude the opposite system's products
          isMaster ? 'Gate Polaris/Atlantic' : 'Gate Master',
        ],
      };

    case 'WALL':
      // Wall-mounted gates require wall hardware and gate hardware (no hinge panels)
      return {
        includeSubcats: [
          // Gate hardware based on system
          isMaster ? 'Gate Master' : 'Gate Polaris/Atlantic',
          // Wall mounting hardware (fallback to Posts if Gate to Wall Hardware doesn't exist)
          'Gate to Wall Hardware',
          'Posts', // Fallback - many systems use posts for both wall and post mounting
          'Wall Anchors',
        ],
        excludeSubcats: [
          // Explicitly exclude glass-to-glass hinge panels
          'Hinge Panels Master',
          'Hinge Panels Polaris/Atlantic',
          // Exclude the opposite system's products
          isMaster ? 'Gate Polaris/Atlantic' : 'Gate Master',
        ],
      };

    default:
      return { includeSubcats: [], excludeSubcats: [] };
  }
}

/**
 * Normalize gate system string to GateSystem type
 */
export function normalizeGateSystem(system: any): GateSystem {
  if (!system) return 'MASTER';
  
  const normalized = String(system).toUpperCase();
  if (normalized.includes('POLARIS') || normalized.includes('ATLANTIC')) {
    return 'POLARIS';
  }
  
  return 'MASTER';
}

/**
 * Normalize gate mode string to GateMode type
 */
export function normalizeGateMode(mode: any): GateMode | null {
  if (!mode) return null;
  
  const normalized = String(mode).toUpperCase().replace(/[_-]/g, '_');
  
  if (normalized.includes('GLASS')) {
    return 'GLASS_TO_GLASS';
  }
  if (normalized === 'POST' || normalized.includes('POST')) {
    return 'POST';
  }
  if (normalized === 'WALL' || normalized.includes('WALL')) {
    return 'WALL';
  }
  
  return null;
}
