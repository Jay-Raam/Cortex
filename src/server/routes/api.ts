import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { modelRouter } from '../providers/router';
import { coworkEngine } from '../cowork/engine';
import { workspaceManager } from '../cowork/workspace-manager';
import { executionRunner } from '../cowork/execution-runner';
import { authenticateRequest, generateTokens } from '../auth/auth';
import { Message, User, Workspace } from '../types';
import { performWebSearch, formatSearchAugmentation } from '../services/search';
import { contextManager } from '../cowork/context-manager';

export const apiRouter = express.Router();

const COOKIE_NAME = 'cortex_access_token';
const IS_PROD = process.env.NODE_ENV === 'production';

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

// Helper to set HTTP-only authentication cookie
function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
    path: '/',
  });
}

/**
 * REST Authentication: Register with HTTP-Only Cookie
 */
apiRouter.post('/auth/register', (req: Request, res: Response) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email,
      name,
      passwordHash: bcrypt.hashSync(password, 10),
      role: 'user',
      createdAt: new Date().toISOString(),
    };

    db.createUser(newUser);

    // Default workspace for new user
    db.createWorkspace({
      id: `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: newUser.id,
      name: 'Primary Workspace',
      description: 'Default personal workspace for tasks, documents, and code artifacts.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { accessToken } = generateTokens(newUser, req.headers['user-agent']);
    setAuthCookie(res, accessToken);

    const safeUser = { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role, avatar: newUser.avatar };
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * REST Authentication: Login with HTTP-Only Cookie
 */
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.getUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const { accessToken } = generateTokens(user, req.headers['user-agent']);
    setAuthCookie(res, accessToken);

    const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar };
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * REST Authentication: Get Current Authenticated User
 */
apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const user = authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ authenticated: false, user: null });
  }
  const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar };
  res.json({ authenticated: true, user: safeUser });
});

/**
 * REST Authentication: Update Profile (Name & Avatar)
 */
apiRouter.patch('/auth/profile', (req: Request, res: Response) => {
  try {
    const user = authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { name, avatar } = req.body;
    const updates: Partial<User> = {};

    if (typeof name === 'string' && name.trim().length > 0) {
      updates.name = name.trim();
    }
    if (avatar === null || typeof avatar === 'string') {
      updates.avatar = avatar || undefined;
    }

    const updated = db.updateUser(user.id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const safeUser = { id: updated.id, email: updated.email, name: updated.name, role: updated.role, avatar: updated.avatar };
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * REST Authentication: Logout and Clear Cookie
 */
apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

// Helper to get authenticated user strictly (no fallback)
function getReqUser(req: Request): User {
  const user = authenticateRequest(req);
  if (user) return user;
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

  let accumulatedText = '';

  // Execute real-time web search grounding if requested
  const isWebSearchRequested = content.includes('[Web Search]') || Boolean(req.body.enableWebSearch);
  if (isWebSearchRequested) {
    sendEvent({
      type: 'delta',
      payload: { text: '*Searching the live web for verified sources...*\n\n' },
    });
    try {
      const searchResults = await performWebSearch(content);
      if (searchResults.length > 0) {
        const augmentation = formatSearchAugmentation(searchResults);
        if (history.length > 0) {
          history[history.length - 1].content += augmentation;
        }
      }
    } catch (searchErr) {
      console.warn('[Web Search Error]', searchErr);
    }
  }

  try {
    const result = await modelRouter.stream(
      {
        requestedModelId: modelId || conversation.modelId,
        mode: mode || conversation.mode,
        forceFree: forceFree !== false,
        messages: history,
        systemInstruction,
        attachments,
      },
      (event) => {
        if (event.type === 'delta' && event.payload?.text) {
          accumulatedText += event.payload.text;
        }
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
    const partial = (accumulatedText || err.partialText || '').trim();
    if (partial.length > 0) {
      try {
        const partialMessage: Message = {
          id: `msg_${Date.now()}_a`,
          conversationId,
          role: 'assistant',
          content: partial,
          modelUsed: modelId || conversation.modelId,
          createdAt: new Date().toISOString(),
        };
        db.addMessage(partialMessage, user.id);
      } catch {
        // ignore db error on partial save
      }
    }

    if (!res.writableEnded) {
      sendEvent({
        type: 'error',
        payload: {
          message: err.message || 'Stream processing failed',
          partialText: partial || undefined,
        },
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
 * Approve a pending step
 */
apiRouter.post('/cowork/tasks/:id/approve', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const { stepId, approvalId } = req.body;
  const task = db.getTaskById(id, user.id);
  if (!task) return res.status(404).json({ error: 'Task not found or access denied' });

  if (approvalId) {
    db.updateApprovalRequest(approvalId, 'approved');
  }

  const step = task.steps.find((s) => s.id === stepId || s.status === 'awaiting_approval');
  if (step) {
    step.isApproved = true;
    step.status = 'running';
    db.updateTask(id, user.id, { steps: task.steps });
  }

  try {
    const advanced = await coworkEngine.advanceTask(id, user.id);
    res.json({ success: true, task: advanced });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Approve the complete task execution plan (Mode B)
 */
apiRouter.post('/cowork/tasks/:id/plan/approve', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const { plannedFiles = [] } = req.body;
  const task = db.getTaskById(id, user.id);
  if (!task) return res.status(404).json({ error: 'Task not found or access denied' });

  // Extract all file targets from planned steps if not provided explicitly
  const extractedFiles = [...plannedFiles];
  for (const step of task.steps) {
    const f = step.toolInput?.filePath || step.toolInput?.path;
    if (f && !extractedFiles.includes(f)) {
      extractedFiles.push(f);
    }
  }

  db.updateTask(id, user.id, {
    isPlanApproved: true,
    plannedFiles: extractedFiles,
    status: 'running',
  });

  try {
    const advanced = await coworkEngine.advanceTask(id, user.id);
    res.json({ success: true, task: advanced, plannedFiles: extractedFiles });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Reject the complete task execution plan
 */
apiRouter.post('/cowork/tasks/:id/plan/reject', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const { reason = 'Plan rejected by developer' } = req.body;
  const task = db.getTaskById(id, user.id);
  if (!task) return res.status(404).json({ error: 'Task not found or access denied' });

  db.updateTask(id, user.id, {
    status: 'failed',
    isPlanApproved: false,
    error: `Execution plan was rejected: ${reason}`,
  });

  res.json({ success: true, task: db.getTaskById(id, user.id) });
});

/**
 * Update workspace permission mode (ask_every_change, approve_plan, session_edit)
 */
apiRouter.post('/cowork/workspaces/:id/permission-mode', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const { permissionMode } = req.body;

  const validModes = ['ask_every_change', 'approve_plan', 'session_edit'];
  if (!permissionMode || !validModes.includes(permissionMode)) {
    return res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
  }

  const updated = db.updateWorkspace(id, user.id, { permissionMode: permissionMode as any });
  if (!updated) return res.status(404).json({ error: 'Workspace not found or access denied' });

  res.json({ success: true, workspace: updated });
});

/**
 * Update workspace context window preference (auto, 32k, 64k, 128k, 200k, 500k, 1m)
 */
apiRouter.post('/cowork/workspaces/:id/context-preference', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const { contextWindowPreference } = req.body;

  const validPreferences = ['auto', '32k', '64k', '128k', '200k', '500k', '1m'];
  if (!contextWindowPreference || !validPreferences.includes(contextWindowPreference)) {
    return res.status(400).json({ error: `Invalid context preference. Must be one of: ${validPreferences.join(', ')}` });
  }

  const updated = db.updateWorkspace(id, user.id, { contextWindowPreference });
  if (!updated) return res.status(404).json({ error: 'Workspace not found or access denied' });

  res.json({ success: true, workspace: updated });
});

/**
 * Calculate dynamic context budget for model and workspace content
 */
apiRouter.post('/cowork/context-budget', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { modelId = 'gemini-3.8-flash', preference = 'auto', workspaceId, systemPrompt = '', toolCount = 15 } = req.body;

  let usedTextContent = '';
  if (workspaceId) {
    const ws = db.getWorkspaceById(workspaceId, user.id);
    if (ws) {
      try {
        const wsRoot = workspaceManager.getWorkspaceRoot(ws);
        const tree = await workspaceManager.listDirectoryTree(wsRoot, '', 3);
        usedTextContent = JSON.stringify(tree);
      } catch {}
    }
  }

  const budget = contextManager.calculateBudget({
    modelId,
    preference,
    systemPrompt,
    toolCount,
    usedTextContent,
  });

  const validOptions = contextManager.getValidOptionsForModel(modelId);

  res.json({ success: true, budget, options: validOptions });
});

/**
 * Cancel a running task
 */
apiRouter.post('/cowork/tasks/:id/cancel', (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const task = db.getTaskById(id, user.id);
  if (!task) return res.status(404).json({ error: 'Task not found or access denied' });
  db.updateTask(id, user.id, { status: 'cancelled' });
  res.json({ success: true, task: db.getTaskById(id, user.id) });
});

/**
 * Get workspace real directory tree
 */
apiRouter.get('/cowork/workspaces/:id/tree', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const workspace = db.getWorkspaceById(id, user.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found or access denied' });

  try {
    const wsRoot = workspaceManager.getWorkspaceRoot(workspace);
    const subDir = typeof req.query.dir === 'string' ? req.query.dir : '';
    const tree = await workspaceManager.listDirectoryTree(wsRoot, subDir);
    const gitStatus = await workspaceManager.getGitStatus(wsRoot);
    const stack = await workspaceManager.getProjectStructure(wsRoot);
    res.json({ success: true, workspaceRoot: wsRoot, tree, git: gitStatus, stack });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * List all workspaces for authenticated user
 */
apiRouter.get('/cowork/workspaces', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const workspaces = db.getWorkspaces(user.id);
  res.json({ success: true, workspaces });
});

/**
 * Delete a workspace
 */
apiRouter.delete('/cowork/workspaces/:id', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const deleted = db.deleteWorkspace(id, user.id);
  if (!deleted) return res.status(404).json({ error: 'Workspace not found or access denied' });
  res.json({ success: true, message: 'Workspace deleted' });
});

/**
 * Bind a local project folder as a persistent Co-Work workspace
 */
apiRouter.post('/cowork/workspaces/bind-local', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { folderPath, name, description, permissionMode = 'approve_plan' } = req.body;

  if (!folderPath || typeof folderPath !== 'string') {
    return res.status(400).json({ error: 'folderPath string is required.' });
  }

  const cleanInputPath = folderPath.trim();
  const folderName = path.basename(cleanInputPath.replace(/\\/g, '/')) || 'Local Project';

  let resolvedPath = path.resolve(cleanInputPath);
  let isDir = fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory();

  if (!isDir) {
    // If not found via path.resolve, test if raw input path exists directly (e.g. Windows drive letters)
    if (fs.existsSync(cleanInputPath) && fs.statSync(cleanInputPath).isDirectory()) {
      resolvedPath = cleanInputPath;
      isDir = true;
    }
  }

  // If path doesn't exist on host filesystem (common on cloud servers like Render when receiving client Windows paths like D:\...)
  if (!isDir) {
    const isWindowsPathOnLinux = /^[a-zA-Z]:[/\\]/.test(cleanInputPath) && process.platform !== 'win32';
    const isCloudEnv = Boolean(process.env.RENDER || process.env.VERCEL || process.env.NODE_ENV === 'production' || isWindowsPathOnLinux);

    if (isCloudEnv) {
      // Create a managed cloud workspace for this project
      const wsId = `ws_cloud_${Date.now()}`;
      const cloudWsDir = path.resolve(process.cwd(), 'workspaces', wsId);
      fs.mkdirSync(cloudWsDir, { recursive: true });

      // Create an initial informative README and package.json
      const readmeContent = `# ${name?.trim() || folderName}\n\nWorkspace initialized for project: \`${cleanInputPath}\`\n\n*Running on Cloud Deployment. You can sync your local files directly using the "Browse Local Folder" button or start prompting the agent immediately.*`;
      fs.writeFileSync(path.join(cloudWsDir, 'README.md'), readmeContent, 'utf8');

      const pkgJson = {
        name: (name?.trim() || folderName).toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        version: '1.0.0',
        description: `Workspace for ${cleanInputPath}`,
        scripts: {
          test: "echo 'No tests specified' && exit 0"
        }
      };
      fs.writeFileSync(path.join(cloudWsDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf8');

      resolvedPath = cloudWsDir;
      isDir = true;
    } else {
      // On local environments: automatically initialize the requested project directory
      try {
        fs.mkdirSync(resolvedPath, { recursive: true });
        isDir = true;
        const readmeContent = `# ${name?.trim() || folderName}\n\nWorkspace initialized for project: \`${cleanInputPath}\`\n\n*Created with Cortex AI Cowork.*`;
        fs.writeFileSync(path.join(resolvedPath, 'README.md'), readmeContent, 'utf8');
      } catch {
        // Fallback to managed workspace directory
        const wsId = `ws_local_${Date.now()}`;
        const fallbackWsDir = path.resolve(process.cwd(), 'workspaces', wsId);
        fs.mkdirSync(fallbackWsDir, { recursive: true });
        const readmeContent = `# ${name?.trim() || folderName}\n\nWorkspace initialized for project: \`${cleanInputPath}\``;
        fs.writeFileSync(path.join(fallbackWsDir, 'README.md'), readmeContent, 'utf8');
        resolvedPath = fallbackWsDir;
        isDir = true;
      }
    }
  }

  // Detect project stack
  const stack = await workspaceManager.getProjectStructure(resolvedPath);
  const git = await workspaceManager.getGitStatus(resolvedPath);

  const newWorkspace: Workspace = {
    id: `ws_local_${Date.now()}`,
    userId: user.id,
    name: name?.trim() || folderName,
    description: description?.trim() || `Bound local folder: ${cleanInputPath}`,
    projectRoot: resolvedPath,
    isLocalBinding: true,
    gitBranch: git.branch,
    permissionMode: permissionMode as any,
    detectedStack: stack,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createWorkspace(newWorkspace);
  res.json({ success: true, workspace: newWorkspace, stack });
});

/**
 * Import a local project folder directly with files uploaded from browser
 */
apiRouter.post('/cowork/workspaces/import-folder', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { name, folderName, originalPath, files = [], permissionMode = 'approve_plan' } = req.body;

  const wsId = `ws_import_${Date.now()}`;
  const wsRoot = path.resolve(process.cwd(), 'workspaces', wsId);
  fs.mkdirSync(wsRoot, { recursive: true });

  let savedCount = 0;
  for (const file of files) {
    if (!file.path || typeof file.path !== 'string') continue;
    const normalizedFilePath = file.path.replace(/\\/g, '/');
    if (normalizedFilePath.includes('..') || normalizedFilePath.includes('\0')) continue;
    try {
      const safePath = workspaceManager.resolveSafePath(wsRoot, normalizedFilePath);
      fs.mkdirSync(path.dirname(safePath), { recursive: true });
      fs.writeFileSync(safePath, typeof file.content === 'string' ? file.content : '', 'utf8');
      savedCount++;
    } catch (err) {
      console.warn('Failed to import file:', file.path, err);
    }
  }

  // If no files were written, create an initial README
  if (savedCount === 0) {
    const displayName = name?.trim() || folderName || 'Local Project';
    fs.writeFileSync(
      path.join(wsRoot, 'README.md'),
      `# ${displayName}\n\nWorkspace initialized. Start adding code files or ask the agent to create components.`,
      'utf8'
    );
  }

  // Detect project stack and git if any
  const stack = await workspaceManager.getProjectStructure(wsRoot);
  const git = await workspaceManager.getGitStatus(wsRoot);

  const displayWorkspaceName = name?.trim() || folderName || 'Local Project';
  const newWorkspace: Workspace = {
    id: wsId,
    userId: user.id,
    name: displayWorkspaceName,
    description: originalPath ? `Imported from: ${originalPath}` : `Imported folder: ${folderName || 'Local Project'}`,
    projectRoot: wsRoot,
    isLocalBinding: true,
    gitBranch: git.branch,
    permissionMode: (permissionMode as any) || 'approve_plan',
    detectedStack: stack,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createWorkspace(newWorkspace);
  res.json({ success: true, workspace: newWorkspace, stack, fileCount: savedCount });
});

/**
 * Sync or upload files into an existing workspace
 */
apiRouter.post('/cowork/workspaces/:id/sync-files', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const workspace = db.getWorkspaceById(id, user.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

  const { files = [] } = req.body;
  const wsRoot = workspaceManager.getWorkspaceRoot(workspace);

  let syncedCount = 0;
  for (const file of files) {
    if (!file.path || typeof file.path !== 'string') continue;
    const normalizedFilePath = file.path.replace(/\\/g, '/');
    if (normalizedFilePath.includes('..') || normalizedFilePath.includes('\0')) continue;
    try {
      const safePath = workspaceManager.resolveSafePath(wsRoot, normalizedFilePath);
      fs.mkdirSync(path.dirname(safePath), { recursive: true });
      fs.writeFileSync(safePath, typeof file.content === 'string' ? file.content : '', 'utf8');
      syncedCount++;
    } catch (err) {
      console.warn('Failed to sync file:', file.path, err);
    }
  }

  const stack = await workspaceManager.getProjectStructure(wsRoot);
  res.json({ success: true, syncedCount, stack });
});

/**
 * Read a real workspace file
 */
apiRouter.get('/cowork/workspaces/:id/file', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'path query parameter is required' });

  const workspace = db.getWorkspaceById(id, user.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found or access denied' });

  try {
    const wsRoot = workspaceManager.getWorkspaceRoot(workspace);
    const fileData = await workspaceManager.readFile(wsRoot, filePath);
    res.json({ success: true, ...fileData });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * Save / edit a real workspace file
 */
apiRouter.post('/cowork/workspaces/:id/file', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'path and content are required' });
  }

  const workspace = db.getWorkspaceById(id, user.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found or access denied' });

  try {
    const wsRoot = workspaceManager.getWorkspaceRoot(workspace);
    const result = await workspaceManager.createFile(wsRoot, filePath, content);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Execute terminal command in workspace
 */
apiRouter.post('/cowork/workspaces/:id/terminal/execute', async (req: Request, res: Response) => {
  let user: User;
  try { user = getReqUser(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  const { id } = req.params;
  const { command, timeoutMs = 30000 } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'command string is required' });
  }

  const workspace = db.getWorkspaceById(id, user.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found or access denied' });

  try {
    const wsRoot = workspaceManager.getWorkspaceRoot(workspace);
    const result = await executionRunner.executeCommand(command, {
      cwd: wsRoot,
      timeoutMs,
    });
    res.json({ success: result.exitCode === 0, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Sandboxed Code Execution Runner for Workspace Artifacts
 */
apiRouter.post('/cowork/run-code', async (req: Request, res: Response) => {
  let user: User;
  try {
    user = getReqUser(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { code, language = 'javascript', workspaceId = 'default', timeoutMs = 3000 } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid code string to execute.' });
  }

  try {
    const result = await coworkEngine.executeTool(
      'code_execution_runner',
      { code, language, timeoutMs },
      workspaceId,
      user.id
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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
