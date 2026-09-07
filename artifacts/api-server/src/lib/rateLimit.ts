import type { Request, Response } from "express";

/**
 * Tiny in-memory per-IP limiter for public endpoints.
 * Fine for a single Replit autoscale instance; not a substitute for a gateway.
 */
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();

  function clientKey(req: Request): string {
    return (
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      "unknown"
    );
  }

  return function rateLimit(req: Request, res: Response): boolean {
    const key = clientKey(req);
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
    if (arr.length >= opts.max) {
      res.status(429).json({ error: "Too many requests, please slow down." });
      return false;
    }
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        const fresh = v.filter((t) => now - t < opts.windowMs);
        if (fresh.length === 0) hits.delete(k);
        else hits.set(k, fresh);
      }
    }
    return true;
  };
}
