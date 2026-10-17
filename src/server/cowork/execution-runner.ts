import { spawn } from 'node:child_process';
import { ExecutionCommandResult } from '../types';

const SENSITIVE_ENV_KEYS = [
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
  'GROQ_API_KEY',
  'NVIDIA_NIM_API_KEY',
  'JWT_SECRET',
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
  'DATABASE_URL',
  'AUTH_SECRET',
];

export interface ExecutionOptions {
  cwd: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  abortSignal?: AbortSignal;
}

export class ExecutionRunner {
  /**
   * Sanitizes the environment variables by deleting all server secrets and credentials.
   */
  private getSanitizedEnv(): NodeJS.ProcessEnv {
    const cleanEnv: NodeJS.ProcessEnv = { ...process.env };

    for (const key of SENSITIVE_ENV_KEYS) {
      delete cleanEnv[key];
    }

    // Explicitly configure execution flags
    cleanEnv.CI = 'true';
    cleanEnv.NODE_ENV = 'test';
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
      onStdout,
      onStderr,
      abortSignal,
    } = options;

    const startTime = Date.now();
    let stdoutAcc = '';
    let stderrAcc = '';
    let timedOut = false;

    return new Promise<ExecutionCommandResult>((resolve) => {
      const isWindows = process.platform === 'win32';
      const child = spawn(commandLine, {
        shell: true,
        cwd,
        env: this.getSanitizedEnv(),
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
