import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { type IStorage } from "../storage";
import { resolveSelectionToProducts } from "../services/resolve";

// Request body schema
const resolveTraceRequestSchema = z.object({
  variant: z.string(),
  selection: z.record(z.any()).optional().default({}),
});

export function createDebugResolveTraceRouter(storage: IStorage): Router {
  const router = Router();

  /**
   * POST /api/debug/resolve-trace
   * 
   * Run the app's selection→product resolver and show a detailed trace
   * of why each product code was included.
   */
  router.post("/", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validationResult = resolveTraceRequestSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "invalid_request",
          details: validationResult.error.errors,
        });
      }

      const { variant, selection } = validationResult.data;

      // Run the resolver with tracing
      const result = await resolveSelectionToProducts(variant, selection, storage);

      // Build response
      const response = {
        variant,
        selection,
        trace: result.trace,
        finalCodes: result.finalCodes,
        total: result.finalCodes.length,
      };

      res.json(response);
    } catch (error) {
      console.error("Error in debug resolve trace:", error);
      res.status(500).json({ error: "internal_server_error" });
    }
  });

  return router;
}
