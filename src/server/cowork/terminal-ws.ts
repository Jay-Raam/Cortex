import http from 'node:http';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from '../auth/auth';
import { db } from '../db/database';
import { workspaceManager } from './workspace-manager';
import { executionRunner, clampExecutionTimeout, validateExecutionCommand } from './execution-runner';
import { User, Workspace } from '../types';

export interface TerminalSession {
  id: string;
  workspaceId: string;
  userId: string;
  ws: WebSocket;
  childProcess?: ChildProcess;
  createdAt: string;
}

export type ClientAction = 'exec' | 'stdin' | 'signal' | 'ping';

export interface ClientMessage {
  type: ClientAction;
  command?: string;
  data?: string;
  signal?: 'SIGINT' | 'SIGTERM' | 'SIGKILL';
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface ServerMessage {
  type: 'connected' | 'stdout' | 'stderr' | 'exit' | 'error' | 'pong';
  sessionId?: string;
  workspaceId?: string;
  data?: string;
  exitCode?: number | null;
  signal?: string | null;
  error?: string;
}

export class TerminalWebSocketManager {
  private sessions: Map<string, TerminalSession> = new Map();
  private wss: WebSocketServer | null = null;

  /**
   * Initializes and attaches the WebSocket server to an existing HTTP server instance.
   */
  attachToServer(httpServer: http.Server): WebSocketServer {
    if (this.wss) {
      return this.wss;
    }

    this.wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (req, socket, head) => {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(req.url || '', 'http://127.0.0.1');
      } catch {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      const pathname = parsedUrl.pathname || '';

      // Expected route: /api/ws/terminal/:workspaceId
      const match = pathname.match(/^\/api\/ws\/terminal\/([a-zA-Z0-9_-]+)/);
      if (!match) {
        return; // Ignore other upgrade requests (e.g. Vite HMR)
      }

      const workspaceId = match[1];

      // Extract token from query or Authorization header
      let token = parsedUrl.searchParams.get('token') || undefined;
      if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
          token = parts[1];
        }
      }

