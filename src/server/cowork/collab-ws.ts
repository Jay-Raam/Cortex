import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from '../auth/auth';
import { db } from '../db/database';
import { workspaceManager } from './workspace-manager';
import { User, Workspace } from '../types';

export const COLLAB_PEER_COLORS = [
  '#38BDF8', // Sky 400
  '#A855F7', // Purple 500
  '#22C55E', // Green 500
  '#F97316', // Orange 500
  '#EC4899', // Pink 500
  '#EAB308', // Yellow 500
  '#06B6D4', // Cyan 500
  '#6366F1', // Indigo 500
];

export interface CollabCursor {
  line: number;
  column: number;
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export interface CollabPeer {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  color: string;
  activeFile: string | null;
  cursor: CollabCursor | null;
  joinedAt: string;
  lastSeenAt: string;
}

export interface CollabClientMessage {
  type: 'join' | 'cursor_move' | 'file_focus' | 'ping';
  token?: string;
  shareToken?: string;
  activeFile?: string | null;
  cursor?: CollabCursor | null;
}

export interface CollabServerMessage {
  type: 'joined' | 'peer_join' | 'peer_leave' | 'presence' | 'peers_list' | 'pong' | 'error';
  peerId?: string;
  peer?: CollabPeer;
  peers?: CollabPeer[];
  activeFile?: string | null;
  cursor?: CollabCursor | null;
  error?: string;
}

export interface CollabRoom {
  workspaceId: string;
  peers: Map<string, { peer: CollabPeer; ws: WebSocket }>;
  inviteTokens: Set<string>;
  createdAt: string;
}

export class CollabWebSocketManager {
  private rooms: Map<string, CollabRoom> = new Map();
  private wss: WebSocketServer | null = null;

  /**
   * Generates a cryptographic shareable invite token for a workspace collaboration room.
   */
  generateInviteToken(workspaceId: string): string {
    const room = this.getOrCreateRoom(workspaceId);
    const token = `inv_${crypto.randomBytes(16).toString('hex')}`;
    room.inviteTokens.add(token);
    return token;
  }

  /**
   * Validates whether an invite token is valid for a given workspace room.
   */
  validateInviteToken(workspaceId: string, token: string): boolean {
    const room = this.rooms.get(workspaceId);
    if (!room) return false;
    return room.inviteTokens.has(token);
  }

  /**
   * Returns list of all active peers currently connected to a workspace room.
   */
  getRoomPeers(workspaceId: string): CollabPeer[] {
    const room = this.rooms.get(workspaceId);
    if (!room) return [];
    return Array.from(room.peers.values()).map((p) => p.peer);
  }

  /**
   * Returns number of active collaboration rooms.
   */
  getActiveRoomCount(): number {
    return this.rooms.size;
  }

  private getOrCreateRoom(workspaceId: string): CollabRoom {
    let room = this.rooms.get(workspaceId);
    if (!room) {
      room = {
        workspaceId,
        peers: new Map(),
        inviteTokens: new Set(),
        createdAt: new Date().toISOString(),
      };
      this.rooms.set(workspaceId, room);
    }
    return room;
  }

  /**
   * Attaches the Collab WebSocket server to an existing HTTP server on /api/ws/collab/:workspaceId.
   */
  attachToServer(httpServer: http.Server): WebSocketServer {
    if (!this.wss) {
      this.wss = new WebSocketServer({ noServer: true });
    }

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
      const match = pathname.match(/^\/api\/ws\/collab\/([a-zA-Z0-9_-]+)/);
      if (!match) {
        return; // Handled by other routers (e.g. terminal ws)
      }

      const workspaceId = match[1];

      // Authenticate via token query param or Bearer header
      const token =
        parsedUrl.searchParams.get('token') ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.substring(7)
          : null);

      const shareToken = parsedUrl.searchParams.get('shareToken');

      let user: User | null = null;
      if (token) {
        try {
          const payload = verifyAccessToken(token);
          if (payload?.userId) {
            const found = db.getUserById(payload.userId);
            if (found) {
              user = found;
            }
          }
        } catch {
          // Fall through
        }
      }

