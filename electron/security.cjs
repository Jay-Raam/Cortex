const { execFile } = require('child_process');

const ALLOWED_DESKTOP_BINARIES = new Set([
  'node',
  'npm',
  'npx',
  'git',
  'python',
  'python3',
  'tsc',
]);

const SHELL_METACHARACTERS = /[;&|`$><\r\n\0]/;

const DISALLOWED_ARG_PATTERNS = [
  /^(-e|--eval)$/i,
  /^-c$/i,
  /^--upload-pack/i,
  /^--receive-pack/i,
];

function validateDesktopCommand(command) {
  if (!command || typeof command !== 'string') {
    return { allowed: false, reason: 'Command must be a non-empty string.' };
  }

  const trimmed = command.trim();
  if (!trimmed) {
    return { allowed: false, reason: 'Command cannot be blank.' };
  }

  if (SHELL_METACHARACTERS.test(trimmed)) {
    return {
      allowed: false,
      reason: 'Command chaining and shell operators (;, &, |, `, $, >, <) are strictly blocked by security policy.',
    };
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { allowed: false, reason: 'Command cannot be empty.' };
  }

  const rawBinary = tokens[0];
  const baseName = rawBinary.split(/[/\\]/).pop() || rawBinary;
  const normalizedBinary = baseName.replace(/\.exe$/i, '').toLowerCase();

  if (!ALLOWED_DESKTOP_BINARIES.has(normalizedBinary)) {
    return {
      allowed: false,
      reason: `Binary "${baseName}" is not permitted. Only approved development tools (${Array.from(ALLOWED_DESKTOP_BINARIES).join(', ')}) can be executed.`,
    };
  }

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

function executeSafeDesktopCommand(command, options = {}) {
  const { timeoutMs = 15000, maxBufferBytes = 2 * 1024 * 1024 } = options;

  const validation = validateDesktopCommand(command);
  if (!validation.allowed || !validation.binary) {
    return Promise.resolve({
      stdout: '',
      stderr: validation.reason || 'Command blocked by desktop security policy.',
      exitCode: 1,
    });
  }

  return new Promise((resolve) => {
    execFile(
      validation.binary,
      validation.args || [],
      {
        timeout: Math.min(timeoutMs, 30000),
        maxBuffer: maxBufferBytes,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || (error ? error.message : ''),
          exitCode: error ? (error.code ?? 1) : 0,
        });
      }
    );
  });
}

function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function isAllowedNavigationUrl(targetUrl, allowedOrigin) {
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

module.exports = {
  ALLOWED_DESKTOP_BINARIES,
  validateDesktopCommand,
  executeSafeDesktopCommand,
  isAllowedNavigationUrl,
  escapeHtml,
};
