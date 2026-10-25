import { execFile } from 'node:child_process';

export interface CommandValidationResult {
  allowed: boolean;
  binary?: string;
  args?: string[];
  reason?: string;
}

export interface SafeExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Strict allowlist of permitted development binaries in Electron desktop context.
 */
export const ALLOWED_DESKTOP_BINARIES = new Set([
  'node',
  'npm',
  'npx',
  'git',
  'python',
  'python3',
  'tsc',
]);

/**
 * Blocked shell metacharacters and command chaining operators.
 */
const SHELL_METACHARACTERS = /[;&|`$><\r\n\0]/;

/**
 * Disallowed arguments that allow arbitrary code or command execution.
 */
const DISALLOWED_ARG_PATTERNS = [
  /^(-e|--eval)$/i,
  /^-c$/i,
  /^--upload-pack/i,
  /^--receive-pack/i,
];

/**
 * Validates a desktop shell command against strict security policies.
 * Ensures the command is in the approved binary allowlist and contains no shell operators.
 */
export function validateDesktopCommand(command: unknown): CommandValidationResult {
  if (!command || typeof command !== 'string') {
    return { allowed: false, reason: 'Command must be a non-empty string.' };
  }

  const trimmed = command.trim();
  if (!trimmed) {
    return { allowed: false, reason: 'Command cannot be blank.' };
  }

  // 1. Block command separators and chaining operators
  if (SHELL_METACHARACTERS.test(trimmed)) {
    return {
      allowed: false,
      reason: 'Command chaining and shell operators (;, &, |, `, $, >, <) are strictly blocked by security policy.',
    };
  }

  // 2. Tokenize command into binary and arguments
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { allowed: false, reason: 'Command cannot be empty.' };
  }

  const rawBinary = tokens[0];
  // Normalize binary name (e.g. "git.exe" -> "git", "C:\Path\git" -> "git")
  const baseName = rawBinary.split(/[/\\]/).pop() || rawBinary;
  const normalizedBinary = baseName.replace(/\.exe$/i, '').toLowerCase();

  if (!ALLOWED_DESKTOP_BINARIES.has(normalizedBinary)) {
    return {
      allowed: false,
      reason: `Binary "${baseName}" is not permitted. Only approved development tools (${Array.from(ALLOWED_DESKTOP_BINARIES).join(', ')}) can be executed.`,
    };
  }

  // 3. Inspect arguments for dangerous execution flags
  const args = tokens.slice(1);
  for (const arg of args) {
    for (const pattern of DISALLOWED_ARG_PATTERNS) {
      if (pattern.test(arg)) {
        return {
          allowed: false,
          reason: `Flag "${arg}" is blocked by security policy to prevent arbitrary code execution.`,
        };
      }
    }
  }

  return {
    allowed: true,
    binary: normalizedBinary,
    args,
  };
}

/**
 * Executes an authorized desktop command directly using execFile (no shell spawn).
 */
export function executeSafeDesktopCommand(
  command: unknown,
  options: { timeoutMs?: number; maxBufferBytes?: number } = {}
): Promise<SafeExecutionResult> {
  const { timeoutMs = 15000, maxBufferBytes = 2 * 1024 * 1024 } = options;

  const validation = validateDesktopCommand(command);
  if (!validation.allowed || !validation.binary) {
    return Promise.resolve({
      stdout: '',
      stderr: validation.reason || 'Command blocked by desktop security policy.',
      exitCode: 1,
    });
  }

  return new Promise<SafeExecutionResult>((resolve) => {
    execFile(
      validation.binary!,
      validation.args || [],
      {
        timeout: Math.min(timeoutMs, 30000), // Enforce upper bound
        maxBuffer: maxBufferBytes,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || (error ? error.message : ''),
          exitCode: error ? ((error as any).code ?? 1) : 0,
        });
      }
    );
  });
}

/**
 * Escapes untrusted strings for safe embedding into HTML.
 */
export function escapeHtml(unsafe: unknown): string {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates whether a navigation URL is authorized to load within the Electron BrowserWindow.
 * Only internal application origins (e.g. localhost, 127.0.0.1, or the configured allowedOrigin) are permitted.
 * Dangerous pseudo-protocols ('javascript:', 'data:', 'vbscript:', 'file:') and external web URLs are blocked.
 */
export function isAllowedNavigationUrl(targetUrl: unknown, allowedOrigin?: string): boolean {
  if (!targetUrl || typeof targetUrl !== 'string') return false;

  try {
    const parsed = new URL(targetUrl);

    // Strictly block dangerous pseudo-protocols
    if (['javascript:', 'data:', 'vbscript:', 'file:'].includes(parsed.protocol)) {
      return false;
    }

    if (allowedOrigin) {
      try {
        const allowed = new URL(allowedOrigin);
        if (parsed.origin === allowed.origin) {
          return true;
        }
      } catch {}
    }

    // Permit local loopback origins (dev server, desktop server)
    if (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      (parsed.protocol === 'http:' || parsed.protocol === 'https:')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
