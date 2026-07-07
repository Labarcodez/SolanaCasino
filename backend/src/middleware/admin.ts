import type { Response, NextFunction } from "express";
import { config } from "../config.js";
import type { AuthenticatedRequest } from "./auth.js";

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!config.adminWallet) {
    res.status(503).json({ error: "Admin wallet not configured" });
    return;
  }

  if (!req.walletAddress || req.walletAddress !== config.adminWallet) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}
