import { Request, Response, NextFunction } from "express";
import "../types"; // Import session type extensions

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session?.isAdmin === true) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized - Admin access required" });
  }
}
