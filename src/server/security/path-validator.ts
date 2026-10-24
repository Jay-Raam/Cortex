import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Known sensitive credential and configuration directory names.
 */
export const SENSITIVE_DIR_NAMES = new Set([
  '.ssh',
  '.aws',
  '.gnupg',
  '.azure',
  '.kube',
  '.config',
  'appdata',
]);

/**
 * Normalizes a path string and resolves any symlinks to find the real canonical path.
 */
export function canonicalizePath(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  try {
    if (fs.existsSync(resolved)) {
      return fs.realpathSync(resolved);
    }
  } catch {
    // Fall back to resolved path if realpath fails
  }
  return resolved;
}

/**
 * Checks if a given canonical path is a drive root or system root directory.
 */
export function isRootDirectory(canonical: string): boolean {
  const normalized = canonical.replace(/\\/g, '/');
  // Unix root
  if (normalized === '/' || normalized === '') return true;

  // Windows drive roots: C:/, D:/, C:, etc.
  if (/^[a-zA-Z]:\/?$/.test(normalized)) return true;

  // Root directory of parsed path
  const parsed = path.parse(canonical);
  if (parsed.root && canonical.toLowerCase() === parsed.root.toLowerCase()) {
    return true;
  }

  return false;
}

/**
 * Determines whether a directory path is safe to bind as a local Co-Work workspace.
 * Prevents arbitrary filesystem binding, system root access, credential theft, and server self-binding.
 */
export function validateWorkspaceBindPath(
  inputPath: string,
  options: { allowManagedWorkspaces?: boolean } = {}
): { valid: boolean; resolvedPath?: string; reason?: string } {
  if (!inputPath || typeof inputPath !== 'string') {
    return { valid: false, reason: 'A valid folderPath string is required' };
  }

  const trimmed = inputPath.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Folder path cannot be empty' };
  }

  // Reject paths containing null bytes
  if (trimmed.includes('\0')) {
    return { valid: false, reason: 'Path contains invalid characters' };
  }

  const canonical = canonicalizePath(trimmed);
  const normalized = canonical.replace(/\\/g, '/').toLowerCase();

  // 1. Prohibit filesystem roots
  if (isRootDirectory(canonical)) {
    return {
      valid: false,
      reason: 'Binding root directory is strictly prohibited for security reasons',
    };
  }

  // 2. Prohibit server application root directory and parent directories
  const appRoot = canonicalizePath(process.cwd());
  const normalizedAppRoot = appRoot.replace(/\\/g, '/').toLowerCase();
  const workspacesRoot = path.join(appRoot, 'workspaces').replace(/\\/g, '/').toLowerCase();

  // Check if target is inside the managed workspaces directory
  const isInsideWorkspaces =
    normalized.startsWith(workspacesRoot + '/') || normalized === workspacesRoot;

  if (!isInsideWorkspaces) {
    if (normalized === normalizedAppRoot) {
      return {
        valid: false,
        reason: 'Binding the server application root directory is prohibited',
      };
    }

    if (normalizedAppRoot.startsWith(normalized + '/')) {
      return {
        valid: false,
        reason: 'Binding a parent directory of the application server is prohibited',
      };
    }
  }

  // 3. Prohibit Windows system and user root directories
  if (process.platform === 'win32' || /^[a-zA-Z]:/.test(canonical)) {
    const winDir = (process.env.SystemRoot || process.env.windir || 'C:\\Windows').toLowerCase();
    const progFiles = (process.env['ProgramFiles'] || 'C:\\Program Files').toLowerCase();
    const progFilesX86 = (process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)').toLowerCase();
    const progData = (process.env['ProgramData'] || 'C:\\ProgramData').toLowerCase();

    const blockedWinDirs = [winDir, progFiles, progFilesX86, progData];
    for (const bDir of blockedWinDirs) {
      const normBDir = bDir.replace(/\\/g, '/');
      if (normalized === normBDir || normalized.startsWith(normBDir + '/')) {
        return {
          valid: false,
          reason: `Binding system directory "${path.basename(normBDir)}" is prohibited`,
        };
      }
    }

    // Block C:\Users directly
    if (/^[a-zA-Z]:\/users\/?$/.test(normalized)) {
      return {
        valid: false,
        reason: 'Binding user accounts root directory is prohibited',
      };
    }

    // Block user home directly without a project subdirectory
    const userProfile = (process.env.USERPROFILE || '').toLowerCase().replace(/\\/g, '/');
    if (userProfile && (normalized === userProfile || normalized === userProfile + '/')) {
      return {
        valid: false,
        reason: 'Binding entire user home profile directly is prohibited. Please select a specific project subfolder.',
      };
    }
  }

  // 4. Prohibit Unix/Linux system directories
  const blockedUnixPrefixes = [
    '/etc',
    '/bin',
    '/sbin',
    '/usr',
    '/var',
    '/proc',
    '/sys',
    '/dev',
    '/boot',
    '/root',
    '/opt',
  ];

  const pathWithoutDrive = normalized.replace(/^[a-z]:/, '');
  const rawInputNorm = trimmed.replace(/\\/g, '/').toLowerCase();

  for (const prefix of blockedUnixPrefixes) {
    if (
      normalized === prefix ||
      normalized.startsWith(prefix + '/') ||
      pathWithoutDrive === prefix ||
      pathWithoutDrive.startsWith(prefix + '/') ||
      rawInputNorm === prefix ||
      rawInputNorm.startsWith(prefix + '/')
    ) {
      return {
        valid: false,
        reason: `Binding system directory "${prefix}" is prohibited`,
      };
    }
  }

  // Block /home directly
  if (
    normalized === '/home' ||
    normalized === '/home/' ||
    normalized === '/users' ||
    normalized === '/users/' ||
    pathWithoutDrive === '/home' ||
    rawInputNorm === '/home'
  ) {
    return {
      valid: false,
      reason: 'Binding user accounts directory directly is prohibited',
    };
  }

  // Block user home directly
  const homeDir = os.homedir().toLowerCase().replace(/\\/g, '/');
  if (homeDir && (normalized === homeDir || normalized === homeDir + '/')) {
    return {
      valid: false,
      reason: 'Binding entire user home directory directly is prohibited. Please select a specific project subfolder.',
    };
  }

  // 5. Prohibit sensitive credential subdirectories
  const segments = normalized.split('/').filter(Boolean);
  for (const seg of segments) {
    if (SENSITIVE_DIR_NAMES.has(seg)) {
      return {
        valid: false,
        reason: `Binding directory containing sensitive store "${seg}" is prohibited`,
      };
    }
  }

  return {
    valid: true,
    resolvedPath: canonical,
  };
}
