import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFenceDesignSchema, insertProductSchema, insertProductUIConfigSchema, insertCategorySchema, insertSubcategorySchema } from "@shared/schema";
import { z } from "zod";
import { requireAdmin } from "./middleware/auth";

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
      
      // 1. Frameless Pool Fence (Spigots)
      const framelessPoolProducts = [
        'GP-1200-1200-12,"Glass Panel 1200mm x 1200mm (12mm thick)",Frameless Pool Fence,,$450.00,,,,,,1',
        'GP-1500-1200-12,"Glass Panel 1500mm x 1200mm (12mm thick)",Frameless Pool Fence,,$520.00,,,,,,1',
        'GP-1200-1200-15,"Glass Panel 1200mm x 1200mm (15mm thick)",Frameless Pool Fence,,$580.00,,,,,,1',
        'RP-LEFT-1200-1400,"Left Raked Panel 1200mm x 1400mm",Frameless Pool Fence,,$520.00,,,,,,1',
        'RP-RIGHT-1200-1400,"Right Raked Panel 1200mm x 1400mm",Frameless Pool Fence,,$520.00,,,,,,1',
        'GP-CUSTOM-1200-1500-12,"Custom Glass Panel 1200mm x 1500mm (12mm thick)",Frameless Pool Fence,,$550.00,,,,,,1',
        'SPIGOT-BASE_PLATE-POLISHED,"Spigot Base Plate Mount (Polished)",Frameless Pool Fence,,$85.00,,,,,,1',
        'SPIGOT-CORE_DRILLED-SATIN,"Spigot Core Drilled (Satin)",Frameless Pool Fence,,$85.00,,,,,,1',
        'SPIGOT-SIDE_MOUNTED-BLACK,"Spigot Side Mounted (Black)",Frameless Pool Fence,,$90.00,,,,,,1',
        'HINGE-MASTER-G2G,"Master Range Glass-to-Glass Hinge Set",Frameless Pool Fence,,$320.00,,,,,,1',
        'HINGE-POLARIS-G2G,"Polaris/Atlantic Glass-to-Glass Hinge Set",Frameless Pool Fence,,$380.00,,,,,,1',
        'LATCH-G2G,"Glass-to-Glass Latch",Frameless Pool Fence,,$180.00,,,,,,1',
      ];
      
      // 2. Channel Pool Fence
      const channelPoolProducts = [
        'GP-CHANNEL-1200-12,"Channel Glass Panel 1200mm (12mm thick)",Channel Pool Fence,,$420.00,,,,,,1',
        'GP-CHANNEL-1500-12,"Channel Glass Panel 1500mm (12mm thick)",Channel Pool Fence,,$490.00,,,,,,1',
        'CHANNEL-AL-BASE,"Aluminium Base Channel (per meter)",Channel Pool Fence,,$65.00,,,,,,1',
        'HINGE-MASTER-G2W,"Master Range Glass-to-Wall Hinge Set",Channel Pool Fence,,$310.00,,,,,,1',
        'LATCH-G2W,"Glass-to-Wall Latch",Channel Pool Fence,,$175.00,,,,,,1',
      ];
      
      // 3. Flat Top Pool Fence (Tubular)
      const flatTopPoolProducts = [
        'TUBULAR-1200-2450-BLACK,"Tubular Panel 1200mm x 2450mm (Black)",Flat Top Pool Fence,,$395.00,,,,,,1',
        'TUBULAR-1200-3000-BLACK,"Tubular Panel 1200mm x 3000mm (Black)",Flat Top Pool Fence,,$465.00,,,,,,1',
        'TUBULAR-GATE-1200-975-BLACK,"Tubular Gate 1200mm x 975mm (Black)",Flat Top Pool Fence,,$385.00,,,,,,1',
        'TUBULAR-POST-STD-1200-BLACK,"Tubular Standard Post 1200mm (Black)",Flat Top Pool Fence,,$75.00,,,,,,1',
      ];
      
      // 4. BARR Pool Fence
      const barrPoolProducts = [
        'BARR-1000-1733-CN150A,"BARR Panel 1000mm x 1733mm (Satin Black)",BARR Pool Fence,,$385.00,,,,,,1',
        'BARR-1200-2205-CN150A,"BARR Panel 1200mm x 2205mm (Satin Black)",BARR Pool Fence,,$485.00,,,,,,1',
        'BARR-1000-1733-CNPW,"BARR Panel 1000mm x 1733mm (Pearl White)",BARR Pool Fence,,$385.00,,,,,,1',
        'BARR-GATE-1200-975-CN150A,"BARR Gate 1200mm x 975mm (Satin Black)",BARR Pool Fence,,$420.00,,,,,,1',
        'BARR-POST-STD-1200-CN150A,"BARR Standard Post 1200mm (Satin Black)",BARR Pool Fence,,$85.00,,,,,,1',
        'BARR-POST-WBP-1200-CN150A,"BARR Welded Base Plate Post 1200mm (Satin Black)",BARR Pool Fence,,$125.00,,,,,,1',
      ];
      
      // 5. Blade Pool Fence
      const bladePoolProducts = [
        'BLADE-1000-1700-CN150A,"Blade Panel 1000mm x 1700mm (Satin Black)",Blade Pool Fence,,$425.00,,,,,,1',
        'BLADE-1200-2200-CN150A,"Blade Panel 1200mm x 2200mm (Satin Black)",Blade Pool Fence,,$545.00,,,,,,1',
        'BLADE-1000-1700-CNPW,"Blade Panel 1000mm x 1700mm (Pearl White)",Blade Pool Fence,,$425.00,,,,,,1',
        'BLADE-GATE-1200-975-CN150A,"Blade Gate 1200mm x 975mm (Satin Black)",Blade Pool Fence,,$460.00,,,,,,1',
        'BLADE-POST-STD-1200-CN150A,"Blade Standard Post 1200mm (Satin Black)",Blade Pool Fence,,$95.00,,,,,,1',
        'BLADE-POST-WBP-1200-CN150A,"Blade Welded Base Plate Post 1200mm (Satin Black)",Blade Pool Fence,,$135.00,,,,,,1',
      ];
      
      // 6. Hamptons Full Privacy
      const hamptonsFullProducts = [
        'HAMPTONS-FULL_PRIVACY-2388,"Hamptons Full Privacy Panel 2388mm (1800mm high)",Hamptons Full Privacy,,$485.00,,,,,,1',
        'HAMPTONS-GATE-FULL_PRIVACY-1000,"Hamptons Full Privacy Gate 1000mm",Hamptons Full Privacy,,$425.00,,,,,,1',
        'HAMPTONS-POST-1WAY,"Hamptons 1-Way Post 127mm",Hamptons Full Privacy,,$95.00,,,,,,1',
        'HAMPTONS-POST-GATE,"Hamptons Gate Post 127mm",Hamptons Full Privacy,,$125.00,,,,,,1',
      ];
      
      // 7. Hamptons Combo
      const hamptonsComboProducts = [
        'HAMPTONS-COMBO-2388,"Hamptons Combo Panel 2388mm (1800mm high)",Hamptons Combo,,$465.00,,,,,,1',
        'HAMPTONS-GATE-COMBO-1000,"Hamptons Combo Gate 1000mm",Hamptons Combo,,$410.00,,,,,,1',
        'HAMPTONS-POST-2WAY,"Hamptons 2-Way Post 127mm",Hamptons Combo,,$105.00,,,,,,1',
      ];
      
      // 8. Hamptons Vertical Paling
      const hamptonsVerticalProducts = [
        'HAMPTONS-VERTICAL_PALING-2388,"Hamptons Vertical Paling Panel 2388mm (1800mm high)",Hamptons Vertical Paling,,$445.00,,,,,,1',
        'HAMPTONS-GATE-VERTICAL-1000,"Hamptons Vertical Paling Gate 1000mm",Hamptons Vertical Paling,,$395.00,,,,,,1',
      ];
      
      // 9. Hamptons Semi Privacy
      const hamptonsSemiProducts = [
        'HAMPTONS-SEMI_PRIVACY-2388,"Hamptons Semi Privacy Panel 2388mm (1000mm high)",Hamptons Semi Privacy,,$325.00,,,,,,1',
        'HAMPTONS-GATE-SEMI-1000,"Hamptons Semi Privacy Gate 1000mm",Hamptons Semi Privacy,,$295.00,,,,,,1',
      ];
      
      // 10. Hamptons 3 Rail
      const hamptons3RailProducts = [
        'HAMPTONS-3RAIL-2388,"Hamptons 3 Rail Panel 2388mm (1525mm high)",Hamptons 3 Rail,,$385.00,,,,,,1',
        'HAMPTONS-GATE-3RAIL-1000,"Hamptons 3 Rail Gate 1000mm",Hamptons 3 Rail,,$345.00,,,,,,1',
        'HAMPTONS-POST-90DEG,"Hamptons 90-Degree Post 127mm",Hamptons 3 Rail,,$110.00,,,,,,1',
      ];
      
      // 11. Frameless Balustrade (Spigots)
      const framelessBalProducts = [
        'GP-BAL-1200-1000-12,"Glass Panel 1200mm x 1000mm (12mm thick)",Frameless Balustrade,,$420.00,,,,,,1',
        'GP-BAL-1200-1000-15,"Glass Panel 1200mm x 1000mm (15mm thick)",Frameless Balustrade,,$550.00,,,,,,1',
        'SPIGOT-BASE_PLATE-POLISHED,"Spigot Base Plate Mount (Polished)",Frameless Balustrade,,$85.00,,,,,,1',
        'HANDRAIL-NONORAIL-25X21-SS,"Handrail Nonorail 25x21mm Stainless Steel",Frameless Balustrade,,$120.00,,,,,,1',
      ];
      
      // 12. Channel Balustrade
      const channelBalProducts = [
        'GP-BAL-CHANNEL-1200-12,"Channel Glass Panel 1200mm (12mm thick)",Channel Balustrade,,$390.00,,,,,,1',
        'CHANNEL-AL-TOP,"Aluminium Top Channel (per meter)",Channel Balustrade,,$75.00,,,,,,1',
        'HANDRAIL-NANORAIL-30X21-AL,"Handrail Nanorail 30x21mm Anodised Aluminium",Channel Balustrade,,$110.00,,,,,,1',
      ];
      
      // 13. Standoff Balustrade
      const standoffBalProducts = [
        'GP-STANDOFF-800-1000-15,"Standoff Glass Panel 800mm x 1000mm (15mm thick)",Standoff Balustrade,,$480.00,,,,,,1',
        'GP-STANDOFF-1200-1000-15,"Standoff Glass Panel 1200mm x 1000mm (15mm thick)",Standoff Balustrade,,$580.00,,,,,,1',
        'STANDOFF-50-POLISHED,"Standoff Pin 50mm (Polished)",Standoff Balustrade,,$45.00,,,,,,1',
        'STANDOFF-50-SATIN,"Standoff Pin 50mm (Satin)",Standoff Balustrade,,$45.00,,,,,,1',
      ];
      
      // 14. Aluminium Balustrade
      const aluBalProducts = [
        'BARR-1800-1969-CN150A,"BARR Panel 1800mm x 1969mm (Satin Black)",Aluminium Balustrade,,$520.00,,,,,,1',
        'BARR-POST-BAL-1800-CN150A,"BARR Balustrade Post 1800mm (Satin Black)",Aluminium Balustrade,,$95.00,,,,,,1',
        'TUBULAR-900-2450-WHITE,"Tubular Panel 900mm x 2450mm (White)",Aluminium Balustrade,,$365.00,,,,,,1',
      ];
      
      const allProducts = [
        ...framelessPoolProducts,
        ...channelPoolProducts,
        ...flatTopPoolProducts,
        ...barrPoolProducts,
        ...bladePoolProducts,
        ...hamptonsFullProducts,
        ...hamptonsComboProducts,
        ...hamptonsVerticalProducts,
        ...hamptonsSemiProducts,
        ...hamptons3RailProducts,
        ...framelessBalProducts,
        ...channelBalProducts,
        ...standoffBalProducts,
        ...aluBalProducts,
      ];
      
      const csvTemplate = csvHeader + allProducts.join("\n") + "\n";
      
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
      
      const csvHeader = "code,description,category,subcategory,price,weight,dimensions,units,tags,notes,imageUrl,active\n";
      const csvRows = products.map((p) => {
        const code = p.code.replace(/"/g, '""');
        const description = p.description.replace(/"/g, '""');
        const category = (p.category || "").replace(/"/g, '""');
        const subcategory = (p.subcategory || "").replace(/"/g, '""');
        const price = (p.price || "").replace(/"/g, '""');
        const weight = (p.weight || "").replace(/"/g, '""');
        const dimensions = (p.dimensions || "").replace(/"/g, '""');
        const units = (p.units || "").replace(/"/g, '""');
        const tags = (p.tags || []).join(", ").replace(/"/g, '""');
        const notes = (p.notes || "").replace(/"/g, '""');
        const imageUrl = (p.imageUrl || "").replace(/"/g, '""');
        const active = p.active;
        return `"${code}","${description}","${category}","${subcategory}","${price}","${weight}","${dimensions}","${units}","${tags}","${notes}","${imageUrl}",${active}`;
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

  // UI Configuration routes (admin only)
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

  const httpServer = createServer(app);

  return httpServer;
}
