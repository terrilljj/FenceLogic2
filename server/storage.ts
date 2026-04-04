import { 
  type SavedFenceDesign, type InsertFenceDesign, 
  type Product, type InsertProduct, 
  type ProductUIConfig, type InsertProductUIConfig, 
  type FenceUIConfig, type InsertFenceUIConfig, 
  type Category, type InsertCategory, 
  type Subcategory, type InsertSubcategory, 
  type ProductSlot, type InsertProductSlot,
  type FenceStyle, type InsertFenceStyle,
  type StyleCalculatorField, type InsertStyleCalculatorField,
  type StyleProductSlot, type InsertStyleProductSlot,
  fenceDesigns, products, productUIConfigs, fenceUIConfigs, categories, subcategories, productSlots,
  fenceStyles, styleCalculatorFields, styleProductSlots
} from "@shared/schema";
import { db } from "./db";
import { eq, asc, sql as sqlOp, and } from "drizzle-orm";

export interface IStorage {
  // Fence Design operations
  getFenceDesign(id: string, sessionId?: string): Promise<SavedFenceDesign | undefined>;
  getFenceDesignsBySession(sessionId: string): Promise<SavedFenceDesign[]>;
  createFenceDesign(design: InsertFenceDesign): Promise<SavedFenceDesign>;
  deleteFenceDesign(id: string, sessionId?: string): Promise<boolean>;
  
  // Product operations
  getProduct(id: string): Promise<Product | undefined>;
  getProductByCode(code: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  upsertProduct(product: InsertProduct): Promise<{ product: Product; created: boolean }>;
  deleteProduct(id: string): Promise<boolean>;
  
  // Product UI Configuration operations
  getUIConfig(productVariant: string): Promise<ProductUIConfig | undefined>;
  getAllUIConfigs(): Promise<ProductUIConfig[]>;
  createOrUpdateUIConfig(config: InsertProductUIConfig): Promise<ProductUIConfig>;
  deleteUIConfig(productVariant: string): Promise<boolean>;
  
  // Fence UI Configuration operations
  getFenceUIConfig(fenceStyleId: string): Promise<FenceUIConfig | undefined>;
  getAllFenceUIConfigs(): Promise<FenceUIConfig[]>;
  createOrUpdateFenceUIConfig(config: InsertFenceUIConfig): Promise<FenceUIConfig>;
  deleteFenceUIConfig(fenceStyleId: string): Promise<boolean>;
  
  // Category operations
  getCategory(id: string): Promise<Category | undefined>;
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  
  // Subcategory operations
  getSubcategory(id: string): Promise<Subcategory | undefined>;
  getAllSubcategories(): Promise<Subcategory[]>;
  createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: string, subcategory: Partial<InsertSubcategory>): Promise<Subcategory | undefined>;
  deleteSubcategory(id: string): Promise<boolean>;
  
  // Product Slot operations
  getSlotsByVariantAndField(productVariant: string, fieldName: string): Promise<ProductSlot[]>;
  getAllSlotsByVariant(productVariant: string): Promise<ProductSlot[]>;
  createProductSlot(slot: InsertProductSlot): Promise<ProductSlot>;
  createProductSlots(slots: InsertProductSlot[]): Promise<ProductSlot[]>;
  updateProductSlot(id: string, slot: Partial<InsertProductSlot>): Promise<ProductSlot | undefined>;
  deleteProductSlot(id: string): Promise<boolean>;
  deleteSlotsByVariantAndField(productVariant: string, fieldName: string): Promise<boolean>;
  
  // Fence Style operations
  getFenceStyle(id: string): Promise<FenceStyle | undefined>;
  getFenceStyleByCode(code: string): Promise<FenceStyle | undefined>;
  getAllFenceStyles(): Promise<FenceStyle[]>;
  getActiveFenceStyles(): Promise<FenceStyle[]>;
  createFenceStyle(style: InsertFenceStyle): Promise<FenceStyle>;
  updateFenceStyle(id: string, style: Partial<InsertFenceStyle>): Promise<FenceStyle | undefined>;
  deleteFenceStyle(id: string): Promise<boolean>;
  getStyleWithCalculatorConfig(code: string): Promise<{ style: FenceStyle; fields: StyleCalculatorField[] } | undefined>;
  
