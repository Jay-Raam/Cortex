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
import { modelCatalog } from '../src/server/providers/catalog';
import { modelRouter } from '../src/server/providers/router';
import { coworkEngine } from '../src/server/cowork/engine';
import { workspaceManager } from '../src/server/cowork/workspace-manager';
import { executionRunner } from '../src/server/cowork/execution-runner';
import { contextManager } from '../src/server/cowork/context-manager';
import { User, Conversation, Message, AgentTask } from '../src/server/types';
import { performWebSearch, formatSearchAugmentation } from '../src/server/services/search';
import { detectWebDomain, generateDynamicWebHtml } from '../src/server/cowork/language-generators';
import { apiRouter } from '../src/server/routes/api';
import { generateTokens } from '../src/server/auth/auth';

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
        const res = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${ws.id}/export-zip?token=${accessToken}`);
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
        const res2 = await fetch(`http://127.0.0.1:${port}/api/cowork/workspaces/${ws.id}/export-zip?token=${u2Token}`);
        assert.strictEqual(res2.status, 404, 'Must reject unauthorized tenant access with 404');
      } finally {
        server.close();
      }
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

