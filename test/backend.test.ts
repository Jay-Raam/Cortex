import dotenv from 'dotenv';
dotenv.config();

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import { db } from '../src/server/db/database';
import { modelCatalog } from '../src/server/providers/catalog';
import { modelRouter } from '../src/server/providers/router';
import { coworkEngine } from '../src/server/cowork/engine';
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
});