  // Style Calculator Field operations
  getStyleFields(fenceStyleId: string): Promise<StyleCalculatorField[]>;
  createStyleField(field: InsertStyleCalculatorField): Promise<StyleCalculatorField>;
  updateStyleField(id: string, field: Partial<InsertStyleCalculatorField>): Promise<StyleCalculatorField | undefined>;
  deleteStyleField(id: string): Promise<boolean>;
  deleteStyleFields(fenceStyleId: string): Promise<boolean>;
  
  // Style Product Slot operations
  getStyleProductSlots(fenceStyleId: string): Promise<StyleProductSlot[]>;
  getStyleProductSlotsByField(fenceStyleId: string, fieldKey: string): Promise<StyleProductSlot[]>;
  createStyleProductSlot(slot: InsertStyleProductSlot): Promise<StyleProductSlot>;
  createStyleProductSlots(slots: InsertStyleProductSlot[]): Promise<StyleProductSlot[]>;
  updateStyleProductSlot(id: string, slot: Partial<InsertStyleProductSlot>): Promise<StyleProductSlot | undefined>;
  deleteStyleProductSlot(id: string): Promise<boolean>;
  deleteStyleProductSlots(fenceStyleId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Fence Design operations
  async getFenceDesign(id: string, sessionId?: string): Promise<SavedFenceDesign | undefined> {
    const conditions = [eq(fenceDesigns.id, id)];
    if (sessionId) {
      conditions.push(eq(fenceDesigns.sessionId, sessionId));
    }
    const [design] = await db.select().from(fenceDesigns).where(and(...conditions));
    return design || undefined;
  }

  async getFenceDesignsBySession(sessionId: string): Promise<SavedFenceDesign[]> {
    return await db.select().from(fenceDesigns).where(eq(fenceDesigns.sessionId, sessionId));
  }

  async createFenceDesign(insertDesign: InsertFenceDesign): Promise<SavedFenceDesign> {
    const [design] = await db
      .insert(fenceDesigns)
      .values(insertDesign)
      .returning();
    return design;
  }

  async deleteFenceDesign(id: string, sessionId?: string): Promise<boolean> {
    const conditions = [eq(fenceDesigns.id, id)];
    if (sessionId) {
      conditions.push(eq(fenceDesigns.sessionId, sessionId));
    }
    const result = await db.delete(fenceDesigns).where(and(...conditions));
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

  async upsertProduct(insertProduct: InsertProduct): Promise<{ product: Product; created: boolean }> {
    const existing = await this.getProductByCode(insertProduct.code);
    
    if (existing) {
      const [product] = await db
        .update(products)
        .set({
          description: insertProduct.description,
          category: insertProduct.category,
          subcategory: insertProduct.subcategory,
          price: insertProduct.price,
          weight: insertProduct.weight,
          dimensions: insertProduct.dimensions,
          units: insertProduct.units,
          tags: insertProduct.tags as any,
          notes: insertProduct.notes,
          imageUrl: insertProduct.imageUrl,
          active: insertProduct.active,
          categoryPaths: insertProduct.categoryPaths as any,
          selectionId: insertProduct.selectionId,
        })
        .where(eq(products.code, insertProduct.code))
        .returning();
      return { product, created: false };
    } else {
      const [product] = await db
        .insert(products)
        .values(insertProduct)
        .returning();
      return { product, created: true };
    }
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
          allowedCategories: insertConfig.allowedCategories as any,
          allowedSubcategories: insertConfig.allowedSubcategories as any,
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
          allowedCategories: insertConfig.allowedCategories as any,
          allowedSubcategories: insertConfig.allowedSubcategories as any,
        })
        .returning();
      return config;
    }
  }

  async deleteUIConfig(productVariant: string): Promise<boolean> {
    const result = await db.delete(productUIConfigs).where(eq(productUIConfigs.productVariant, productVariant));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Fence UI Configuration operations
  async getFenceUIConfig(fenceStyleId: string): Promise<FenceUIConfig | undefined> {
    const [config] = await db.select().from(fenceUIConfigs).where(eq(fenceUIConfigs.fenceStyleId, fenceStyleId));
    return config || undefined;
  }

  async getAllFenceUIConfigs(): Promise<FenceUIConfig[]> {
    return await db.select().from(fenceUIConfigs).orderBy(asc(fenceUIConfigs.displayName));
  }

  async createOrUpdateFenceUIConfig(insertConfig: InsertFenceUIConfig): Promise<FenceUIConfig> {
    const existing = await this.getFenceUIConfig(insertConfig.fenceStyleId);
    
    if (existing) {
      const [config] = await db
        .update(fenceUIConfigs)
        .set({ 
          displayName: insertConfig.displayName,
          productVariantRefs: insertConfig.productVariantRefs as any,
          status: insertConfig.status,
          config: insertConfig.config as any,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(fenceUIConfigs.fenceStyleId, insertConfig.fenceStyleId))
        .returning();
      return config;
    } else {
      const [config] = await db
        .insert(fenceUIConfigs)
        .values({
          fenceStyleId: insertConfig.fenceStyleId,
          displayName: insertConfig.displayName,
          productVariantRefs: insertConfig.productVariantRefs as any,
          status: insertConfig.status || 'active',
          config: insertConfig.config as any,
        })
        .returning();
      return config;
    }
  }

  async deleteFenceUIConfig(fenceStyleId: string): Promise<boolean> {
    const result = await db.delete(fenceUIConfigs).where(eq(fenceUIConfigs.fenceStyleId, fenceStyleId));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Category operations
  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(asc(categories.displayOrder), asc(categories.name));
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async updateCategory(id: string, updateData: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, id))
      .returning();
    return category || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const category = await this.getCategory(id);
    if (!category) {
      return false;
    }
    
    // Use transaction to atomically remove category from all UI configs and delete it
    const result = await db.transaction(async (tx) => {
      // Update all UI configs to remove this category using SQL
      await tx.execute(
        sqlOp`UPDATE product_ui_configs 
              SET allowed_categories = COALESCE((
                SELECT jsonb_agg(elem)
                FROM jsonb_array_elements_text(allowed_categories) AS elem
                WHERE elem != ${category.name}
              ), '[]'::jsonb),
              updated_at = ${new Date().toISOString()}
              WHERE allowed_categories ? ${category.name}`
      );
      
      // Delete the category
      const deleteResult = await tx.delete(categories).where(eq(categories.id, id));
      return deleteResult.rowCount ? deleteResult.rowCount > 0 : false;
    });
    
    return result;
  }
  
  // Subcategory operations
  async getSubcategory(id: string): Promise<Subcategory | undefined> {
    const [subcategory] = await db.select().from(subcategories).where(eq(subcategories.id, id));
    return subcategory || undefined;
  }

  async getAllSubcategories(): Promise<Subcategory[]> {
    return await db.select().from(subcategories).orderBy(asc(subcategories.displayOrder), asc(subcategories.name));
  }

  async getSubcategoriesByCategory(categoryId: string): Promise<Subcategory[]> {
    return await db.select().from(subcategories)
      .where(eq(subcategories.categoryId, categoryId))
      .orderBy(asc(subcategories.displayOrder), asc(subcategories.name));
  }

  async createSubcategory(insertSubcategory: InsertSubcategory): Promise<Subcategory> {
    const [subcategory] = await db
      .insert(subcategories)
      .values(insertSubcategory)
      .returning();
    return subcategory;
  }

  async updateSubcategory(id: string, updateData: Partial<InsertSubcategory>): Promise<Subcategory | undefined> {
    const [subcategory] = await db
      .update(subcategories)
      .set(updateData)
      .where(eq(subcategories.id, id))
      .returning();
    return subcategory || undefined;
  }

  async deleteSubcategory(id: string): Promise<boolean> {
    const subcategory = await this.getSubcategory(id);
    if (!subcategory) {
      return false;
    }
    
    // Use transaction to atomically remove subcategory from all UI configs and delete it
    const result = await db.transaction(async (tx) => {
      // Update all UI configs to remove this subcategory using SQL
      await tx.execute(
        sqlOp`UPDATE product_ui_configs 
              SET allowed_subcategories = COALESCE((
                SELECT jsonb_agg(elem)
                FROM jsonb_array_elements_text(allowed_subcategories) AS elem
                WHERE elem != ${subcategory.name}
              ), '[]'::jsonb),
              updated_at = ${new Date().toISOString()}
              WHERE allowed_subcategories ? ${subcategory.name}`
      );
      
      // Delete the subcategory
      const deleteResult = await tx.delete(subcategories).where(eq(subcategories.id, id));
      return deleteResult.rowCount ? deleteResult.rowCount > 0 : false;
    });
    
    return result;
  }
  
  // Product Slot operations
  async getSlotsByVariantAndField(productVariant: string, fieldName: string): Promise<ProductSlot[]> {
    return await db.select().from(productSlots)
      .where(and(
        eq(productSlots.productVariant, productVariant),
        eq(productSlots.fieldName, fieldName)
      ))
      .orderBy(asc(productSlots.sequence));
  }
  
  async getAllSlotsByVariant(productVariant: string): Promise<ProductSlot[]> {
    return await db.select().from(productSlots)
      .where(eq(productSlots.productVariant, productVariant))
      .orderBy(asc(productSlots.fieldName), asc(productSlots.sequence));
  }
  
  async createProductSlot(insertSlot: InsertProductSlot): Promise<ProductSlot> {
    const [slot] = await db
      .insert(productSlots)
      .values(insertSlot)
      .returning();
    return slot;
  }
  
  async createProductSlots(slots: InsertProductSlot[]): Promise<ProductSlot[]> {
    const createdSlots = await db
      .insert(productSlots)
      .values(slots)
      .returning();
    return createdSlots;
  }
  
  async updateProductSlot(id: string, updateData: Partial<InsertProductSlot>): Promise<ProductSlot | undefined> {
    const [slot] = await db
      .update(productSlots)
      .set({ ...updateData, updatedAt: new Date().toISOString() })
      .where(eq(productSlots.id, id))
      .returning();
    return slot || undefined;
  }
  
  async deleteProductSlot(id: string): Promise<boolean> {
    const result = await db.delete(productSlots).where(eq(productSlots.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async deleteSlotsByVariantAndField(productVariant: string, fieldName: string): Promise<boolean> {
    const result = await db.delete(productSlots)
      .where(and(
        eq(productSlots.productVariant, productVariant),
        eq(productSlots.fieldName, fieldName)
      ));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Fence Style operations
  async getFenceStyle(id: string): Promise<FenceStyle | undefined> {
    const [style] = await db.select().from(fenceStyles).where(eq(fenceStyles.id, id));
    return style || undefined;
  }
  
  async getFenceStyleByCode(code: string): Promise<FenceStyle | undefined> {
    const [style] = await db.select().from(fenceStyles).where(eq(fenceStyles.code, code));
    return style || undefined;
  }
  
  async getStyleWithCalculatorConfig(code: string): Promise<{ style: FenceStyle; fields: StyleCalculatorField[] } | undefined> {
    const style = await this.getFenceStyleByCode(code);
    if (!style) return undefined;
    
    const fields = await this.getStyleFields(style.id);
    return { style, fields };
  }
  
  async getAllFenceStyles(): Promise<FenceStyle[]> {
    return await db.select().from(fenceStyles).orderBy(asc(fenceStyles.displayOrder));
  }
  
  async getActiveFenceStyles(): Promise<FenceStyle[]> {
    return await db.select().from(fenceStyles)
      .where(eq(fenceStyles.isActive, 1))
      .orderBy(asc(fenceStyles.displayOrder));
  }
  
  async createFenceStyle(insertStyle: InsertFenceStyle): Promise<FenceStyle> {
    const [style] = await db
      .insert(fenceStyles)
      .values(insertStyle)
      .returning();
    return style;
  }
  
  async updateFenceStyle(id: string, updateData: Partial<InsertFenceStyle>): Promise<FenceStyle | undefined> {
    const [style] = await db
      .update(fenceStyles)
      .set({ ...updateData, updatedAt: new Date().toISOString() })
      .where(eq(fenceStyles.id, id))
      .returning();
    return style || undefined;
  }
  
  async deleteFenceStyle(id: string): Promise<boolean> {
    const result = await db.delete(fenceStyles).where(eq(fenceStyles.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Style Calculator Field operations
  async getStyleFields(fenceStyleId: string): Promise<StyleCalculatorField[]> {
    return await db.select().from(styleCalculatorFields)
      .where(eq(styleCalculatorFields.fenceStyleId, fenceStyleId))
      .orderBy(asc(styleCalculatorFields.displayOrder));
  }
  
  async createStyleField(insertField: InsertStyleCalculatorField): Promise<StyleCalculatorField> {
    const [field] = await db
      .insert(styleCalculatorFields)
      .values(insertField)
      .returning();
    return field;
  }
  
  async updateStyleField(id: string, updateData: Partial<InsertStyleCalculatorField>): Promise<StyleCalculatorField | undefined> {
    const [field] = await db
      .update(styleCalculatorFields)
      .set({ ...updateData, updatedAt: new Date().toISOString() })
      .where(eq(styleCalculatorFields.id, id))
      .returning();
    return field || undefined;
  }
  
  async deleteStyleField(id: string): Promise<boolean> {
    const result = await db.delete(styleCalculatorFields).where(eq(styleCalculatorFields.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async deleteStyleFields(fenceStyleId: string): Promise<boolean> {
    const result = await db.delete(styleCalculatorFields)
      .where(eq(styleCalculatorFields.fenceStyleId, fenceStyleId));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  // Style Product Slot operations
  async getStyleProductSlots(fenceStyleId: string): Promise<StyleProductSlot[]> {
    return await db.select().from(styleProductSlots)
      .where(eq(styleProductSlots.fenceStyleId, fenceStyleId))
      .orderBy(asc(styleProductSlots.fieldKey), asc(styleProductSlots.displayOrder));
  }
  
  async getStyleProductSlotsByField(fenceStyleId: string, fieldKey: string): Promise<StyleProductSlot[]> {
    return await db.select().from(styleProductSlots)
      .where(and(
        eq(styleProductSlots.fenceStyleId, fenceStyleId),
        eq(styleProductSlots.fieldKey, fieldKey)
      ))
      .orderBy(asc(styleProductSlots.displayOrder));
  }
  
  async createStyleProductSlot(insertSlot: InsertStyleProductSlot): Promise<StyleProductSlot> {
    const [slot] = await db
      .insert(styleProductSlots)
      .values(insertSlot)
      .returning();
    return slot;
  }
  
  async createStyleProductSlots(slots: InsertStyleProductSlot[]): Promise<StyleProductSlot[]> {
    const createdSlots = await db
      .insert(styleProductSlots)
      .values(slots)
      .returning();
    return createdSlots;
  }
  
  async updateStyleProductSlot(id: string, updateData: Partial<InsertStyleProductSlot>): Promise<StyleProductSlot | undefined> {
    const [slot] = await db
      .update(styleProductSlots)
      .set({ ...updateData, updatedAt: new Date().toISOString() })
      .where(eq(styleProductSlots.id, id))
      .returning();
    return slot || undefined;
  }
  
  async deleteStyleProductSlot(id: string): Promise<boolean> {
    const result = await db.delete(styleProductSlots).where(eq(styleProductSlots.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }
  
  async deleteStyleProductSlots(fenceStyleId: string): Promise<boolean> {
    const result = await db.delete(styleProductSlots)
      .where(eq(styleProductSlots.fenceStyleId, fenceStyleId));
    return result.rowCount ? result.rowCount > 0 : false;
  }
}

export const storage = new DatabaseStorage();
