import rateLimit, { type Options, type RateLimitRequestHandler } from "express-rate-limit";

const DEFAULT_RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a moment and try again.";

/** Rate limiter that always responds with JSON (frontend-safe). */
export function jsonRateLimit(
  options: Partial<Options> & Pick<Options, "windowMs" | "max">,
): RateLimitRequestHandler {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      res.status(options.statusCode ?? 429).json({
        error: DEFAULT_RATE_LIMIT_MESSAGE,
        code: "RATE_LIMITED",
      });
    },
    ...options,
  });
}

export { DEFAULT_RATE_LIMIT_MESSAGE };
