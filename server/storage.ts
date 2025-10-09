import { type SavedFenceDesign, type InsertFenceDesign } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Fence Design operations
  getFenceDesign(id: string): Promise<SavedFenceDesign | undefined>;
  getAllFenceDesigns(): Promise<SavedFenceDesign[]>;
  createFenceDesign(design: InsertFenceDesign): Promise<SavedFenceDesign>;
  deleteFenceDesign(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private fenceDesigns: Map<string, SavedFenceDesign>;

  constructor() {
    this.fenceDesigns = new Map();
  }

  async getFenceDesign(id: string): Promise<SavedFenceDesign | undefined> {
    return this.fenceDesigns.get(id);
  }

  async getAllFenceDesigns(): Promise<SavedFenceDesign[]> {
    return Array.from(this.fenceDesigns.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createFenceDesign(insertDesign: InsertFenceDesign): Promise<SavedFenceDesign> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const design: SavedFenceDesign = {
      ...insertDesign,
      id,
      createdAt,
    };
    this.fenceDesigns.set(id, design);
    return design;
  }

  async deleteFenceDesign(id: string): Promise<boolean> {
    return this.fenceDesigns.delete(id);
  }
}

export const storage = new MemStorage();
