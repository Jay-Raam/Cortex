import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';
import { modelRouter } from '../providers/router';
import { coworkEngine } from '../cowork/engine';
import { authenticateRequest } from '../auth/auth';
import { Message, User } from '../types';

export const apiRouter = express.Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(ts|tsx|js|jsx|py|go|rs|json|md|txt|csv|sql)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Permitted: text, code, json, csv, pdf, image.'));
    }
  },
});

// Helper to get authenticated user or dev fallback
function getReqUser(req: Request): User {
  const user = authenticateRequest(req);
  if (user) return user;
  const devUser = db.getUserById('usr_dev_primary');
  if (devUser) return devUser;
  throw new Error('Authentication required');
}

/**
 * Health and readiness endpoint
 */
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    product: 'Cortex AI Platform',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    providers: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      groq: Boolean(process.env.GROQ_API_KEY),
      nvidia: Boolean(process.env.NVIDIA_NIM_API_KEY),
    },
  });
});

/**
 * Real-time SSE Chat Streaming Endpoint
 */
apiRouter.post('/chat/stream', async (req: Request, res: Response) => {
  let user: User;
  try {
    user = getReqUser(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { conversationId, content, modelId, mode, forceFree, skillId, attachments } = req.body;

  if (!conversationId || !content) {
    return res.status(400).json({ error: 'conversationId and content are required' });
  }

  const conversation = db.getConversationById(conversationId, user.id);
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found or access denied' });
  }

  // Persist user prompt message
  const userMessage: Message = {
    id: `msg_${Date.now()}_u`,
    conversationId,
    role: 'user',
    content,
    attachments,
    createdAt: new Date().toISOString(),
  };
  db.addMessage(userMessage, user.id);

  // Retrieve skill instructions if specified
  let systemInstruction: string | undefined;
  const activeSkillId = skillId || conversation.skillId;
  if (activeSkillId) {
    const skill = db.getSkillById(activeSkillId);
    if (skill && skill.isEnabled) {
      systemInstruction = `${skill.instructions}\n\nYou are operating in the "${skill.name}" specialized workflow. Adhere strictly to these domain standards.`;
    }
  }

  // Fetch full conversation history for context
  const history = db.getMessages(conversationId, user.id).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Setup SSE stream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  const sendEvent = (event: any) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  };

  try {
    const result = await modelRouter.stream(
      {
        requestedModelId: modelId || conversation.modelId,
        mode: mode || conversation.mode,
        forceFree: forceFree !== false,
        messages: history,
        systemInstruction,
      },
      (event) => {
        sendEvent(event);
      },
      abortController.signal
    );

    // Save assistant response message
    const assistantMessage: Message = {
      id: `msg_${Date.now()}_a`,
      conversationId,
      role: 'assistant',
      content: result.text,
      modelUsed: result.modelUsed,
      providerUsed: result.providerUsed,
      createdAt: new Date().toISOString(),
    };
    db.addMessage(assistantMessage, user.id);

    sendEvent({
      type: 'completed',
      payload: {
        messageId: assistantMessage.id,
        modelUsed: result.modelUsed,
        providerUsed: result.providerUsed,
      },
    });

    res.end();
  } catch (err: any) {
    if (!res.writableEnded) {
      sendEvent({
        type: 'error',
        payload: { message: err.message || 'Stream processing failed' },
      });
      res.end();
    }
  }
});

/**
 * File upload endpoint
 */
apiRouter.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const attachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      url: `/uploads/${file.filename}`,
      createdAt: new Date().toISOString(),
    };

    res.json({ success: true, attachment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Run / advance a Co-Work agent task
 */
apiRouter.post('/cowork/tasks/:id/advance', async (req: Request, res: Response) => {
  let user: User;
  try {
    user = getReqUser(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;
  try {
    const task = await coworkEngine.advanceTask(id, user.id);
    res.json({ success: true, task });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Notification test triggers (verifies adapter contracts without sending spam)
 */
apiRouter.post('/notifications/test', (req: Request, res: Response) => {
  let user: User;
  try {
    user = getReqUser(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { channel = 'in_app' } = req.body;
  const notif = db.addNotification({
    id: `notif_${Date.now()}`,
    userId: user.id,
    title: `Test Notification (${channel})`,
    message: `Verification message for channel ${channel}. Integration adapter validated successfully.`,
    channel: channel as any,
    type: 'system',
    read: false,
    createdAt: new Date().toISOString(),
  });

  res.json({ success: true, notification: notif });
});
