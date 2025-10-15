import { Router, type Request, type Response } from "express";
import { type IStorage } from "../storage";

export function createDebugProductsLintRouter(storage: IStorage): Router {
  const router = Router();

  /**
   * GET /api/debug/products-lint
   * 
   * Detect active products that are unreachable by any UI config (orphans),
   * and summarize referenced paths/subcategories across all variants.
   */
  router.get("/", async (req: Request, res: Response) => {
    try {
      // Load all UI configs
      const allConfigs = await storage.getAllUIConfigs();
      
      // Aggregate all referenced category paths and subcategories
      const allReferencedPaths = new Set<string>();
      const allReferencedSubcategories = new Set<string>();

      for (const config of allConfigs) {
        // Collect paths from dropdown option mappings
        for (const fieldConfig of config.fieldConfigs) {
          if (fieldConfig.optionPaths) {
            for (const paths of Object.values(fieldConfig.optionPaths)) {
              paths.forEach(path => allReferencedPaths.add(path));
            }
          }

          // Collect paths from toggle fields
          if (fieldConfig.categoryPaths) {
            fieldConfig.categoryPaths.forEach(path => allReferencedPaths.add(path));
          }
        }

        // Collect subcategories from allowedSubcategories
        if (config.allowedSubcategories) {
          config.allowedSubcategories.forEach(sub => allReferencedSubcategories.add(sub));
        }
      }

      // Load all active products
      const allProducts = await storage.getAllProducts();
      const activeProducts = allProducts.filter(p => p.active === 1);

      // Find orphans: products where NONE of their categoryPaths match AND subcategory doesn't match
      const orphans: Array<{ code: string; subcategory: string | null; categoryPaths: string[] }> = [];

      for (const product of activeProducts) {
        const productPaths = product.categoryPaths || [];
        const hasMatchingPath = productPaths.some(path => allReferencedPaths.has(path));
        const hasMatchingSubcategory = product.subcategory && allReferencedSubcategories.has(product.subcategory);

        // Product is orphan if it has NO matching paths AND NO matching subcategory
        if (!hasMatchingPath && !hasMatchingSubcategory) {
          orphans.push({
            code: product.code,
            subcategory: product.subcategory || null,
            categoryPaths: productPaths,
          });
        }
      }

      // Sort orphans by code ascending and limit to 50
      orphans.sort((a, b) => a.code.localeCompare(b.code));
      const limitedOrphans = orphans.slice(0, 50);

      // Build response
      const response = {
        neededPaths: allReferencedPaths.size,
        neededSubcategories: allReferencedSubcategories.size,
        orphanCount: orphans.length,
        orphans: limitedOrphans,
      };

      res.json(response);
    } catch (error) {
      console.error("Error in debug products lint:", error);
      res.status(500).json({ error: "internal_server_error" });
    }
  });

  return router;
}
