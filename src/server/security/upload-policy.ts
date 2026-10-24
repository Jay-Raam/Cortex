import path from 'path';
import fs from 'fs';

/**
 * Allowed MIME types for uploaded chat attachments and workspace references.
 */
export const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

/**
 * Allowed file extensions for uploaded files.
 */
export const ALLOWED_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'pdf',
  'txt',
  'md',
  'csv',
  'json',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'go',
  'rs',
  'sql',
  'yaml',
  'yml',
]);

/**
 * Strictly prohibited extensions that can lead to remote code execution or stored XSS.
 */
export const PROHIBITED_EXTENSIONS = new Set([
  'html',
  'htm',
  'xhtml',
  'svg',
  'xml',
  'exe',
  'bat',
  'cmd',
  'sh',
  'bash',
  'ps1',
  'vbs',
  'msi',
  'dll',
  'com',
  'scr',
  'jar',
  'php',
  'asp',
  'aspx',
  'jsp',
  'cgi',
  'pl',
]);

/**
 * Default maximum cumulative storage per user (50 MB).
 */
export const DEFAULT_USER_UPLOAD_QUOTA_BYTES = 50 * 1024 * 1024;

/**
 * Single file size limit (10 MB).
 */
export const MAX_SINGLE_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Returns the configured maximum upload storage quota per user in bytes.
 */
export function getUserUploadQuotaLimit(): number {
  const envQuota = process.env.CORTEX_USER_UPLOAD_QUOTA_BYTES;
  if (envQuota) {
    const parsed = parseInt(envQuota, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_USER_UPLOAD_QUOTA_BYTES;
}

/**
 * Validates the original filename and MIME type of an uploaded file.
 */
export function validateUploadedFile(
  originalname: string,
  mimetype: string
): { valid: boolean; reason?: string } {
  if (!originalname || typeof originalname !== 'string') {
    return { valid: false, reason: 'Filename is required' };
  }

  // Extract extension
  const extMatch = originalname.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : '';

  if (!ext) {
    return { valid: false, reason: 'File must have a valid extension' };
  }

  // Check explicit prohibited list
  if (PROHIBITED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      reason: `File extension ".${ext}" is prohibited for security reasons`,
    };
  }

  // Explicitly disallow dangerous SVG and HTML MIME types even if extension is spoofed
  const lowerMime = (mimetype || '').trim().toLowerCase();
  if (lowerMime === 'image/svg+xml' || lowerMime === 'text/html' || lowerMime === 'application/xhtml+xml') {
    return {
      valid: false,
      reason: `MIME type "${mimetype}" is prohibited for security reasons`,
    };
  }

  // Validate allowed extensions
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      reason: `File extension ".${ext}" is not supported. Permitted types: images, text, code, json, csv, pdf`,
    };
  }

  // Verify MIME type matches or is an accepted document/code MIME
  const isAcceptedMime =
    ALLOWED_MIME_TYPES.has(lowerMime) ||
    lowerMime === 'application/octet-stream' ||
    lowerMime.startsWith('text/');

  if (!isAcceptedMime) {
    return {
      valid: false,
      reason: `MIME type "${mimetype}" is not supported`,
    };
  }

  return { valid: true };
}

/**
 * Generates a collision-resistant, sanitized filename scoped to the user ID.
 */
export function generateSafeUploadFilename(userId: string, originalname: string): string {
  const safeUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = path.extname(originalname).toLowerCase();
  const baseName = path.basename(originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeBase = baseName.substring(0, 50) || 'file';
  return `${Date.now()}-${safeUserId}-${safeBase}${ext}`;
}

/**
 * Calculates the total disk space in bytes consumed by a user's uploaded files.
 */
export function getUserUploadUsage(userId: string, uploadsDir: string): number {
  if (!fs.existsSync(uploadsDir)) return 0;

  const safeUserId = (userId || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
  // Match files named with pattern: <timestamp>-<safeUserId>-<basename>.<ext>
  const prefixPattern = new RegExp(`^\\d+-${safeUserId}-`);

  let totalBytes = 0;
  try {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      if (prefixPattern.test(file)) {
        try {
          const stat = fs.statSync(path.join(uploadsDir, file));
          if (stat.isFile()) {
            totalBytes += stat.size;
          }
        } catch {
          // File might have been concurrently deleted
        }
      }
    }
  } catch (err) {
    console.warn('[UploadPolicy] Error reading uploads directory:', err);
  }

  return totalBytes;
}

/**
 * Checks whether a user has sufficient quota remaining for an incoming upload.
 */
export function checkUserUploadQuota(
  userId: string,
  incomingBytes: number,
  uploadsDir: string
): { allowed: boolean; currentUsage: number; limit: number } {
  const limit = getUserUploadQuotaLimit();
  const currentUsage = getUserUploadUsage(userId, uploadsDir);

  if (currentUsage + incomingBytes > limit) {
    return { allowed: false, currentUsage, limit };
  }

  return { allowed: true, currentUsage, limit };
}

/**
 * Returns options for Express static serving of the uploads directory with protective security headers.
 */
export function getUploadsStaticOptions(): {
  setHeaders: (res: any, filePath: string) => void;
} {
  return {
    setHeaders: (res: any) => {
      // Prevent browsers from MIME-sniffing away from declared Content-Type
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // Strictly disable script execution, plugin execution, and origin privilege elevation in uploaded files
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox;");
    },
  };
}
