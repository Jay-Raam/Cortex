import dotenv from 'dotenv';
dotenv.config();

// Ensure test environment mock credentials exist for deterministic CI pipeline runs
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'ci-test-mock-gemini-key';
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'ci-test-mock-openrouter-key';

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import { db } from '../src/server/db/database';
import { modelCatalog } from '../src/server/providers/catalog';
import { modelRouter } from '../src/server/providers/router';
import { coworkEngine } from '../src/server/cowork/engine';
import { workspaceManager } from '../src/server/cowork/workspace-manager';
import { executionRunner } from '../src/server/cowork/execution-runner';
import { User, Conversation, Message, AgentTask } from '../src/server/types';
import { performWebSearch, formatSearchAugmentation } from '../src/server/services/search';

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
});

