import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFenceDesignSchema, insertProductSchema, insertProductUIConfigSchema, insertCategorySchema, insertSubcategorySchema, PANEL_SIZE_REGISTRY, getAvailablePanelSizes, type ProductVariant } from "@shared/schema";
import { z } from "zod";
import { requireAdmin } from "./middleware/auth";
import { createDebugUIConfigRouter } from "./routes/debug-ui-config";
import { createDebugResolveTraceRouter } from "./routes/debug-resolve-trace";
import { createDebugProductsLintRouter } from "./routes/debug-products-lint";
import { createDebugEndgapAdviceRouter } from "./routes/debug-endgap-advice";
import { createDebugFramelessCustomRouter } from "./routes/debug-frameless-custom";
import { UiConfigSchema } from "./schemas/ui-config";
import metaCategoryPathsRouter from "./routes/meta-category-paths";
import { pdfRouter } from "./routes/pdf";
import adminConfigRouter from "./routes/adminConfig";
import adminSheetsRouter from "./routes/adminSheets";

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

  // Public endpoint for fetching panel size configurations
  app.get("/api/panel-sizes/:variant", async (req, res) => {
    try {
      const { variant } = req.params;
      const configs = PANEL_SIZE_REGISTRY[variant as ProductVariant] || [];
      res.json(configs);
    } catch (error) {
      console.error("Error fetching panel size configs:", error);
      res.status(500).json({ error: "Failed to fetch panel size configs" });
    }
  });

  // Public endpoint for fetching available panel sizes (flattened list)
  app.get("/api/panel-sizes/:variant/:fieldName/sizes", async (req, res) => {
    try {
      const { variant, fieldName } = req.params;
      const sizes = getAvailablePanelSizes(variant as ProductVariant, fieldName);
      res.json(sizes);
    } catch (error) {
      console.error("Error fetching available sizes:", error);
      res.status(500).json({ error: "Failed to fetch available sizes" });
    }
  });

  // Public endpoint for fetching product slots (used by fence builder)
  app.get("/api/product-slots/:variant", async (req, res) => {
    try {
      const slots = await storage.getAllSlotsByVariant(req.params.variant);
      // Only return slots with mapped products (where productId is not null)
      const mappedSlots = slots.filter(slot => slot.productId !== null);
      res.json(mappedSlots);
    } catch (error) {
      console.error("Error fetching product slots:", error);
      res.status(500).json({ error: "Failed to fetch product slots" });
    }
  });
  
  // Public endpoint for fetching calculator configuration by fence style code
  app.get("/api/styles/:code/calculator-config", async (req, res) => {
    try {
      const { code } = req.params;
      const config = await storage.getStyleWithCalculatorConfig(code);
      
      if (!config) {
        return res.status(404).json({ error: "Fence style not found" });
      }
      
      // Transform to calculator-friendly format
      const { style, fields } = config;
      
      // Build field configurations organized by field key
      const fieldConfigs: Record<string, any> = {};
      fields.forEach(field => {
        fieldConfigs[field.fieldKey] = {
          type: field.fieldType,
          label: field.label,
          min: field.min ? parseFloat(field.min) : undefined,
          max: field.max ? parseFloat(field.max) : undefined,
          step: field.step ? parseFloat(field.step) : undefined,
          defaultValue: field.defaultValue ? parseFloat(field.defaultValue) : undefined,
          unit: field.unit,
          options: field.options,
          tooltip: field.tooltip,
          section: field.section,
        };
      });
      
      // Return complete calculator configuration
      res.json({
        styleCode: style.code,
        styleLabel: style.label,
        description: style.description,
        
        // Panel constraints (required for CompositionInput)
        minPanelWidth: style.minPanelWidth || 250,
        maxPanelWidth: style.maxPanelWidth || 2000,
        
        // Feature toggles
        features: {
          enableGates: Boolean(style.enableGates),
          enableTopRail: Boolean(style.enableTopRail),
          enableHingePanel: Boolean(style.enableHingePanel),
          enableCustomWidth: Boolean(style.enableCustomWidth),
        },
        
        // Field configurations
        fields: fieldConfigs,
      });
    } catch (error) {
      console.error("Error fetching calculator config:", error);
      res.status(500).json({ error: "Failed to fetch calculator config" });
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

  // Public endpoint for fetching products (used by fence builder)
  // MUST be defined before /api/products/:id to avoid route collision
  app.get("/api/products/lookup", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      // Only return essential fields for public consumption
      const publicProducts = products.map(p => ({
        id: p.id,
        code: p.code,
        description: p.description,
        price: p.price,
      }));
      res.json(publicProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Product routes
  // Get all products
  app.get("/api/products", requireAdmin, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Get a specific product
  app.get("/api/products/:id", requireAdmin, async (req, res) => {
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
  app.post("/api/products", requireAdmin, async (req, res) => {
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
  app.patch("/api/products/:id", requireAdmin, async (req, res) => {
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
  app.delete("/api/products/:id", requireAdmin, async (req, res) => {
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

  // Generate CSV template for product imports
  app.get("/api/products/csv/template", requireAdmin, async (req, res) => {
    try {
      const csvHeader = "code,description,category,subcategory,price,weight,dimensions,units,tags,notes,imageUrl,active\n";
      
      const templateProducts = [
        // 1. Frameless Pool Fence (spigots)
        'FPF-GP-12,"12mm Glass Panel",Frameless Pool Fence,Glass Panels,$250.00,,,,,,1',
        'FPF-SPIG-100,"Spigot Post 100mm",Frameless Pool Fence,Spigots,$45.00,,,,,,1',
        'FPF-MHP-900,"Master Hinge Panel 900mm",Frameless Pool Fence,Master Hinge Panels,$320.00,,,,,,1',
        'FPF-MGP-900,"Master Gate Panel 900mm",Frameless Pool Fence,Master Gate Panels,$340.00,,,,,,1',
        'FPF-SCHP-1200,"Soft Close Hinge Panel 1200mm",Frameless Pool Fence,Soft Close Hinge Panels,$335.00,,,,,,1',
        'FPF-SCG-900,"Soft Close Gate 900mm",Frameless Pool Fence,Soft Close Gates,$380.00,,,,,,1',
        'FPF-RP-2400,"Raked Panel 2400mm",Frameless Pool Fence,Raked Panels,$290.00,,,,,,1',
        'FPF-GHM,"Gate Hinge Master",Frameless Pool Fence,Gate Hinges Master,$85.00,,,,,,1',
        'FPF-GHSC,"Gate Hinge Soft Close",Frameless Pool Fence,Gate Hinges Soft Close,$125.00,,,,,,1',
        'FPF-GGL,"Glass Gate Latch",Frameless Pool Fence,Glass Gate Latches,$95.00,,,,,,1',
        
        // 2. Channel Pool Fence
        'CPF-GP-12,"12mm Glass Panel",Channel Pool Fence,Glass Panels,$240.00,,,,,,1',
        'CPF-CHAN-3M,"Aluminium Channel 3m",Channel Pool Fence,Channel,$89.00,,,,,,1',
        'CPF-CLAMP,"Channel Clamp",Channel Pool Fence,Channel Clamps,$12.50,,,,,,1',
        'CPF-CHACC,"Channel End Cap",Channel Pool Fence,Channel Accessories,$8.00,,,,,,1',
        'CPF-MHP-900,"Master Hinge Panel 900mm",Channel Pool Fence,Master Hinge Panels,$315.00,,,,,,1',
        'CPF-MGP-900,"Master Gate Panel 900mm",Channel Pool Fence,Master Gate Panels,$335.00,,,,,,1',
        'CPF-SCHP-1200,"Soft Close Hinge Panel 1200mm",Channel Pool Fence,Soft Close Hinge Panels,$330.00,,,,,,1',
        'CPF-SCG-900,"Soft Close Gate 900mm",Channel Pool Fence,Soft Close Gates,$375.00,,,,,,1',
        'CPF-RP-2400,"Raked Panel 2400mm",Channel Pool Fence,Raked Panels,$285.00,,,,,,1',
        'CPF-GHM,"Gate Hinge Master",Channel Pool Fence,Gate Hinges Master,$85.00,,,,,,1',
        'CPF-GHSC,"Gate Hinge Soft Close",Channel Pool Fence,Gate Hinges Soft Close,$125.00,,,,,,1',
        'CPF-GGL,"Glass Gate Latch",Channel Pool Fence,Glass Gate Latches,$95.00,,,,,,1',
        
        // 3. Flat Top Pool Fence
        'FTP-PANEL-2400,"Flat Top Panel 2400mm",Flat Top Pool Fence,Flat Top Panels,$280.00,,,,,,1',
        'FTP-POST-2100,"Flat Top Post 2100mm",Flat Top Pool Fence,Flat Top Posts,$125.00,,,,,,1',
        'FTP-GATE-900,"Flat Top Gate 900mm",Flat Top Pool Fence,Flat Top Gates,$395.00,,,,,,1',
        'FTP-SHROUD,"Post Shroud",Flat Top Pool Fence,Post Shrouds,$45.00,,,,,,1',
        'FTP-ACC-CAP,"Flat Top End Cap",Flat Top Pool Fence,Flat Top Accessories,$15.00,,,,,,1',
        'FTP-HINGE,"Flat Top Hinge Set",Flat Top Pool Fence,Flat Top Hinges,$95.00,,,,,,1',
        'FTP-LATCH,"Flat Top Gate Latch",Flat Top Pool Fence,Flat Top Latches,$110.00,,,,,,1',
        
        // 4. BARR Pool Fence
        'BPF-P1200,"BARR Panel 1200mm High",BARR Pool Fence,Barr Panels 1200,$195.00,,,,,,1',
        'BPF-POST,"BARR Post 2100mm",BARR Pool Fence,Barr Posts,$98.00,,,,,,1',
        'BPF-GATE,"BARR Gate 1000mm",BARR Pool Fence,Barr Gates,$345.00,,,,,,1',
        'BPF-SHROUD,"BARR Post Shroud",BARR Pool Fence,Barr Shrouds,$42.00,,,,,,1',
        'BPF-ACC,"BARR Mounting Bracket",BARR Pool Fence,Barr Accessories,$28.00,,,,,,1',
        'BPF-HINGE,"BARR Gate Hinge",BARR Pool Fence,Barr Hinges,$75.00,,,,,,1',
        'BPF-LATCH,"BARR Gate Latch",BARR Pool Fence,Barr Latches,$95.00,,,,,,1',
        
        // 5. Blade Pool Fence
        'BLPF-P1200,"Blade Panel 1200mm High",Blade Pool Fence,Blade Panels 1200,$210.00,,,,,,1',
        'BLPF-POST,"Blade Post 2100mm",Blade Pool Fence,Blade Posts,$105.00,,,,,,1',
        'BLPF-GATE,"Blade Gate 1000mm",Blade Pool Fence,Blade Gates,$365.00,,,,,,1',
        'BLPF-SHROUD,"Blade Post Shroud",Blade Pool Fence,Blade Shrouds,$45.00,,,,,,1',
        'BLPF-ACC,"Blade Mounting Bracket",Blade Pool Fence,Blade Accessories,$32.00,,,,,,1',
        'BLPF-HINGE,"Blade Gate Hinge",Blade Pool Fence,Blade Hinges,$85.00,,,,,,1',
        'BLPF-LATCH,"Blade Gate Latch",Blade Pool Fence,Blade Latches,$105.00,,,,,,1',
        
        // 6. Frameless Balustrade (spigots)
        'FBL-GP12-970,"Glass Panel 12mm 970mm High",Frameless Balustrade,Glass Panels 12mm 970,$220.00,,,,,,1',
        'FBL-GP15-1000,"Glass Panel 15mm 1000mm High",Frameless Balustrade,Glass Panels 15mm 1000,$280.00,,,,,,1',
        'FBL-SPIG12,"Spigot 12mm",Frameless Balustrade,Spigots 12mm,$38.00,,,,,,1',
        'FBL-SPIG15,"Spigot 15mm",Frameless Balustrade,Spigots 15mm,$42.00,,,,,,1',
        'FBL-HR25,"Handrail 25x21mm 3m",Frameless Balustrade,Handrail 25x21,$95.00,,,,,,1',
        'FBL-HR35,"Handrail 35 Series 3m",Frameless Balustrade,Handrail 35 Series,$125.00,,,,,,1',
        'FBL-HRACC,"Handrail End Cap",Frameless Balustrade,Handrail Accessories,$18.00,,,,,,1',
        
        // 7. Channel Balustrade
        'CBL-GP,"Glass Panel Standard",Channel Balustrade,Glass Panels,$215.00,,,,,,1',
        'CBL-GP12-970,"Glass Panel 12mm 970mm High",Channel Balustrade,Glass Panels 12mm 970,$220.00,,,,,,1',
        'CBL-GP15-1000,"Glass Panel 15mm 1000mm High",Channel Balustrade,Glass Panels 15mm 1000,$280.00,,,,,,1',
        'CBL-CHAN,"Channel 3m",Channel Balustrade,Channel,$78.00,,,,,,1',
        'CBL-CLAMP,"Channel Clamp",Channel Balustrade,Channel Clamps,$11.00,,,,,,1',
        'CBL-CHACC,"Channel Connector",Channel Balustrade,Channel Accessories,$15.00,,,,,,1',
        'CBL-HR25,"Handrail 25x21mm 3m",Channel Balustrade,Handrail 25x21,$95.00,,,,,,1',
        'CBL-HR35,"Handrail 35 Series 3m",Channel Balustrade,Handrail 35 Series,$125.00,,,,,,1',
        'CBL-HRACC,"Handrail Bracket",Channel Balustrade,Handrail Accessories,$22.00,,,,,,1',
        
        // 8. Standoff Balustrade
        'SBL-GP15-1280,"Glass Panel 15mm 1280mm High",Standoff Balustrade,Glass Panels 15mm 1280,$295.00,,,,,,1',
        'SBL-STOFF,"Standoff 50mm",Standoff Balustrade,Standoffs,$32.00,,,,,,1',
        'SBL-STACC,"Standoff Base Plate",Standoff Balustrade,Standoff Accessories,$18.00,,,,,,1',
        'SBL-HR25,"Handrail 25x21mm 3m",Standoff Balustrade,Handrail 25x21,$95.00,,,,,,1',
        'SBL-HR35,"Handrail 35 Series 3m",Standoff Balustrade,Handrail 35 Series,$125.00,,,,,,1',
        'SBL-HRACC,"Handrail Elbow",Standoff Balustrade,Handrail Accessories,$35.00,,,,,,1',
        
        // 9. BARR Fencing 1800
        'BF18-P1800,"BARR Panel 1800mm High",BARR Fencing 1800,Barr Panels 1800,$275.00,,,,,,1',
        'BF18-POST,"BARR Post 2400mm",BARR Fencing 1800,Barr Posts,$135.00,,,,,,1',
        'BF18-GATE,"BARR Gate 1800mm High",BARR Fencing 1800,Barr Gates 1800,$485.00,,,,,,1',
        'BF18-SHROUD,"BARR Post Shroud",BARR Fencing 1800,Barr Shrouds,$48.00,,,,,,1',
        'BF18-ACC,"BARR Top Rail",BARR Fencing 1800,Barr Accessories,$65.00,,,,,,1',
        'BF18-HINGE,"BARR Heavy Duty Hinge",BARR Fencing 1800,Barr Hinges,$95.00,,,,,,1',
        'BF18-LATCH,"BARR Security Latch",BARR Fencing 1800,Barr Latches,$125.00,,,,,,1',
        
        // 10. Blade Fencing 1800
        'BLF18-P1800,"Blade Panel 1800mm High",Blade Fencing 1800,Blade Panels 1800,$295.00,,,,,,1',
        'BLF18-POST,"Blade Post 2400mm",Blade Fencing 1800,Blade Posts,$145.00,,,,,,1',
        'BLF18-GATE,"Blade Gate 1800mm High",Blade Fencing 1800,Blade Gates,$515.00,,,,,,1',
        'BLF18-SHROUD,"Blade Post Shroud",Blade Fencing 1800,Blade Shrouds,$52.00,,,,,,1',
        'BLF18-ACC,"Blade Top Rail",Blade Fencing 1800,Blade Accessories,$72.00,,,,,,1',
        'BLF18-HINGE,"Blade Heavy Duty Hinge",Blade Fencing 1800,Blade Hinges,$105.00,,,,,,1',
        'BLF18-LATCH,"Blade Security Latch",Blade Fencing 1800,Blade Latches,$135.00,,,,,,1',
        
        // 11. Zeus Steel Fencing
        'ZSF-PANEL,"Zeus Steel Panel 1800mm",Zeus Steel Fencing,Zeus Steel Panels,$425.00,,,,,,1',
        'ZSF-POST,"Zeus Steel Post 2400mm",Zeus Steel Fencing,Zeus Steel Posts,$185.00,,,,,,1',
        'ZSF-GATE,"Zeus Steel Gate 1000mm",Zeus Steel Fencing,Zeus Steel Gates,$565.00,,,,,,1',
        'ZSF-SHROUD,"Zeus Steel Post Shroud",Zeus Steel Fencing,Zeus Steel Shrouds,$58.00,,,,,,1',
        'ZSF-HINGE,"Zeus Gate Hinge",Zeus Steel Fencing,Zeus Hinges,$115.00,,,,,,1',
        'ZSF-LATCH,"Zeus Gate Latch",Zeus Steel Fencing,Zeus Latches,$145.00,,,,,,1',
        'ZSF-ACC,"Zeus Mounting Plate",Zeus Steel Fencing,Zeus Accessories,$45.00,,,,,,1',
        
        // 12. Zeus Aluminium Fencing
        'ZAF-PANEL,"Zeus Aluminium Panel 1800mm",Zeus Aluminium Fencing,Zeus Aluminium Panels,$385.00,,,,,,1',
        'ZAF-POST,"Zeus Aluminium Post 2400mm",Zeus Aluminium Fencing,Zeus Aluminium Posts,$165.00,,,,,,1',
        'ZAF-GATE,"Zeus Aluminium Gate 1000mm",Zeus Aluminium Fencing,Zeus Aluminium Gates,$525.00,,,,,,1',
        'ZAF-SHROUD,"Zeus Aluminium Post Shroud",Zeus Aluminium Fencing,Zeus Aluminium Shrouds,$55.00,,,,,,1',
        'ZAF-HINGE,"Zeus Gate Hinge",Zeus Aluminium Fencing,Zeus Hinges,$115.00,,,,,,1',
        'ZAF-LATCH,"Zeus Gate Latch",Zeus Aluminium Fencing,Zeus Latches,$145.00,,,,,,1',
        'ZAF-ACC,"Zeus Corner Bracket",Zeus Aluminium Fencing,Zeus Accessories,$42.00,,,,,,1',
      ];
      
      const csvTemplate = csvHeader + templateProducts.join("\n") + "\n";
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=product_template.csv");
      res.send(csvTemplate);
    } catch (error) {
      console.error("Error generating CSV template:", error);
      res.status(500).json({ error: "Failed to generate CSV template" });
    }
  });

  // Export products to CSV
  app.get("/api/products/csv/export", requireAdmin, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      
      const csvHeader = "code,selectionId,categoryPaths,description,category,subcategory,price,weight,dimensions,units,active,tags,notes,imageUrl\n";
      const csvRows = products.map((p) => {
        const code = p.code.replace(/"/g, '""');
        const selectionId = (p.selectionId || "").replace(/"/g, '""');
        const categoryPaths = (p.categoryPaths || []).join(";").replace(/"/g, '""');
        const description = p.description.replace(/"/g, '""');
        const category = (p.category || "").replace(/"/g, '""');
        const subcategory = (p.subcategory || "").replace(/"/g, '""');
        const price = (p.price || "").replace(/"/g, '""');
        const weight = (p.weight || "").replace(/"/g, '""');
        const dimensions = (p.dimensions || "").replace(/"/g, '""');
        const units = (p.units || "").replace(/"/g, '""');
        const tags = (p.tags || []).join(",").replace(/"/g, '""');
        const notes = (p.notes || "").replace(/"/g, '""');
        const imageUrl = (p.imageUrl || "").replace(/"/g, '""');
        const active = p.active;
        return `"${code}","${selectionId}","${categoryPaths}","${description}","${category}","${subcategory}","${price}","${weight}","${dimensions}","${units}",${active},"${tags}","${notes}","${imageUrl}"`;
      }).join("\n");
      
      const csv = csvHeader + csvRows;
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=products_export.csv");
      res.send(csv);
    } catch (error) {
      console.error("Error exporting products:", error);
      res.status(500).json({ error: "Failed to export products" });
    }
  });

  // Import products from CSV
  app.post("/api/products/csv/import", requireAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ error: "Invalid CSV data" });
      }

      // RFC 4180 compliant CSV parser that handles embedded newlines in quoted fields
      const parseCSV = (csv: string): string[][] => {
        const rows: string[][] = [];
        const row: string[] = [];
        let current = "";
        let inQuotes = false;
        
        for (let i = 0; i < csv.length; i++) {
          const char = csv[i];
          const nextChar = csv[i + 1];
          
          if (char === '"' && inQuotes && nextChar === '"') {
            // Escaped quote ("") - add single quote to current field
            current += '"';
            i++; // Skip next quote
          } else if (char === '"') {
            // Toggle quote state
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            // Field separator outside quotes
            row.push(current);
            current = "";
          } else if ((char === "\n" || (char === "\r" && nextChar === "\n")) && !inQuotes) {
            // Row separator outside quotes
            row.push(current);
            rows.push([...row]);
            row.length = 0;
            current = "";
            if (char === "\r" && nextChar === "\n") {
              i++; // Skip \n in \r\n
            }
          } else if (char === "\r" && !inQuotes) {
            // Handle standalone \r as row separator
            row.push(current);
            rows.push([...row]);
            row.length = 0;
            current = "";
          } else {
            // Regular character or newline inside quotes
            current += char;
          }
        }
        
        // Handle last field and row
        row.push(current);
        if (row.length > 0 && row.some(field => field.trim() !== "")) {
          rows.push(row);
        }
        
        return rows;
      };

      const rows = parseCSV(csvData.trim());
      
      if (rows.length < 2) {
        return res.status(400).json({ error: "CSV must contain header and at least one data row" });
      }

      const header = rows[0].map(h => h.toLowerCase().trim());
      const requiredFields = ["code", "description"];
      
      for (const field of requiredFields) {
        if (!header.includes(field)) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i];
        
        try {
          const rowData: Record<string, string> = {};
          header.forEach((field, index) => {
            rowData[field] = values[index] || "";
          });

          const productData = {
            code: rowData.code,
            selectionId: rowData.selectionid || undefined,
            categoryPaths: rowData.categorypaths ? rowData.categorypaths.split(";").map((p: string) => p.trim()).filter((p: string) => p !== "") : undefined,
            description: rowData.description,
            category: rowData.category || undefined,
            subcategory: rowData.subcategory || undefined,
            price: rowData.price || undefined,
            weight: rowData.weight || undefined,
            dimensions: rowData.dimensions || undefined,
            units: rowData.units || undefined,
            tags: rowData.tags ? rowData.tags.split(",").map((t: string) => t.trim()).filter((t: string) => t !== "") : undefined,
            notes: rowData.notes || undefined,
            imageUrl: rowData.imageurl || undefined,
            active: rowData.active ? parseInt(rowData.active) : 1,
          };

          const validatedData = insertProductSchema.parse(productData);
          
          // Check if product already exists
          const existing = await storage.getProductByCode(validatedData.code);
          if (existing) {
            // Update existing product
            await storage.updateProduct(existing.id, validatedData);
          } else {
            // Create new product
            await storage.createProduct(validatedData);
          }
          
          results.success++;
        } catch (error) {
          results.failed++;
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          results.errors.push(`Row ${i + 1}: ${errorMsg}`);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error importing products:", error);
      res.status(500).json({ error: "Failed to import products" });
    }
  });

  // Admin authentication endpoints
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const adminUsername = process.env.ADMIN_USERNAME || "admin";
      const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
      
      // Trim whitespace from inputs
      const trimmedUsername = username?.trim();
      const trimmedPassword = password?.trim();
      
      if (trimmedUsername === adminUsername && trimmedPassword === adminPassword) {
        if (req.session) {
          req.session.isAdmin = true;
          res.json({ success: true, message: "Login successful" });
        } else {
          res.status(500).json({ error: "Session not available" });
        }
      } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
    try {
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            return res.status(500).json({ error: "Logout failed" });
          }
          res.json({ success: true, message: "Logged out successfully" });
        });
      } else {
        res.json({ success: true, message: "No active session" });
      }
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  app.get("/api/admin/verify", async (req, res) => {
    const isAuthenticated = req.session?.isAdmin === true;
    res.json({ authenticated: isAuthenticated });
  });

  // Admin products endpoint (for UI Config page)
  app.get("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // UI Configuration routes - Public read, admin write
  // Public endpoint for reading UI configs (used by fence-builder)
  app.get("/api/ui-configs/:variant", async (req, res) => {
    try {
      const config = await storage.getUIConfig(req.params.variant);
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("Error fetching UI config:", error);
      res.status(500).json({ error: "Failed to fetch UI configuration" });
    }
  });

  // Admin-only endpoints for managing UI configs
  app.get("/api/admin/ui-configs", requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getAllUIConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching UI configs:", error);
      res.status(500).json({ error: "Failed to fetch UI configurations" });
    }
  });

  app.get("/api/admin/ui-configs/:variant", requireAdmin, async (req, res) => {
    try {
      const config = await storage.getUIConfig(req.params.variant);
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("Error fetching UI config:", error);
      res.status(500).json({ error: "Failed to fetch UI configuration" });
    }
  });

  app.post("/api/admin/ui-configs", requireAdmin, async (req, res) => {
    try {
      // 1. Validate with new UiConfigSchema
      const parseResult = UiConfigSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({
          error: "invalid_ui_config",
          issues: parseResult.error.issues,
        });
      }

      const payload = parseResult.data;

      // 2. Canonical DB checks - collect all referenced subcategories and categoryPaths
      const referencedSubcategories = new Set<string>();
      const referencedCategoryPaths = new Set<string>();

      // Add from allowedSubcategories
      payload.allowedSubcategories.forEach(sub => referencedSubcategories.add(sub));

      // Add from fieldConfigs (new format: Record<string, FieldConfig>)
      for (const fieldConfig of Object.values(payload.fieldConfigs)) {
        if (fieldConfig.type === "dropdown") {
          // Extract from dropdown mappings
          for (const mappingValue of Object.values(fieldConfig.mapping)) {
            mappingValue.subcategories?.forEach(sub => referencedSubcategories.add(sub));
            mappingValue.categoryPaths?.forEach(path => referencedCategoryPaths.add(path));
          }
        } else if (fieldConfig.type === "toggle") {
          // Extract from toggle mapping
          if (fieldConfig.mapping.on) {
            fieldConfig.mapping.on.subcategories?.forEach(sub => referencedSubcategories.add(sub));
            fieldConfig.mapping.on.categoryPaths?.forEach(path => referencedCategoryPaths.add(path));
          }
        }
      }

      // Check subcategories exist in DB
      const allSubcategories = await storage.getAllSubcategories();
      const existingSubcategoryNames = new Set(allSubcategories.map(s => s.name));
      const missingSubcategories = Array.from(referencedSubcategories).filter(
        sub => !existingSubcategoryNames.has(sub)
      );

      // Check categoryPaths exist in products table
      const allProducts = await storage.getAllProducts();
      const existingCategoryPaths = new Set<string>();
      allProducts.forEach(p => {
        p.categoryPaths?.forEach(path => existingCategoryPaths.add(path));
      });
      const missingCategoryPaths = Array.from(referencedCategoryPaths).filter(
        path => !existingCategoryPaths.has(path)
      );

      // If any references are missing, return error
      if (missingSubcategories.length > 0 || missingCategoryPaths.length > 0) {
        return res.status(400).json({
          error: "unknown_references",
          missing: {
            subcategories: missingSubcategories,
            categoryPaths: missingCategoryPaths,
          },
        });
      }

      // 3. All validation passed - proceed with save using existing database schema
      const validatedData = insertProductUIConfigSchema.parse(req.body);
      const config = await storage.createOrUpdateUIConfig(validatedData);
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid configuration data", details: error.errors });
      }
      console.error("Error saving UI config:", error);
      res.status(500).json({ error: "Failed to save UI configuration" });
    }
  });

  app.delete("/api/admin/ui-configs/:variant", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteUIConfig(req.params.variant);
      if (!deleted) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting UI config:", error);
      res.status(500).json({ error: "Failed to delete UI configuration" });
    }
  });

  // Fence UI Configuration routes - Hierarchical fence style configs
  // Public endpoints for reading fence configs (used by fence-builder)
  app.get("/api/fence-ui-configs", async (req, res) => {
    try {
      const configs = await storage.getAllFenceUIConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching fence UI configs:", error);
      res.status(500).json({ error: "Failed to fetch fence UI configurations" });
    }
  });

  app.get("/api/fence-ui-configs/:styleId", async (req, res) => {
    try {
      const config = await storage.getFenceUIConfig(req.params.styleId);
      if (!config) {
        return res.status(404).json({ error: "Fence style configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("Error fetching fence UI config:", error);
      res.status(500).json({ error: "Failed to fetch fence UI configuration" });
    }
  });

  // Admin-only endpoints for managing fence UI configs
  app.get("/api/admin/fence-ui-configs", requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getAllFenceUIConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching fence UI configs:", error);
      res.status(500).json({ error: "Failed to fetch fence UI configurations" });
    }
  });

  app.get("/api/admin/fence-ui-configs/:styleId", requireAdmin, async (req, res) => {
    try {
      const config = await storage.getFenceUIConfig(req.params.styleId);
      if (!config) {
        return res.status(404).json({ error: "Fence style configuration not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("Error fetching fence UI config:", error);
      res.status(500).json({ error: "Failed to fetch fence UI configuration" });
    }
  });

  app.post("/api/admin/fence-ui-configs", requireAdmin, async (req, res) => {
    try {
      // TODO: Add validation with FenceStyleConfigSchema
      const config = await storage.createOrUpdateFenceUIConfig(req.body);
      res.json(config);
    } catch (error) {
      console.error("Error creating fence UI config:", error);
      res.status(500).json({ error: "Failed to create fence UI configuration" });
    }
  });

  app.put("/api/admin/fence-ui-configs/:styleId", requireAdmin, async (req, res) => {
    try {
      // TODO: Add validation with FenceStyleConfigSchema
      const config = await storage.createOrUpdateFenceUIConfig({
        ...req.body,
        fenceStyleId: req.params.styleId,
      });
      res.json(config);
    } catch (error) {
      console.error("Error updating fence UI config:", error);
      res.status(500).json({ error: "Failed to update fence UI configuration" });
    }
  });

  app.delete("/api/admin/fence-ui-configs/:styleId", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteFenceUIConfig(req.params.styleId);
      if (!deleted) {
        return res.status(404).json({ error: "Fence style configuration not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting fence UI config:", error);
      res.status(500).json({ error: "Failed to delete fence UI configuration" });
    }
  });

  // Product Slot routes (admin only)
  app.get("/api/admin/product-slots/:variant", requireAdmin, async (req, res) => {
    try {
      const slots = await storage.getAllSlotsByVariant(req.params.variant);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching product slots:", error);
      res.status(500).json({ error: "Failed to fetch product slots" });
    }
  });

  app.get("/api/admin/product-slots/:variant/:fieldName", requireAdmin, async (req, res) => {
    try {
      const slots = await storage.getSlotsByVariantAndField(req.params.variant, req.params.fieldName);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching product slots:", error);
      res.status(500).json({ error: "Failed to fetch product slots" });
    }
  });

  app.post("/api/admin/product-slots/generate", requireAdmin, async (req, res) => {
    try {
      const { productVariant, fieldName } = req.body;
      
      if (!productVariant || !fieldName) {
        return res.status(400).json({ error: "Missing required fields: productVariant, fieldName" });
      }

      // Get panel size configuration from registry
      const configs = PANEL_SIZE_REGISTRY[productVariant as ProductVariant] || [];
      const config = configs.find(c => c.fieldName === fieldName);

      if (!config) {
        return res.status(400).json({ 
          error: `No panel size configuration found for ${productVariant} / ${fieldName}. Please add to PANEL_SIZE_REGISTRY.` 
        });
      }

      // Delete existing slots for this variant+field
      await storage.deleteSlotsByVariantAndField(productVariant, fieldName);

      // Auto-generate slots for all available panel sizes
      const sizes = getAvailablePanelSizes(productVariant as ProductVariant, fieldName);
      const slots = sizes.map((width, index) => ({
        internalId: `${config.prefix}-${String(width).padStart(4, '0')}`, // e.g., "GP-0250", "GP-0300"
        productVariant,
        fieldName,
        sequence: index + 1,
        productId: null,
        label: `${config.label} ${width}mm`,
        isActive: 1,
      }));

      const createdSlots = await storage.createProductSlots(slots);
      res.json({ 
        success: true, 
        count: createdSlots.length,
        sizes: sizes,
        slots: createdSlots 
      });
    } catch (error) {
      console.error("Error generating product slots:", error);
      res.status(500).json({ error: "Failed to generate product slots" });
    }
  });

  app.put("/api/admin/product-slots/:id", requireAdmin, async (req, res) => {
    try {
      const { productId, label, isActive } = req.body;
      const updated = await storage.updateProductSlot(req.params.id, {
        productId,
        label,
        isActive,
      });
      if (!updated) {
        return res.status(404).json({ error: "Product slot not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating product slot:", error);
      res.status(500).json({ error: "Failed to update product slot" });
    }
  });

  app.delete("/api/admin/product-slots/:variant/:fieldName", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteSlotsByVariantAndField(req.params.variant, req.params.fieldName);
      if (!deleted) {
        return res.status(404).json({ error: "Product slots not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product slots:", error);
      res.status(500).json({ error: "Failed to delete product slots" });
    }
  });

  // Category routes (admin only)
  app.get("/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid category data", details: error.errors });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.updateCategory(req.params.id, validatedData);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid category data", details: error.errors });
      }
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Subcategory routes (admin only)
  app.get("/api/admin/subcategories", requireAdmin, async (req, res) => {
    try {
      const subcategories = await storage.getAllSubcategories();
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      res.status(500).json({ error: "Failed to fetch subcategories" });
    }
  });

  app.get("/api/admin/categories/:categoryId/subcategories", requireAdmin, async (req, res) => {
    try {
      const { categoryId } = req.params;
      const subcategories = await storage.getSubcategoriesByCategory(categoryId);
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching subcategories by category:", error);
      res.status(500).json({ error: "Failed to fetch subcategories" });
    }
  });

  app.post("/api/admin/subcategories", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSubcategorySchema.parse(req.body);
      const subcategory = await storage.createSubcategory(validatedData);
      res.status(201).json(subcategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid subcategory data", details: error.errors });
      }
      console.error("Error creating subcategory:", error);
      res.status(500).json({ error: "Failed to create subcategory" });
    }
  });

  app.put("/api/admin/subcategories/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertSubcategorySchema.parse(req.body);
      const subcategory = await storage.updateSubcategory(req.params.id, validatedData);
      if (!subcategory) {
        return res.status(404).json({ error: "Subcategory not found" });
      }
      res.json(subcategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid subcategory data", details: error.errors });
      }
      console.error("Error updating subcategory:", error);
      res.status(500).json({ error: "Failed to update subcategory" });
    }
  });

  app.delete("/api/admin/subcategories/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteSubcategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Subcategory not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      res.status(500).json({ error: "Failed to delete subcategory" });
    }
  });

  // Feature flags endpoint
  app.get("/api/feature-flags", (req, res) => {
    res.json({
      HINGE_AUTO_ENABLED: process.env.HINGE_AUTO_ENABLED === "1",
    });
  });

  // Template download endpoints
  app.get("/api/templates/:filename", requireAdmin, async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Security: only allow CSV files from templates/tabs directory
      if (!filename.endsWith('.csv') || filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: "Invalid filename" });
      }
      
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'templates', 'tabs', filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Send file
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving template:", error);
      res.status(500).json({ error: "Failed to serve template" });
    }
  });

  // Import/upload CSV template configuration
  app.post("/api/templates/import", requireAdmin, async (req, res) => {
    try {
      const { templateId, filename, csvData } = req.body;

      if (!templateId || !filename || !csvData) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Security: validate template ID format
      if (!/^[0-9]{2}-[a-z-]+$/.test(templateId)) {
        return res.status(400).json({ error: "Invalid template ID format" });
      }

      console.log(`[Template Import] Processing ${filename} for template ${templateId}`);

      // Import and process CSV using dedicated service
      const { importTemplateCSV } = await import('./services/templateCsvProcessor');
      const processed = await importTemplateCSV(templateId, filename, csvData);

      // Log processing results
      console.log(`[Template Import] Processed successfully:`);
      console.log(`  - Calculator Inputs: ${processed.calculatorInputs.length}`);
      console.log(`  - Product Mappings: ${processed.productMappings.length}`);
      console.log(`  - Feature Toggles: ${processed.featureToggles.length}`);
      console.log(`  - Gate Configs: ${processed.gateConfigs.length}`);

      if (processed.validationErrors.length > 0) {
        console.warn(`[Template Import] Validation warnings:`, processed.validationErrors);
      }

      // Find fence style by template ID (if it exists)
      const styles = await storage.getAllFenceStyles();
      const matchingStyle = styles.find(s => s.templateId === templateId);
      
      // Save product mappings to database (upsert: create or update)
      let productsCreated = 0;
      let productsUpdated = 0;
      let slotsCreated = 0;
      let fieldsCreated = 0;
      const dbErrors: string[] = [];
      const productIdMap = new Map<string, string>(); // SKU -> product ID

      for (const mapping of processed.productMappings) {
        try {
          const { product, created } = await storage.upsertProduct({
            code: mapping.productSku,
            description: mapping.productDescription,
            category: '', // Leave empty - category not specified in CSV templates
            subcategory: mapping.variableType,
            price: mapping.productPrice.toString(),
            active: 1,
          });
          
          // Store product ID for slot creation
          productIdMap.set(mapping.productSku, product.id);
          
          if (created) {
            productsCreated++;
          } else {
            productsUpdated++;
          }
        } catch (error) {
          const errorMsg = `Failed to upsert ${mapping.productSku}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          dbErrors.push(errorMsg);
          console.error(`[Template Import] ${errorMsg}`);
        }
      }
      
      // If matching style found, create style_product_slots
      if (matchingStyle) {
        console.log(`[Template Import] Linking products to style: ${matchingStyle.label}`);
        
        // Clear existing slots for this style
        await storage.deleteStyleProductSlots(matchingStyle.id);
        
        // Create new slots
        for (const mapping of processed.productMappings) {
          const productId = productIdMap.get(mapping.productSku);
          if (!productId) continue;
          
          try {
            await storage.createStyleProductSlot({
              fenceStyleId: matchingStyle.id,
              fieldKey: mapping.variableType,
              selectorKey: mapping.sizeMm ? mapping.sizeMm.toString() : mapping.slotPrefix || '',
              productId,
              productCode: mapping.productSku,
              label: mapping.label || mapping.productDescription,
              displayOrder: 0,
              isActive: 1,
            });
            slotsCreated++;
          } catch (error) {
            console.error(`[Template Import] Failed to create slot for ${mapping.productSku}:`, error);
          }
        }
        
        console.log(`[Template Import] Created ${slotsCreated} product slots for ${matchingStyle.label}`);
        
        // Create calculator fields for this style
        console.log(`[Template Import] Creating calculator fields for ${matchingStyle.label}`);
        
        // Clear existing fields for this style
        await storage.deleteStyleFields(matchingStyle.id);
        
        // Create new fields from calculator inputs
        for (const input of processed.calculatorInputs) {
          try {
            await storage.createStyleField({
              fenceStyleId: matchingStyle.id,
              fieldKey: input.variableType,
              label: input.label,
              fieldType: 'number',
              min: input.min?.toString() || null,
              max: input.max?.toString() || null,
              step: input.step?.toString() || null,
              defaultValue: input.defaultValue?.toString() || null,
              unit: input.unit || null,
              displayOrder: fieldsCreated,
              isVisible: 1,
            });
            fieldsCreated++;
          } catch (error) {
            console.error(`[Template Import] Failed to create field ${input.variableType}:`, error);
          }
        }
        
        console.log(`[Template Import] Created ${fieldsCreated} calculator fields for ${matchingStyle.label}`);
      } else {
        console.warn(`[Template Import] No fence style found with templateId: ${templateId}`);
      }

      console.log(`[Template Import] Database operations:`);
      console.log(`  - Products Created: ${productsCreated}`);
      console.log(`  - Products Updated: ${productsUpdated}`);
      if (dbErrors.length > 0) {
        console.error(`  - Database Errors: ${dbErrors.length}`);
      }

      const fieldsCreatedCount = matchingStyle ? fieldsCreated : 0;

      res.json({
        success: true,
        message: matchingStyle 
          ? `Template ${filename} imported: ${productsCreated} products created, ${productsUpdated} products updated, ${slotsCreated} slots linked, ${fieldsCreatedCount} calculator fields created for ${matchingStyle.label}`
          : `Template ${filename} imported: ${productsCreated} products created, ${productsUpdated} products updated (no matching fence style)`,
        templateId,
        fenceStyle: matchingStyle ? { id: matchingStyle.id, code: matchingStyle.code, label: matchingStyle.label } : null,
        summary: {
          calculatorInputs: processed.calculatorInputs.length,
          productMappings: processed.productMappings.length,
          productsCreated,
          productsUpdated,
          slotsCreated: matchingStyle ? slotsCreated : 0,
          fieldsCreated: fieldsCreatedCount,
          featureToggles: processed.featureToggles.length,
          gateConfigs: processed.gateConfigs.length,
          validationErrors: processed.validationErrors.length,
          databaseErrors: dbErrors.length,
        },
        data: {
          calculatorInputs: processed.calculatorInputs,
          productMappings: processed.productMappings.slice(0, 5), // Preview first 5
          featureToggles: processed.featureToggles,
          gateConfigs: processed.gateConfigs.slice(0, 3), // Preview first 3
        },
        validationErrors: processed.validationErrors,
        databaseErrors: dbErrors,
      });

    } catch (error) {
      console.error("Error importing template:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to import template";
      res.status(500).json({ error: errorMessage });
    }
  });

  app.get("/api/templates/download-all", requireAdmin, async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const archiver = await import('archiver');
      
      const templatesDir = path.join(process.cwd(), 'templates', 'tabs');
      
      // Check if directory exists
      if (!fs.existsSync(templatesDir)) {
        return res.status(404).json({ error: "Templates directory not found" });
      }
      
      // Set headers for ZIP download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="fencelogic-templates.zip"');
      
      // Create ZIP archive
      const archive = archiver.default('zip', { zlib: { level: 9 } });
      
      archive.on('error', (err: Error) => {
        console.error("Archive error:", err);
        throw err;
      });
      
      // Pipe archive to response
      archive.pipe(res);
      
      // Add all CSV files from templates/tabs
      archive.directory(templatesDir, false);
      
      // Finalize archive
      await archive.finalize();
    } catch (error) {
      console.error("Error creating ZIP:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create ZIP file" });
      }
    }
  });

  // ============================================
  // Fence Styles API Routes
  // ============================================
  
  // Public: Get all active fence styles
  app.get("/api/styles", async (req, res) => {
    try {
      const styles = await storage.getActiveFenceStyles();
      res.json(styles);
    } catch (error) {
      console.error("Error fetching styles:", error);
      res.status(500).json({ error: "Failed to fetch styles" });
    }
  });
  
  // Public: Get full configuration for a specific style
  app.get("/api/styles/:code/config", async (req, res) => {
    try {
      const { code } = req.params;
      const style = await storage.getFenceStyleByCode(code);
      
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      // Fetch related data
      const [fields, productSlots] = await Promise.all([
        storage.getStyleFields(style.id),
        storage.getStyleProductSlots(style.id)
      ]);
      
      // Fetch product details for slots that have productId
      const productIds = productSlots
        .filter(slot => slot.productId)
        .map(slot => slot.productId!);
      
      const productsMap = new Map();
      if (productIds.length > 0) {
        const products = await Promise.all(
          productIds.map(id => storage.getProduct(id))
        );
        products.forEach(p => {
          if (p) productsMap.set(p.id, p);
        });
      }
      
      // Enrich slots with product data
      const enrichedSlots = productSlots.map(slot => ({
        ...slot,
        product: slot.productId ? productsMap.get(slot.productId) : null
      }));
      
      res.json({
        style,
        fields,
        productSlots: enrichedSlots,
      });
    } catch (error) {
      console.error("Error fetching style config:", error);
      res.status(500).json({ error: "Failed to fetch style configuration" });
    }
  });
  
  // Admin: Get all fence styles (including inactive)
  app.get("/api/admin/styles", requireAdmin, async (req, res) => {
    try {
      const styles = await storage.getAllFenceStyles();
      res.json(styles);
    } catch (error) {
      console.error("Error fetching all styles:", error);
      res.status(500).json({ error: "Failed to fetch styles" });
    }
  });
  
  // Admin: Create new fence style
  app.post("/api/admin/styles", requireAdmin, async (req, res) => {
    try {
      const style = await storage.createFenceStyle(req.body);
      res.status(201).json(style);
    } catch (error) {
      console.error("Error creating style:", error);
      res.status(500).json({ error: "Failed to create style" });
    }
  });
  
  // Admin: Update fence style
  app.patch("/api/admin/styles/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const style = await storage.updateFenceStyle(id, req.body);
      
      if (!style) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      res.json(style);
    } catch (error) {
      console.error("Error updating style:", error);
      res.status(500).json({ error: "Failed to update style" });
    }
  });
  
  // Admin: Delete fence style
  app.delete("/api/admin/styles/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteFenceStyle(id);
      
      if (!success) {
        return res.status(404).json({ error: "Style not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting style:", error);
      res.status(500).json({ error: "Failed to delete style" });
    }
  });
  
  // Admin: Get calculator fields for a style
  app.get("/api/admin/styles/:styleId/fields", requireAdmin, async (req, res) => {
    try {
      const { styleId } = req.params;
      const fields = await storage.getStyleFields(styleId);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching style fields:", error);
      res.status(500).json({ error: "Failed to fetch style fields" });
    }
  });
  
  // Admin: Create calculator field
  app.post("/api/admin/styles/:styleId/fields", requireAdmin, async (req, res) => {
    try {
      const { styleId } = req.params;
      const field = await storage.createStyleField({
        ...req.body,
        fenceStyleId: styleId
      });
      res.status(201).json(field);
    } catch (error) {
      console.error("Error creating field:", error);
      res.status(500).json({ error: "Failed to create field" });
    }
  });
  
  // Admin: Update calculator field
  app.patch("/api/admin/styles/:styleId/fields/:fieldId", requireAdmin, async (req, res) => {
    try {
      const { fieldId } = req.params;
      const field = await storage.updateStyleField(fieldId, req.body);
      
      if (!field) {
        return res.status(404).json({ error: "Field not found" });
      }
      
      res.json(field);
    } catch (error) {
      console.error("Error updating field:", error);
      res.status(500).json({ error: "Failed to update field" });
    }
  });
  
  // Admin: Delete calculator field
  app.delete("/api/admin/styles/:styleId/fields/:fieldId", requireAdmin, async (req, res) => {
    try {
      const { fieldId } = req.params;
      const success = await storage.deleteStyleField(fieldId);
      
      if (!success) {
        return res.status(404).json({ error: "Field not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting field:", error);
      res.status(500).json({ error: "Failed to delete field" });
    }
  });
  
  // Admin: Get product slots for a style
  app.get("/api/admin/styles/:styleId/slots", requireAdmin, async (req, res) => {
    try {
      const { styleId } = req.params;
      const slots = await storage.getStyleProductSlots(styleId);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching slots:", error);
      res.status(500).json({ error: "Failed to fetch slots" });
    }
  });
  
  // Admin: Create product slot
  app.post("/api/admin/styles/:styleId/slots", requireAdmin, async (req, res) => {
    try {
      const { styleId } = req.params;
      const slot = await storage.createStyleProductSlot({
        ...req.body,
        fenceStyleId: styleId
      });
      res.status(201).json(slot);
    } catch (error) {
      console.error("Error creating slot:", error);
      res.status(500).json({ error: "Failed to create slot" });
    }
  });
  
  // Admin: Update product slot
  app.patch("/api/admin/styles/:styleId/slots/:slotId", requireAdmin, async (req, res) => {
    try {
      const { slotId } = req.params;
      const slot = await storage.updateStyleProductSlot(slotId, req.body);
      
      if (!slot) {
        return res.status(404).json({ error: "Slot not found" });
      }
      
      res.json(slot);
    } catch (error) {
      console.error("Error updating slot:", error);
      res.status(500).json({ error: "Failed to update slot" });
    }
  });
  
  // Admin: Delete product slot
  app.delete("/api/admin/styles/:styleId/slots/:slotId", requireAdmin, async (req, res) => {
    try {
      const { slotId } = req.params;
      const success = await storage.deleteStyleProductSlot(slotId);
      
      if (!success) {
        return res.status(404).json({ error: "Slot not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting slot:", error);
      res.status(500).json({ error: "Failed to delete slot" });
    }
  });

  // Admin config routes (Google Sheets OAuth & config)
  app.use("/api/admin/config", requireAdmin, adminConfigRouter);
  app.use("/api/admin/google", requireAdmin, adminConfigRouter);
  
  // Admin sheets sync routes
  app.use("/api/admin/sheets", requireAdmin, adminSheetsRouter);

  // PDF generation
  app.use("/api", pdfRouter);

  // Debug routes
  app.use("/api/debug/ui-config", createDebugUIConfigRouter(storage));
  app.use("/api/debug/resolve-trace", createDebugResolveTraceRouter(storage));
  app.use("/api/debug/products-lint", createDebugProductsLintRouter(storage));
  app.use("/api/debug/endgap-advice", createDebugEndgapAdviceRouter(storage));
  app.use("/api/debug/frameless-custom", createDebugFramelessCustomRouter(storage));

  // Meta routes
  app.use("/api/meta", metaCategoryPathsRouter);

  const httpServer = createServer(app);

  return httpServer;
}
