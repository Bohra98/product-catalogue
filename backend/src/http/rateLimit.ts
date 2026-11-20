import type { RequestHandler } from 'express';
import { HttpError } from './errors.js';

/**
 * Fixed-window, per-IP, in-memory rate limit. Good enough to stop a single
 * browser tab spamming the sales inbox on one instance. With more than one
 * instance, move to a shared store (ElastiCache) or AWS WAF rate-based rules.
 */
export function rateLimit(options: { limit: number; windowMs: number; now?: () => number }): RequestHandler {
  const now = options.now ?? Date.now;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const t = now();
    // Opportunistic cleanup so the map cannot grow without bound.
    if (hits.size > 10_000) {
      for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
    }
    const key = req.ip ?? 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + options.windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > options.limit) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - t) / 1000).toString());
      next(new HttpError(429, 'RATE_LIMITED', 'Too many enquiries. Please wait a minute and try again.'));
      return;
    }
    next();
  };
}
