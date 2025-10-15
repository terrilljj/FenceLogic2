import { Router } from "express";
import { db } from "../db";
import { products } from "@shared/schema";
import { sql } from "drizzle-orm";

const router = Router();

/**
 * GET /api/meta/category-paths
 * Returns all distinct category paths from products table
 */
router.get("/category-paths", async (req, res) => {
  try {
    // Get all products with their categoryPaths
    const allProducts = await db
      .select({ categoryPaths: products.categoryPaths })
      .from(products);

    // Extract and deduplicate all paths
    const pathSet = new Set<string>();
    
    for (const product of allProducts) {
      const paths = product.categoryPaths || [];
      for (const path of paths) {
        if (path && path.trim()) {
          pathSet.add(path.trim());
        }
      }
    }

    // Convert to sorted array
    const paths = Array.from(pathSet).sort();

    res.json({ paths });
  } catch (error) {
    console.error("Error fetching category paths:", error);
    res.status(500).json({ 
      error: "Failed to fetch category paths",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
