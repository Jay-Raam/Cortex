import { Request, Response, NextFunction, RequestHandler } from 'express';

export interface SecurityHeadersOptions {
  enableCsp?: boolean;
  cspDirectives?: string;
  frameOptions?: 'DENY' | 'SAMEORIGIN';
  referrerPolicy?: string;
  permissionsPolicy?: string;
  enableHsts?: boolean;
}

export const DEFAULT_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https: wss: ws:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const DEFAULT_PERMISSIONS_POLICY =
  'camera=(), microphone=(self), geolocation=(), payment=()';

export function getDefaultSecurityHeaders(
  options: SecurityHeadersOptions = {}
): Record<string, string> {
  const frameOptions = options.frameOptions || 'DENY';
  const referrerPolicy = options.referrerPolicy || 'strict-origin-when-cross-origin';
  const permissionsPolicy = options.permissionsPolicy || DEFAULT_PERMISSIONS_POLICY;
  const cspDirectives = options.cspDirectives || process.env.CORTEX_CSP || DEFAULT_CSP_DIRECTIVES;

  const headers: Record<string, string> = {
    // 1. Clickjacking defense (CWE-1021)
    'X-Frame-Options': frameOptions,

    // 2. MIME sniffing defense (CWE-693)
    'X-Content-Type-Options': 'nosniff',

    // 3. Referrer privacy
    'Referrer-Policy': referrerPolicy,

    // 4. Feature and device permissions restriction
    'Permissions-Policy': permissionsPolicy,

    // 5. Modern XSS filter disabling (standard recommendation)
    'X-XSS-Protection': '0',

    // 6. Cross-Origin Opener Policy (COOP)
    'Cross-Origin-Opener-Policy': 'same-origin',

    // 7. Cross-Origin Resource Policy (CORP)
    'Cross-Origin-Resource-Policy': 'same-origin',
  };

  if (options.enableCsp !== false) {
    headers['Content-Security-Policy'] = cspDirectives;
  }

  return headers;
}

export function securityHeadersMiddleware(
  options: SecurityHeadersOptions = {}
): RequestHandler {
  const headers = getDefaultSecurityHeaders(options);

  return (req: Request, res: Response, next: NextFunction) => {
    // Strip technology disclosure header
    res.removeHeader('X-Powered-By');

    // Apply baseline security headers
    for (const [header, value] of Object.entries(headers)) {
      res.setHeader(header, value);
    }

    // Apply Strict-Transport-Security (HSTS) on secure requests or when enabled
    const isHttps =
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      options.enableHsts === true ||
      process.env.NODE_ENV === 'production';

    if (isHttps) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
  };
}
