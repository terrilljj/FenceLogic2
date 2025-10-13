import { type SavedFenceDesign, type InsertFenceDesign, type Product, type InsertProduct, type ProductUIConfig, type InsertProductUIConfig, fenceDesigns, products, productUIConfigs } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Fence Design operations
  getFenceDesign(id: string): Promise<SavedFenceDesign | undefined>;
  getAllFenceDesigns(): Promise<SavedFenceDesign[]>;
  createFenceDesign(design: InsertFenceDesign): Promise<SavedFenceDesign>;
  deleteFenceDesign(id: string): Promise<boolean>;
  
  // Product operations
  getProduct(id: string): Promise<Product | undefined>;
  getProductByCode(code: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  // Product UI Configuration operations
  getUIConfig(productVariant: string): Promise<ProductUIConfig | undefined>;
  getAllUIConfigs(): Promise<ProductUIConfig[]>;
  createOrUpdateUIConfig(config: InsertProductUIConfig): Promise<ProductUIConfig>;
  deleteUIConfig(productVariant: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Fence Design operations
  async getFenceDesign(id: string): Promise<SavedFenceDesign | undefined> {
    const [design] = await db.select().from(fenceDesigns).where(eq(fenceDesigns.id, id));
    return design || undefined;
  }

  async getAllFenceDesigns(): Promise<SavedFenceDesign[]> {
    return await db.select().from(fenceDesigns);
  }

  async createFenceDesign(insertDesign: InsertFenceDesign): Promise<SavedFenceDesign> {
    const [design] = await db
      .insert(fenceDesigns)
      .values(insertDesign)
      .returning();
    return design;
  }

  async deleteFenceDesign(id: string): Promise<boolean> {
    const result = await db.delete(fenceDesigns).where(eq(fenceDesigns.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Product operations
  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }
  
  async getProductByCode(code: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.code, code));
    return product || undefined;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values(insertProduct)
      .returning();
    return product;
  }

  async updateProduct(id: string, updateData: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();
    return product || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Product UI Configuration operations
  async getUIConfig(productVariant: string): Promise<ProductUIConfig | undefined> {
    const [config] = await db.select().from(productUIConfigs).where(eq(productUIConfigs.productVariant, productVariant));
    return config || undefined;
  }

  async getAllUIConfigs(): Promise<ProductUIConfig[]> {
    return await db.select().from(productUIConfigs);
  }

  async createOrUpdateUIConfig(insertConfig: InsertProductUIConfig): Promise<ProductUIConfig> {
    const existing = await this.getUIConfig(insertConfig.productVariant);
    
    if (existing) {
      const [config] = await db
        .update(productUIConfigs)
        .set({ 
          fieldConfigs: insertConfig.fieldConfigs as any,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(productUIConfigs.productVariant, insertConfig.productVariant))
        .returning();
      return config;
    } else {
      const [config] = await db
        .insert(productUIConfigs)
        .values({
          productVariant: insertConfig.productVariant,
          fieldConfigs: insertConfig.fieldConfigs as any,
        })
        .returning();
      return config;
    }
  }

  async deleteUIConfig(productVariant: string): Promise<boolean> {
    const result = await db.delete(productUIConfigs).where(eq(productUIConfigs.productVariant, productVariant));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

export const storage = new DatabaseStorage();
