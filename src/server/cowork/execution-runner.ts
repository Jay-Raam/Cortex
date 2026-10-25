import { spawn } from 'node:child_process';
import { ExecutionCommandResult } from '../types';

export const SENSITIVE_ENV_KEYS: readonly string[] = [
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
  'GROQ_API_KEY',
  'NVIDIA_NIM_API_KEY',
  'JWT_SECRET',
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
  'DATABASE_URL',
  'AUTH_SECRET',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'CORTEX_ADMIN_EMAIL',
  'CORTEX_ADMIN_PASSWORD',
];

/**
 * Safe list of environment variable names permitted to pass from host process to child process.
 * Any environment variable not in this set is strictly omitted.
 */
export const ALLOWED_SYSTEM_ENV_VARS: ReadonlySet<string> = new Set([
  // Windows & POSIX core PATH
  'PATH',
  'Path',
  'PATHEXT',
  'SYSTEMROOT',
  'SystemRoot',
  'SYSTEMDRIVE',
  'SystemDrive',
  'WINDIR',
  'windir',
  'COMSPEC',
  'ComSpec',
  'TEMP',
  'TMP',
  'TMPDIR',
  // Shell & Terminal environment
  'SHELL',
  'TERM',
  'COLORTERM',
  'TERM_PROGRAM',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'LC_MESSAGES',
  // Node / Runtime tools
  'NODE',
  'NODE_EXE',
  'NODE_PATH',
  'NPM_CONFIG_COLOR',
  // Home and user profile (essential for npm, npx, git, python virtualenvs)
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'HOMEDRIVE',
  'HOMEPATH',
]);

/**
 * Regex patterns identifying sensitive secret keys that must NEVER be passed to child processes,
 * even if present in custom or extended environment variables.
 */
export const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /KEY/i,
  /SECRET/i,
  /TOKEN/i,
  /PASSWORD/i,
  /PASSWD/i,
  /AUTH/i,
  /CREDENTIAL/i,
  /PRIVATE/i,
  /CERT/i,
  /ADMIN/i,
  /SESSION/i,
  /SIGNING/i,
  /SIGNATURE/i,
  /DATABASE/i,
  /^DB_/i,
  /^GH_/i,
  /^GITHUB_/i,
  /^AWS_/i,
  /^AZURE_/i,
  /^GCP_/i,
  /^GOOGLE_/i,
  /^OPENAI_/i,
  /^ANTHROPIC_/i,
  /^GEMINI_/i,
  /^GROQ_/i,
  /^OPENROUTER_/i,
  /^NVIDIA_/i,
  /^MISTRAL_/i,
  /^DEEPSEEK_/i,
  /^COHERE_/i,
  /^CORTEX_/i,
];

/**
 * Tests whether a given environment variable name is considered sensitive.
 */
export function isSensitiveEnvKey(key: string): boolean {
  if (SENSITIVE_ENV_KEYS.includes(key)) {
    return true;
  }
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export interface ExecutionOptions {
  cwd: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
  customEnv?: Record<string, string>;
  env?: Record<string, string>;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  abortSignal?: AbortSignal;
}

export class ExecutionRunner {
  /**
   * Sanitizes the environment variables by constructing an allowlist of essential system keys
   * and strictly filtering out any key that matches sensitive secret patterns.
   */
  getSanitizedEnv(customEnv?: Record<string, string>): NodeJS.ProcessEnv {
    const cleanEnv: NodeJS.ProcessEnv = {};

    // 1. Inherit ONLY allowed system environment variables from process.env
    for (const [key, val] of Object.entries(process.env)) {
      if (val !== undefined && ALLOWED_SYSTEM_ENV_VARS.has(key)) {
        // Defense-in-depth: double check against sensitive patterns
        if (!isSensitiveEnvKey(key)) {
          cleanEnv[key] = val;
        }
      }
    }

    // 2. Merge optional custom environment variables if provided, scrubbing any sensitive keys
    if (customEnv) {
      for (const [key, val] of Object.entries(customEnv)) {
        if (typeof val === 'string' && !isSensitiveEnvKey(key)) {
          cleanEnv[key] = val;
        }
      }
    }

    // 3. Explicitly configure execution flags
    cleanEnv.CI = 'true';
    cleanEnv.NODE_ENV = cleanEnv.NODE_ENV || 'test';
    cleanEnv.FORCE_COLOR = '1';

    return cleanEnv;
  }

  /**
   * Executes a development command inside the authorized workspace root.
   */
  async executeCommand(
    commandLine: string,
    options: ExecutionOptions
  ): Promise<ExecutionCommandResult> {
    const {
      cwd,
      timeoutMs = 30000,
      maxBufferBytes = 1024 * 1024, // 1MB
      customEnv,
      env,
      onStdout,
      onStderr,
      abortSignal,
    } = options;

    const mergedCustomEnv = { ...(customEnv || {}), ...(env || {}) };
    const sanitizedEnv = this.getSanitizedEnv(mergedCustomEnv);

    const startTime = Date.now();
    let stdoutAcc = '';
    let stderrAcc = '';
    let timedOut = false;

    return new Promise<ExecutionCommandResult>((resolve) => {
      const isWindows = process.platform === 'win32';
      const child = spawn(commandLine, {
        shell: true,
        cwd,
        env: sanitizedEnv,
        windowsHide: true,
      });

      let timeoutTimer: NodeJS.Timeout | null = null;
      if (timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          timedOut = true;
          try {
            if (isWindows) {
              spawn('taskkill', ['/pid', child.pid!.toString(), '/f', '/t']);
            } else {
              child.kill('SIGKILL');
            }
          } catch {}
        }, timeoutMs);
      }

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          try {
            if (isWindows) {
              spawn('taskkill', ['/pid', child.pid!.toString(), '/f', '/t']);
            } else {
              child.kill('SIGKILL');
            }
          } catch {}
        });
      }

      child.stdout?.on('data', (data: Buffer) => {
        const str = data.toString('utf-8');
        if (stdoutAcc.length < maxBufferBytes) {
          stdoutAcc += str;
        }
        if (onStdout) {
          onStdout(str);
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        const str = data.toString('utf-8');
        if (stderrAcc.length < maxBufferBytes) {
          stderrAcc += str;
        }
        if (onStderr) {
          onStderr(str);
        }
      });

      child.on('error', (err) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        const durationMs = Date.now() - startTime;
        resolve({
          exitCode: 1,
          stdout: stdoutAcc,
          stderr: (stderrAcc + '\n' + err.message).trim(),
          durationMs,
          timedOut,
        });
      });

      child.on('close', (code) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        const durationMs = Date.now() - startTime;
        resolve({
          exitCode: code ?? (timedOut ? 124 : 0),
          stdout: stdoutAcc,
          stderr: stderrAcc,
          durationMs,
          timedOut,
        });
      });
    });
  }
}

export const executionRunner = new ExecutionRunner();
