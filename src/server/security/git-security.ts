import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Validates whether a string is a safe, conformant Git branch name.
 * Strictly prevents OS command injection and Git CLI argument injection (CWE-78, CWE-88).
 */
export function isValidGitBranchName(branch?: string): { valid: boolean; reason?: string } {
  if (branch === undefined || branch === null || branch === '') {
    return { valid: true }; // Optional branch parameter
  }

  if (typeof branch !== 'string') {
    return { valid: false, reason: 'Branch name must be a string' };
  }

  const trimmed = branch.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Branch name cannot be empty' };
  }

  if (trimmed.length > 255) {
    return { valid: false, reason: 'Branch name exceeds maximum length (255 characters)' };
  }

  // 1. Argument injection prevention: Git flags starting with '-'
  if (trimmed.startsWith('-')) {
    return {
      valid: false,
      reason: 'Branch name cannot start with a hyphen or dash (argument injection prevention)',
    };
  }

  // 2. Command injection prevention: Shell metacharacters and control operators
  const dangerousCharsRegex = /[;&|`$<>\n\r\0"'\\\s]/;
  if (dangerousCharsRegex.test(trimmed)) {
    return {
      valid: false,
      reason: 'Branch name contains forbidden shell or whitespace characters',
    };
  }

  // 3. Git ref syntax conformance (git-check-ref-format specification)
  if (trimmed.includes('..')) {
    return { valid: false, reason: 'Branch name cannot contain consecutive dots ("..")' };
  }

  if (trimmed.includes('//')) {
    return { valid: false, reason: 'Branch name cannot contain consecutive slashes ("//")' };
  }

  if (trimmed.startsWith('/') || trimmed.endsWith('/')) {
    return { valid: false, reason: 'Branch name cannot start or end with a slash' };
  }

  if (trimmed.endsWith('.')) {
    return { valid: false, reason: 'Branch name cannot end with a dot' };
  }

  if (trimmed.endsWith('.lock')) {
    return { valid: false, reason: 'Branch name cannot end with ".lock"' };
  }

  if (/[~^:?*\[]/.test(trimmed) || trimmed.includes('@{')) {
    return { valid: false, reason: 'Branch name contains invalid Git reference pattern characters' };
  }

  // Must match standard branch character set: alphanumeric, dot, underscore, hyphen, forward slash
  const validBranchPattern = /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/;
  if (!validBranchPattern.test(trimmed)) {
    return { valid: false, reason: 'Branch name contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Safely executes Git commands using direct execFile argument arrays.
 * Bypasses the system shell entirely to eliminate command injection vulnerabilities.
 */
export async function safeExecGit(
  args: string[],
  options: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<{ stdout: string; stderr: string }> {
  // Ensure all arguments are strings and pass directly to git executable
  const sanitizedArgs = args.map((a) => String(a));

  return execFileAsync('git', sanitizedArgs, {
    cwd: options.cwd,
    timeout: options.timeout || 45000,
    env: options.env || process.env,
    maxBuffer: 10 * 1024 * 1024, // 10MB output buffer
    windowsHide: true,
  });
}
