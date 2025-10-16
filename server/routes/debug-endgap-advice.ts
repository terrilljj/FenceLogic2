import { Router } from "express";
import type { IStorage } from "../storage";
import { z } from "zod";
import { adviseEndGap, findClosestFeasibleEndGap } from "../../shared/calc/endgapAdvisor";
import { CompositionInput } from "../../shared/calc/compose";

/**
 * Debug router for EndGap Advisor
 * 
 * Helps developers and users understand which end gap values are feasible
 * for a given fence configuration.
 */
export function createDebugEndgapAdviceRouter(storage: IStorage): Router {
  const router = Router();

  // Schema for the advice request
  const adviceRequestSchema = z.object({
    runLengthMm: z.number().positive(),
    startGapMm: z.number().nonnegative(),
    betweenGapMm: z.number().nonnegative(),
    maxPanelMm: z.number().positive(),
    minPanelMm: z.number().positive(),
    gateConfig: z.object({
      required: z.boolean(),
      mountMode: z.enum(['GLASS_TO_GLASS', 'POST', 'WALL']),
      hingeSide: z.enum(['LEFT', 'RIGHT']),
      gateWidthMm: z.number().positive(),
      hingePanelWidthMm: z.number().positive().optional(),
      hingeGapMm: z.number().nonnegative(),
      latchGapMm: z.number().nonnegative(),
      position: z.number().min(0).max(1),
    }).optional(),
    candidateEndGaps: z.array(z.number().nonnegative()).optional(),
  });

  /**
   * POST /api/debug/endgap-advice
   * 
   * Analyze which end gap values are feasible for the configuration
   */
  router.post("/", async (req, res) => {
    try {
      const validated = adviceRequestSchema.parse(req.body);
      const { candidateEndGaps, ...baseInput } = validated;

      const result = adviseEndGap(
        baseInput as Omit<CompositionInput, 'endGapMm'>,
        candidateEndGaps
      );

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      console.error("Error in endgap advice:", error);
      res.status(500).json({ error: "Failed to compute endgap advice" });
    }
  });

  /**
   * POST /api/debug/endgap-advice/closest
   * 
   * Find the closest feasible end gap to a target value
   */
  router.post("/closest", async (req, res) => {
    try {
      const validated = adviceRequestSchema.extend({
        targetEndGap: z.number().nonnegative(),
        searchRange: z.number().positive().optional(),
      }).parse(req.body);

      const { targetEndGap, searchRange, candidateEndGaps, ...baseInput } = validated;

      const result = findClosestFeasibleEndGap(
        baseInput as Omit<CompositionInput, 'endGapMm'>,
        targetEndGap,
        searchRange
      );

      if (!result) {
        return res.status(404).json({ 
          error: "No feasible end gap found within search range" 
        });
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      console.error("Error in closest endgap advice:", error);
      res.status(500).json({ error: "Failed to find closest endgap" });
    }
  });

  return router;
}
