import type { Request, Response, NextFunction } from "express";
import type { Socket } from "socket.io";
import { verifySessionToken } from "../services/auth.js";

export interface AuthenticatedRequest extends Request {
  walletAddress?: string;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  req.walletAddress = payload.walletAddress;
  next();
}

export function attachSocketAuth(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    socket.data.isSpectator = true;
    socket.data.walletAddress = null;
    next();
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    next(new Error("Invalid or expired session"));
    return;
  }

  socket.data.isSpectator = false;
  socket.data.walletAddress = payload.walletAddress;
  next();
}

/** @deprecated Use attachSocketAuth — kept for imports that expect strict auth */
export function requireAuthSocket(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  attachSocketAuth(socket, next);
}

export function requireMatchingWallet(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const paramWallet =
    req.params.walletAddress ??
    (req.body as { walletAddress?: string }).walletAddress;

  if (!req.walletAddress || !paramWallet || req.walletAddress !== paramWallet) {
    res.status(403).json({ error: "Wallet address mismatch" });
    return;
  }

  next();
}
