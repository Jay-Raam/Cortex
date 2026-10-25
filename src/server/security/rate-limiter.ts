import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number; // Window duration in milliseconds
  max: number; // Maximum allowed requests within windowMs
  message?: string; // Error message returned in body
  statusCode?: number; // HTTP status code (default 429)
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

export interface RateLimitRecord {
  count: number;
  resetTime: number; // Timestamp in ms when window expires
}

/**
 * Extracts a normalized client IP and optional identifier for rate limiting.
 */
export function defaultKeyGenerator(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  let ip = '';
  if (typeof xForwardedFor === 'string') {
    ip = xForwardedFor.split(',')[0].trim();
  } else if (Array.isArray(xForwardedFor) && xForwardedFor[0]) {
    ip = xForwardedFor[0].trim();
  } else {
    ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  }

  // If email is present in body, key per ip + email to mitigate targeted account brute-forcing
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email) {
    return `${ip}:${email}`;
  }
  return ip;
}

/**
 * High-performance, zero-dependency in-memory sliding-window rate limiter.
 */
export class MemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  public readonly windowMs: number;
  public readonly max: number;
  public readonly message: string;
  public readonly statusCode: number;
  public readonly keyGenerator: (req: Request) => string;
  public readonly skip?: (req: Request) => boolean;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.message = options.message || 'Too many requests, please try again later.';
    this.statusCode = options.statusCode || 429;
    this.keyGenerator = options.keyGenerator || defaultKeyGenerator;
    this.skip = options.skip;

    // Periodic cleanup of expired records every 60s
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now >= record.resetTime) {
        this.store.delete(key);
      }
    }
  }

  public resetKey(key: string): void {
    this.store.delete(key);
  }

  public resetAll(): void {
    this.store.clear();
  }

  public getRecord(key: string): RateLimitRecord | undefined {
    return this.store.get(key);
  }

  public check(req: Request): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfterSec: number;
  } {
    if (this.skip && this.skip(req)) {
      return {
        allowed: true,
        remaining: this.max,
        resetTime: Date.now() + this.windowMs,
        retryAfterSec: 0,
      };
    }

    const key = this.keyGenerator(req);
    const now = Date.now();
    let record = this.store.get(key);

    if (!record || now >= record.resetTime) {
      record = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.store.set(key, record);
      return {
        allowed: true,
        remaining: Math.max(0, this.max - 1),
        resetTime: record.resetTime,
        retryAfterSec: 0,
      };
    }

    record.count++;
    const remaining = Math.max(0, this.max - record.count);
    const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

    if (record.count > this.max) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfterSec,
      };
    }

    return {
      allowed: true,
      remaining,
      resetTime: record.resetTime,
      retryAfterSec: 0,
    };
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const result = this.check(req);

      // Attach standard rate limit headers
      res.setHeader('RateLimit-Limit', this.max.toString());
      res.setHeader('RateLimit-Remaining', result.remaining.toString());
      res.setHeader('RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfterSec.toString());
        return res.status(this.statusCode).json({
          error: this.message,
          retryAfter: result.retryAfterSec,
        });
      }

      next();
    };
  }
}

/**
 * Login rate limiter: Max 10 attempts per 15-minute window per IP + email combination.
 */
export const loginRateLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

/**
 * Registration rate limiter: Max 20 account registrations per 1-hour window per IP.
 */
export const registerRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Too many account registrations from this network. Please try again later.',
  keyGenerator: (req: Request) => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
      return xForwardedFor.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
  },
});
