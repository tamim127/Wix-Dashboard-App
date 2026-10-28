/**
 * FlexiDash Rate Limiter & Security Boundary
 *
 * Provides rate-limiting capabilities to protect sensitive endpoints
 * (login, register, role assignment) from credential stuffing and brute-force attacks.
 *
 * ARCHITECTURAL NOTICE:
 * The default InMemoryRateLimiter operates on single process / worker isolate memory.
 * For distributed multi-region edge rate limiting in production Cloudflare Workers,
 * an edge-distributed adapter (e.g. Cloudflare Rate Limiting Rules or Durable Objects)
 * must be configured.
 */

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in ms
}

export interface IRateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
  reset?(key?: string): Promise<void>;
}

interface WindowRecord {
  timestamps: number[];
}

export class InMemoryRateLimiter implements IRateLimiter {
  private readonly records: Map<string, WindowRecord> = new Map();
  private readonly cleanupIntervalMs: number;
  private lastCleanup: number = Date.now();

  constructor(cleanupIntervalMs = 60000) {
    this.cleanupIntervalMs = cleanupIntervalMs;
  }

  private cleanup(now: number): void {
    if (now - this.lastCleanup < this.cleanupIntervalMs) return;
    this.lastCleanup = now;

    for (const [key, record] of this.records.entries()) {
      // Remove records with no timestamps in the last 15 minutes
      if (record.timestamps.length === 0 || now - record.timestamps[record.timestamps.length - 1] > 900000) {
        this.records.delete(key);
      }
    }
  }

  public async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    this.cleanup(now);

    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Filter out timestamps outside the active sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    const current = record.timestamps.length;
    const resetTime = (record.timestamps[0] || now) + windowMs;

    if (current >= limit) {
      return {
        allowed: false,
        current,
        limit,
        remaining: 0,
        resetTime,
      };
    }

    record.timestamps.push(now);

    return {
      allowed: true,
      current: current + 1,
      limit,
      remaining: Math.max(0, limit - (current + 1)),
      resetTime,
    };
  }

  public async reset(key?: string): Promise<void> {
    if (key) {
      this.records.delete(key);
    } else {
      this.records.clear();
    }
  }
}

let activeRateLimiter: IRateLimiter = new InMemoryRateLimiter();

export function getRateLimiter(): IRateLimiter {
  return activeRateLimiter;
}

export function setRateLimiterForTesting(limiter: IRateLimiter): void {
  activeRateLimiter = limiter;
}

export function resetRateLimiter(): void {
  activeRateLimiter = new InMemoryRateLimiter();
}

