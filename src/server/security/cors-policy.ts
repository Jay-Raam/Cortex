import { CorsOptions } from 'cors';

/**
 * Validates whether an incoming HTTP Origin header is authorized to access Cortex APIs with credentials.
 * Authorizes:
 * - Direct / non-browser requests where Origin header is absent (e.g. server-to-server, Electron main process)
 * - Electron sandboxed local file contexts ('null', 'file://')
 * - Local development loopback origins ('http://localhost:*', 'http://127.0.0.1:*')
 * - Explicit trusted origins configured via CORTEX_ALLOWED_ORIGINS environment variable
 */
export function isAllowedCorsOrigin(origin?: string): boolean {
  // Same-origin or non-browser client without Origin header
  if (!origin) return true;

  const normalized = origin.trim().toLowerCase();

  // Desktop Electron file contexts
  if (normalized === 'null' || normalized === 'file://') return true;

  // Local loopback host on any port (IPv4 or hostname)
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
  if (isLoopback) return true;

  // Custom allowed origins from environment (comma-delimited)
  const envOrigins = (process.env.CORTEX_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);

  if (envOrigins.includes(normalized)) return true;

  return false;
}

/**
 * Returns hardened CORS configuration options for Express.
 * Replaces dynamic origin reflection with strict allowlist verification.
 */
export function getCorsOptions(): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (isAllowedCorsOrigin(origin)) {
        // Return true to authorize origin, or return the origin itself
        callback(null, origin || true);
      } else {
        callback(new Error(`CORS Error: Origin "${origin}" is not authorized by security policy.`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie'],
    maxAge: 86400, // 24 hours preflight cache
  };
}
