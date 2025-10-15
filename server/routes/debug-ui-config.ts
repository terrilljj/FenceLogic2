import { Router, type Request, type Response } from "express";
import { type IStorage } from "../storage";

export function createDebugUIConfigRouter(storage: IStorage): Router {
  const router = Router();

  /**
   * GET /api/debug/ui-config/:variant/coverage
   * 
   * Inspect a specific UI Config variant and report which categoryPaths and subcategories
   * actually match active products, plus list any dead references.
   */
  router.get("/:variant/coverage", async (req: Request, res: Response) => {
    try {
      const { variant } = req.params;

      // Load the UI config for this variant
      const uiConfig = await storage.getUIConfig(variant);
      
      if (!uiConfig) {
        return res.status(404).json({ error: "variant_not_found" });
      }

      // Collect all referenced categoryPaths and subcategories from fieldConfigs
      const selectedPaths = new Set<string>();
      const selectedSubcategories = new Set<string>();

      // Process field configs
      for (const fieldConfig of uiConfig.fieldConfigs) {
        // Collect from dropdown option paths
        if (fieldConfig.optionPaths) {
          for (const paths of Object.values(fieldConfig.optionPaths)) {
            paths.forEach(path => selectedPaths.add(path));
          }
        }

        // Collect from toggle/other field category paths
        if (fieldConfig.categoryPaths) {
          fieldConfig.categoryPaths.forEach(path => selectedPaths.add(path));
        }
      }

      // Also collect from top-level allowedSubcategories
      if (uiConfig.allowedSubcategories) {
        uiConfig.allowedSubcategories.forEach(sub => selectedSubcategories.add(sub));
      }

      // Query active products
      const allProducts = await storage.getAllProducts();
      const activeProducts = allProducts.filter(p => p.active === 1);

      // Count matches for each path
      const pathCounts: { path: string; count: number }[] = [];
      const deadPaths: string[] = [];

      for (const path of Array.from(selectedPaths)) {
        const count = activeProducts.filter(p => 
          p.categoryPaths?.includes(path)
        ).length;
        
        pathCounts.push({ path, count });
        
        if (count === 0) {
          deadPaths.push(path);
        }
      }

      // Count matches for each subcategory
      const subcategoryCounts: { subcategory: string; count: number }[] = [];
      const deadSubcategories: string[] = [];

      for (const subcategory of Array.from(selectedSubcategories)) {
        const count = activeProducts.filter(p => 
          p.subcategory === subcategory
        ).length;
        
        subcategoryCounts.push({ subcategory, count });
        
        if (count === 0) {
          deadSubcategories.push(subcategory);
        }
      }

      // Build response
      const response = {
        variant,
        selectedPaths: Array.from(selectedPaths),
        selectedSubcategories: Array.from(selectedSubcategories),
        pathCounts: pathCounts.sort((a, b) => b.count - a.count), // Sort by count descending
        subcategoryCounts: subcategoryCounts.sort((a, b) => b.count - a.count),
        deadPaths,
        deadSubcategories,
      };

      res.json(response);
    } catch (error) {
      console.error("Error in debug UI config coverage:", error);
      res.status(500).json({ error: "internal_server_error" });
    }
  });

  return router;
}