      if (!token && req.headers['sec-websocket-protocol']) {
        const protoParts = (req.headers['sec-websocket-protocol'] as string).split(',');
        for (const p of protoParts) {
          const trimmed = p.trim();
          if (trimmed.startsWith('token.')) {
            token = trimmed.slice(6);
            break;
          }
        }
      }

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const verified = verifyAccessToken(token);
      if (!verified) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Multi-tenant check: ensure workspace belongs to authenticated user
      const workspace = db.getWorkspaceById(workspaceId, verified.userId);
      if (!workspace) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.handleConnection(ws, workspace, verified.userId);
      });
    });

    return this.wss;
  }

  /**
   * Handles new authenticated WebSocket connection.
   */
  handleConnection(ws: WebSocket, workspace: Workspace, userId: string): TerminalSession {
    const sessionId = `term_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const wsRoot = workspaceManager.getWorkspaceRoot(workspace);

    const session: TerminalSession = {
      id: sessionId,
      workspaceId: workspace.id,
      userId,
      ws,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);

    // Send connection greeting
    this.send(ws, {
      type: 'connected',
      sessionId,
      workspaceId: workspace.id,
      data: `Connected to workspace terminal [${workspace.name}]`,
    });

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString('utf8'));
        this.handleMessage(session, workspace, wsRoot, msg);
      } catch (err: any) {
        this.send(ws, {
          type: 'error',
          error: `Invalid message payload: ${err.message || String(err)}`,
        });
      }
    });

    ws.on('close', () => {
      this.terminateSession(sessionId);
    });

    ws.on('error', (err) => {
      console.warn(`Terminal WS error on session ${sessionId}:`, err);
      this.terminateSession(sessionId);
    });

    return session;
  }

  /**
   * Dispatches incoming client messages.
   */
  private handleMessage(
    session: TerminalSession,
    workspace: Workspace,
    wsRoot: string,
    msg: ClientMessage
  ): void {
    const { ws } = session;

    switch (msg.type) {
      case 'ping': {
        this.send(ws, { type: 'pong' });
        break;
      }

      case 'stdin': {
        if (session.childProcess && session.childProcess.stdin && !session.childProcess.killed) {
          try {
            session.childProcess.stdin.write(msg.data || '');
          } catch (err: any) {
            this.send(ws, { type: 'error', error: `stdin error: ${err.message}` });
          }
        }
        break;
      }

      case 'signal': {
        if (session.childProcess && !session.childProcess.killed) {
          const sig = msg.signal || 'SIGINT';
          try {
            this.killProcess(session.childProcess, sig);
          } catch (err: any) {
            this.send(ws, { type: 'error', error: `Failed to send signal ${sig}: ${err.message}` });
          }
        }
        break;
      }

      case 'exec': {
        if (session.childProcess && !session.childProcess.killed) {
          this.send(ws, {
            type: 'error',
            error: 'Process already executing in this terminal session. Send signal or await completion.',
          });
          return;
        }

        const cmdValidation = validateExecutionCommand(msg.command);
        if (!cmdValidation.valid) {
          this.send(ws, { type: 'error', error: cmdValidation.error || 'Invalid command' });
          return;
        }

        const commandStr = (msg.command || '').trim();
        const timeoutMs = clampExecutionTimeout(msg.timeoutMs);
        const sanitizedEnv = executionRunner.getSanitizedEnv(msg.env);

        let cwd = wsRoot;
        if (msg.cwd) {
          const resolved = path.resolve(wsRoot, msg.cwd);
          if (resolved.startsWith(wsRoot)) {
            cwd = resolved;
          }
        }

        try {
          const child = spawn(commandStr, {
            shell: true,
            cwd,
            env: sanitizedEnv,
            windowsHide: true,
          });

          session.childProcess = child;

          let timeoutTimer: NodeJS.Timeout | null = null;
          if (timeoutMs > 0) {
            timeoutTimer = setTimeout(() => {
              if (!child.killed) {
                this.send(ws, {
                  type: 'stderr',
                  data: `\n[Cortex Terminal] Process timed out after ${timeoutMs}ms. Terminating...\n`,
                });
                this.killProcess(child, 'SIGTERM');
              }
            }, timeoutMs);
          }

          child.stdout?.on('data', (chunk: Buffer) => {
            this.send(ws, { type: 'stdout', data: chunk.toString('utf8') });
          });

          child.stderr?.on('data', (chunk: Buffer) => {
            this.send(ws, { type: 'stderr', data: chunk.toString('utf8') });
          });

          child.on('close', (exitCode, signal) => {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            session.childProcess = undefined;
            this.send(ws, { type: 'exit', exitCode, signal });
          });

          child.on('error', (err) => {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            session.childProcess = undefined;
            this.send(ws, { type: 'error', error: `Process error: ${err.message}` });
          });
        } catch (err: any) {
          this.send(ws, { type: 'error', error: `Execution spawn error: ${err.message}` });
        }
        break;
      }

      default:
        this.send(ws, { type: 'error', error: `Unknown action: ${(msg as any).type}` });
    }
  }

  /**
   * Safe process tree termination across operating systems.
   */
  private killProcess(child?: ChildProcess, signal: NodeJS.Signals | string = 'SIGTERM'): void {
    if (!child || child.killed || !child.pid) return;
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
      } else {
        child.kill(signal as any);
      }
    } catch {}
  }

  /**
   * Cleanly closes and tears down a session.
   */
  terminateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.childProcess && !session.childProcess.killed) {
      this.killProcess(session.childProcess, 'SIGTERM');
    }

    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.close();
    }

    this.sessions.delete(sessionId);
  }

  /**
   * Helper sending structured JSON message over WebSocket.
   */
  send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(msg));
      } catch (err) {
        console.warn('Failed to send WebSocket message:', err);
      }
    }
  }

  /**
   * Retrieves active sessions count.
   */
  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  /**
   * Closes all active sessions.
   */
  closeAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.terminateSession(sessionId);
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

export const terminalWebSocketManager = new TerminalWebSocketManager();
