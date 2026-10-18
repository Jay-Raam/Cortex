import { modelCatalog } from '../providers/catalog';
import { ModelInfo } from '../types';

export type ContextWindowChoice = 'auto' | '32k' | '64k' | '128k' | '200k' | '500k' | '1m';

export interface ContextBudget {
  requestedPreference: ContextWindowChoice;
  modelMaxLimit: number;
  effectiveLimit: number;
  reservedOutputTokens: number;
  systemPromptTokens: number;
  toolDefinitionTokens: number;
  safetyMarginTokens: number;
  availableInputTokens: number;
  estimatedUsedTokens: number;
  remainingTokens: number;
  utilizationPercent: number;
  isOverCapacity: boolean;
  warning?: string;
}

export const CONTEXT_WINDOW_SIZES: Record<ContextWindowChoice, number> = {
  auto: 0, // dynamic
  '32k': 32768,
  '64k': 65536,
  '128k': 131072,
  '200k': 200000,
  '500k': 500000,
  '1m': 1048576,
};

export class ContextManager {
  /**
   * Approximate token count for text (avg ~3.8 chars per token for code/text).
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 3.8);
  }

  /**
   * Filter selectable context window options based on selected model's hardware limit.
   */
  getValidOptionsForModel(modelId: string): Array<{ id: ContextWindowChoice; label: string; tokens: number; disabled: boolean }> {
    const model = modelCatalog.getModelById(modelId) || modelCatalog.getModels()[0];
    const maxLimit = model?.contextWindow || 1048576;

    const choices: Array<{ id: ContextWindowChoice; label: string; tokens: number }> = [
      { id: 'auto', label: 'Auto (Recommended)', tokens: maxLimit },
      { id: '32k', label: '32K Tokens', tokens: 32768 },
      { id: '64k', label: '64K Tokens', tokens: 65536 },
      { id: '128k', label: '128K Tokens', tokens: 131072 },
      { id: '200k', label: '200K Tokens', tokens: 200000 },
      { id: '500k', label: '500K Tokens', tokens: 500000 },
      { id: '1m', label: '1M Tokens', tokens: 1048576 },
    ];

    return choices.map((c) => ({
      ...c,
      disabled: c.id !== 'auto' && c.tokens > maxLimit,
    }));
  }

  /**
   * Calculates the exact safe token budget according to specification:
   * availableInputTokens = effectiveLimit - reservedOutputTokens - systemPromptTokens - toolDefinitionTokens - safetyMarginTokens
   */
  calculateBudget(options: {
    modelId: string;
    preference?: ContextWindowChoice;
    systemPrompt?: string;
    toolCount?: number;
    usedTextContent?: string;
    reservedOutput?: number;
  }): ContextBudget {
    const {
      modelId,
      preference = 'auto',
      systemPrompt = '',
      toolCount = 15,
      usedTextContent = '',
      reservedOutput = 4096,
    } = options;

    const model = modelCatalog.getModelById(modelId) || modelCatalog.getModels()[0];
    const modelMaxLimit = model?.contextWindow || 1048576;

    // Determine target size from user preference
    let targetSize = CONTEXT_WINDOW_SIZES[preference] || modelMaxLimit;
    let warning: string | undefined;

    if (preference === 'auto') {
      targetSize = modelMaxLimit;
    } else if (targetSize > modelMaxLimit) {
      warning = `Selected context (${preference.toUpperCase()}) exceeds model limit (${(modelMaxLimit / 1024).toFixed(0)}K). Capped to model maximum.`;
      targetSize = modelMaxLimit;
    }

    const effectiveLimit = Math.min(targetSize, modelMaxLimit);
    const reservedOutputTokens = reservedOutput;
    const systemPromptTokens = this.estimateTokens(systemPrompt);
    const toolDefinitionTokens = toolCount * 120; // ~120 tokens per structured tool schema
    const safetyMarginTokens = Math.max(1024, Math.floor(effectiveLimit * 0.05)); // 5% safety margin

    const overhead = reservedOutputTokens + systemPromptTokens + toolDefinitionTokens + safetyMarginTokens;
    const availableInputTokens = Math.max(0, effectiveLimit - overhead);

    const estimatedUsedTokens = this.estimateTokens(usedTextContent);
    const remainingTokens = Math.max(0, availableInputTokens - estimatedUsedTokens);
    const utilizationPercent = effectiveLimit > 0 ? Math.min(100, Math.round(((estimatedUsedTokens + overhead) / effectiveLimit) * 100)) : 0;
    const isOverCapacity = estimatedUsedTokens > availableInputTokens;

    if (isOverCapacity && !warning) {
      warning = `Context budget exceeded by ${estimatedUsedTokens - availableInputTokens} tokens. Files or history will be summarized.`;
    }

    return {
      requestedPreference: preference,
      modelMaxLimit,
      effectiveLimit,
      reservedOutputTokens,
      systemPromptTokens,
      toolDefinitionTokens,
      safetyMarginTokens,
      availableInputTokens,
      estimatedUsedTokens,
      remainingTokens,
      utilizationPercent,
      isOverCapacity,
      warning,
    };
  }
}

export const contextManager = new ContextManager();
