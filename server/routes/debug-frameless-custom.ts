import { Router } from "express";
import type { IStorage } from "../storage";
import { z } from "zod";
import { composeFenceSegments } from "../../shared/calc/compose";

/**
 * Debug router for Frameless Custom Panel composition
 * 
 * Helps developers test and validate the frameless_custom feature
 * which allows custom panel insertion at specified positions.
 */
export function createDebugFramelessCustomRouter(storage: IStorage): Router {
  const router = Router();

  // Schema for composition request with custom panel
  const composeRequestSchema = z.object({
    runLengthMm: z.number().positive(),
    startGapMm: z.number().nonnegative(),
    endGapMm: z.number().nonnegative(),
    betweenGapMm: z.number().nonnegative(),
    maxPanelMm: z.number().positive(),
    minPanelMm: z.number().positive(),
    customPanelConfig: z.object({
      required: z.boolean(),
      panelWidthMm: z.number().positive(),
      panelHeightMm: z.number().positive().optional(),
      position: z.number().min(0).max(1),
      gapBeforeMm: z.number().nonnegative().optional(),
      gapAfterMm: z.number().nonnegative().optional(),
    }),
  });

  /**
   * POST /api/debug/frameless-custom/compose
   * 
   * Test custom panel composition with specified configuration
   */
  router.post("/compose", async (req, res) => {
    try {
      const validated = composeRequestSchema.parse(req.body);

      const result = composeFenceSegments(validated);

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      console.error("Error in frameless-custom compose:", error);
      res.status(500).json({ error: "Failed to compose custom panel layout" });
    }
  });

  /**
   * POST /api/debug/frameless-custom/validate
   * 
   * Validate that custom panel configuration is feasible
   */
  router.post("/validate", async (req, res) => {
    try {
      const validated = composeRequestSchema.parse(req.body);

      const result = composeFenceSegments(validated);

      // Extract validation results
      const isValid = result.success;
      const hasCustomPanel = result.segments?.some(s => 
        s.kind === 'panel' && 
        s.widthMm === validated.customPanelConfig.panelWidthMm
      );

      res.json({
        valid: isValid,
        hasCustomPanel,
        success: result.success,
        validation: result.validation,
        segments: result.segments,
        actualEndGapMm: result.actualEndGapMm,
        varianceEndGapMm: result.varianceEndGapMm,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      console.error("Error in frameless-custom validate:", error);
      res.status(500).json({ error: "Failed to validate custom panel configuration" });
    }
  });

  return router;
}
