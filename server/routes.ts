import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFenceDesignSchema, insertProductSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all fence designs
  app.get("/api/designs", async (req, res) => {
    try {
      const designs = await storage.getAllFenceDesigns();
      res.json(designs);
    } catch (error) {
      console.error("Error fetching designs:", error);
      res.status(500).json({ error: "Failed to fetch designs" });
    }
  });

  // Get a specific fence design
  app.get("/api/designs/:id", async (req, res) => {
    try {
      const design = await storage.getFenceDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      res.json(design);
    } catch (error) {
      console.error("Error fetching design:", error);
      res.status(500).json({ error: "Failed to fetch design" });
    }
  });

  // Create a new fence design
  app.post("/api/designs", async (req, res) => {
    try {
      const validatedData = insertFenceDesignSchema.parse(req.body);
      const design = await storage.createFenceDesign(validatedData);
      res.status(201).json(design);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid design data", details: error.errors });
      }
      console.error("Error creating design:", error);
      res.status(500).json({ error: "Failed to create design" });
    }
  });

  // Delete a fence design
  app.delete("/api/designs/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteFenceDesign(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Design not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting design:", error);
      res.status(500).json({ error: "Failed to delete design" });
    }
  });

  // Email quote endpoint
  app.post("/api/email-quote", async (req, res) => {
    try {
      const { email, design, components } = req.body;

      if (!email || !design || !components) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // In a real implementation, this would send an email using a service like SendGrid or Nodemailer
      // For now, we'll just simulate the email sending
      console.log("Sending quote email to:", email);
      console.log("Design:", design);
      console.log("Components:", components);

      // Simulate email delay
      await new Promise(resolve => setTimeout(resolve, 500));

      res.json({ 
        success: true, 
        message: `Quote email would be sent to ${email}` 
      });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Calculate component list endpoint
  app.post("/api/calculate-components", async (req, res) => {
    try {
      const { design } = req.body;

      if (!design || !design.spans) {
        return res.status(400).json({ error: "Invalid design data" });
      }

      const components: Array<{ qty: number; description: string; sku?: string }> = [];

      design.spans.forEach((span: any) => {
        const effectiveLength = span.length;
        const panelWidth = span.maxPanelWidth;
        const gapSize = span.maxGap;
        // Correct calculation: N panels need N-1 gaps
        const numPanels = Math.floor((effectiveLength + gapSize) / (panelWidth + gapSize));

        if (numPanels > 0) {
          components.push({
            qty: numPanels,
            description: `Glass Panel ${panelWidth}mm x 1200mm (12mm thick)`,
            sku: `GP-${panelWidth}-1200-12`,
          });

          // Posts (one less than panels)
          if (numPanels > 1) {
            components.push({
              qty: numPanels - 1,
              description: "Spigot Post (50mm diameter, 1200mm height)",
              sku: "SP-50-1200",
            });
          }

          // Gate hardware if configured
          if (span.gateConfig?.required) {
            const hardware = span.gateConfig.hardware === "polaris" ? "Polaris Soft Close" : "Master Range";
            components.push({
              qty: 1,
              description: `${hardware} Gate Hardware Set (${span.gateConfig.gateSize}mm gate)`,
              sku: `GH-${span.gateConfig.hardware.toUpperCase()}-${span.gateConfig.gateSize}`,
            });
          }

          // Raked panels if configured
          if (span.leftRakedPanel?.enabled) {
            components.push({
              qty: 1,
              description: `Left Raked Panel ${panelWidth}mm x ${span.leftRakedPanel.height}mm`,
              sku: `RP-LEFT-${panelWidth}-${span.leftRakedPanel.height}`,
            });
          }

          if (span.rightRakedPanel?.enabled) {
            components.push({
              qty: 1,
              description: `Right Raked Panel ${panelWidth}mm x ${span.rightRakedPanel.height}mm`,
              sku: `RP-RIGHT-${panelWidth}-${span.rightRakedPanel.height}`,
            });
          }
        }
      });

      // Consolidate duplicate components
      const consolidated: typeof components = [];
      components.forEach((comp) => {
        const existing = consolidated.find((c) => c.description === comp.description);
        if (existing) {
          existing.qty += comp.qty;
        } else {
          consolidated.push({ ...comp });
        }
      });

      res.json(consolidated);
    } catch (error) {
      console.error("Error calculating components:", error);
      res.status(500).json({ error: "Failed to calculate components" });
    }
  });

  // Product routes
  // Get all products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get a specific product
  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  // Create a new product
  app.post("/api/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      
      // Check if product code already exists
      const existing = await storage.getProductByCode(validatedData.code);
      if (existing) {
        return res.status(409).json({ error: "Product code already exists" });
      }
      
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  // Update a product
  app.patch("/api/products/:id", async (req, res) => {
    try {
      const validatedData = insertProductSchema.partial().parse(req.body);
      
      // If updating code, check if new code already exists (and isn't this product's current code)
      if (validatedData.code) {
        const existing = await storage.getProductByCode(validatedData.code);
        if (existing && existing.id !== req.params.id) {
          return res.status(409).json({ error: "Product code already exists" });
        }
      }
      
      const product = await storage.updateProduct(req.params.id, validatedData);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // Delete a product
  app.delete("/api/products/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