      // Check access permission: Either authenticated user with workspace access, OR valid invite token
      let authorized = false;

      if (user) {
        const ws = db.getWorkspaceById(workspaceId, user.id);
        if (ws) {
          authorized = true;
        }
      }

      if (!authorized && shareToken && this.validateInviteToken(workspaceId, shareToken)) {
        authorized = true;
      }

      if (!authorized) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss?.handleUpgrade(req, socket, head, (ws) => {
        this.handleConnection(ws as WebSocket, workspaceId, user, shareToken || undefined);
      });
    });

    return this.wss;
  }

  /**
   * Handles a new authenticated peer WebSocket connection.
   */
  handleConnection(
    ws: WebSocket,
    workspaceId: string,
    user: User | null,
    shareToken?: string
  ): void {
    const room = this.getOrCreateRoom(workspaceId);
    const peerId = `peer_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const colorIdx = room.peers.size % COLLAB_PEER_COLORS.length;
    const assignedColor = COLLAB_PEER_COLORS[colorIdx];

    const peer: CollabPeer = {
      id: peerId,
      userId: user?.id || `guest_${crypto.randomBytes(3).toString('hex')}`,
      userName: user?.name || (shareToken ? `Guest Collaborator` : `Developer`),
      userEmail: user?.email || '',
      color: assignedColor,
      activeFile: null,
      cursor: null,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    // Store peer in room
    room.peers.set(peerId, { peer, ws });

    // Send welcome joined event to this client with current peer list
    const currentPeers = Array.from(room.peers.values())
      .filter((p) => p.peer.id !== peerId)
      .map((p) => p.peer);

    this.send(ws, {
      type: 'joined',
      peerId,
      peer,
      peers: currentPeers,
    });

    // Broadcast peer_join to all other peers in the room
    this.broadcastToRoom(
      workspaceId,
      {
        type: 'peer_join',
        peer,
      },
      peerId
    );

    // Message handler
    ws.on('message', (raw) => {
      try {
        const msg: CollabClientMessage = JSON.parse(raw.toString());
        peer.lastSeenAt = new Date().toISOString();

        if (msg.type === 'ping') {
          this.send(ws, { type: 'pong' });
        } else if (msg.type === 'cursor_move') {
          if (msg.cursor) {
            peer.cursor = msg.cursor;
          }
          if (msg.activeFile !== undefined) {
            peer.activeFile = msg.activeFile;
          }
          this.broadcastToRoom(
            workspaceId,
            {
              type: 'presence',
              peerId,
              activeFile: peer.activeFile,
              cursor: peer.cursor,
            },
            peerId
          );
        } else if (msg.type === 'file_focus') {
          peer.activeFile = msg.activeFile || null;
          this.broadcastToRoom(
            workspaceId,
            {
              type: 'presence',
              peerId,
              activeFile: peer.activeFile,
              cursor: peer.cursor,
            },
            peerId
          );
        }
      } catch (err: any) {
        this.send(ws, { type: 'error', error: err.message || 'Invalid collaboration message payload' });
      }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
      room.peers.delete(peerId);

      // Notify remaining peers
      this.broadcastToRoom(workspaceId, {
        type: 'peer_leave',
        peerId,
      });

      // If room is empty, cleanup after grace period
      if (room.peers.size === 0) {
        this.rooms.delete(workspaceId);
      }
    });

    ws.on('error', () => {
      try {
        ws.close();
      } catch {}
    });
  }

  /**
   * Broadcasts a message to all peers in a workspace room, optionally excluding a sender.
   */
  broadcastToRoom(
    workspaceId: string,
    message: CollabServerMessage,
    excludePeerId?: string
  ): void {
    const room = this.rooms.get(workspaceId);
    if (!room) return;

    const payload = JSON.stringify(message);
    for (const [pId, client] of room.peers.entries()) {
      if (excludePeerId && pId === excludePeerId) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  private send(ws: WebSocket, message: CollabServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

export const collabWebSocketManager = new CollabWebSocketManager();
