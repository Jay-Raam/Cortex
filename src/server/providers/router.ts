import { ModelMode, ProviderId, ModelInfo } from '../types';
import { modelCatalog } from './catalog';
import { streamGeminiResponse } from './gemini';
import { streamOpenAICompatibleResponse } from './openai-compatible';

export interface RouteRequest {
  requestedModelId?: string;
  mode?: ModelMode;
  forceFree?: boolean;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  systemInstruction?: string;
  allowPaidInference?: boolean;
  attachments?: Array<{ id: string; name: string; mimeType: string; url: string }>;
}

export interface StreamEvent {
  type: 'started' | 'delta' | 'tool_call' | 'tool_result' | 'usage' | 'completed' | 'fallback_notice' | 'error';
  payload: any;
}

export class ModelRouter {
  /**
   * Determine the best model based on mode, requested model, vision needs, and free-first policies.
   */
  resolveModel(req: RouteRequest): { model: ModelInfo; isFallback: boolean; fallbackReason?: string } {
    const catalog = modelCatalog.getModels();
    const mode = req.mode || 'balanced';
    const forceFree = req.forceFree !== false; // Default: true (Zero-cost prioritized)
    const hasImageAttachments = req.attachments?.some((a) => a.mimeType?.startsWith('image/'));

    // 1. If explicit model requested
    if (req.requestedModelId) {
      const explicit = catalog.find((m) => m.id === req.requestedModelId);
      if (explicit) {
        // If image attachments exist but explicit model is text-only, auto-route to Gemini Vision
        if (hasImageAttachments && !explicit.capabilities.vision) {
          const visionFallback =
            catalog.find((m) => m.id === 'gemini-3.8-flash' && m.availability === 'available') ||
            catalog.find((m) => m.capabilities.vision && m.availability === 'available') ||
            catalog.find((m) => m.id === 'gemini-3.8-flash') ||
            catalog.find((m) => m.capabilities.vision);
          if (visionFallback) {
            return {
              model: visionFallback,
              isFallback: true,
              fallbackReason: `Selected model (${explicit.displayName}) is text-only. Automatically switched to ${visionFallback.displayName} for multi-modal vision analysis.`,
            };
          }
        }

        // If explicit model is paid but allowPaidInference is false and forceFree is true
        if (!explicit.isFree && !req.allowPaidInference && forceFree) {
          throw new Error(
            `Model "${explicit.displayName}" is a paid inference model. Enable paid inference in settings or select a free zero-cost model (e.g. Gemini 3.8 Flash, Llama 3.3 Free).`
          );
        }
        // Check availability
        if (explicit.availability === 'unconfigured') {
          // If image attachments are present and explicit model already has vision, keep vision model
          if (hasImageAttachments && explicit.capabilities.vision) {
            return { model: explicit, isFallback: false };
          }
          // If requested model is unconfigured (e.g. missing API key), fallback to an available configured model
          const fallback = this.findFallbackModel(mode, forceFree);
          if (fallback) {
            return {
              model: fallback,
              isFallback: true,
              fallbackReason: `Selected provider for ${explicit.displayName} is unconfigured. Routed to available model ${fallback.displayName}.`,
            };
          }
        }
        return { model: explicit, isFallback: false };
      }
    }

    // 2. Intelligent mode routing with Free-First policy
    let eligibleByMode = catalog.filter((m) => m.mode === mode && m.availability === 'available');

    // If image attachments exist, ensure model supports vision
    if (hasImageAttachments) {
      const visionOnly = eligibleByMode.filter((m) => m.capabilities.vision);
      if (visionOnly.length > 0) {
        eligibleByMode = visionOnly;
      }
    }

    // Prefer free models first
    if (forceFree) {
      const freeEligible = eligibleByMode.filter((m) => m.isFree);
      if (freeEligible.length > 0) {
        // Pick best latency
        const sorted = freeEligible.sort((a, b) => a.latencyMs - b.latencyMs);
        return { model: sorted[0], isFallback: false };
      }
      // If none available in mode, look for ANY available free model
      const anyFree = catalog.filter((m) => m.isFree && m.availability === 'available');
      if (anyFree.length > 0) {
        const sorted = anyFree.sort((a, b) => a.latencyMs - b.latencyMs);
        return {
          model: sorted[0],
          isFallback: true,
          fallbackReason: `No free models active in ${mode} mode; routed to free model ${sorted[0].displayName}.`,
        };
      }
    }

    // If paid inference is allowed or forceFree is false
    if (req.allowPaidInference || !forceFree) {
      if (eligibleByMode.length > 0) {
        return { model: eligibleByMode[0], isFallback: false };
      }
    }

    // Default guaranteed fallback: Gemini 3.8 Flash
    const defaultGemini = catalog.find((m) => m.id === 'gemini-3.8-flash') || catalog[0];
    return { model: defaultGemini, isFallback: false };
  }

  private findFallbackModel(mode: ModelMode, forceFree: boolean): ModelInfo | null {
    const catalog = modelCatalog.getModels();
    const available = catalog.filter((m) => m.availability === 'available' && (forceFree ? m.isFree : true));
    if (available.length === 0) return null;
    const sameMode = available.filter((m) => m.mode === mode);
    if (sameMode.length > 0) return sameMode[0];
    return available[0];
  }

  /**
   * Execute streaming generation through the appropriate provider adapter.
   */
  async stream(
    req: RouteRequest,
    onEvent: (event: StreamEvent) => void,
    signal?: AbortSignal
  ): Promise<{ text: string; modelUsed: string; providerUsed: ProviderId }> {
    const { model, isFallback, fallbackReason } = this.resolveModel(req);

    if (isFallback && fallbackReason) {
      onEvent({
        type: 'fallback_notice',
        payload: {
          originalModel: req.requestedModelId,
          fallbackModel: model.id,
          reason: fallbackReason,
        },
      });
    }

    onEvent({
      type: 'started',
      payload: {
        modelId: model.id,
        displayName: model.displayName,
        providerId: model.providerId,
        isFree: model.isFree,
      },
    });

    let completedText = '';
    let accumulatedText = '';
    const handleDelta = (text: string) => {
      accumulatedText += text;
      onEvent({ type: 'delta', payload: { text } });
    };

    try {
      if (model.providerId === 'gemini') {
        completedText = await streamGeminiResponse(
          model.id,
          req.messages,
          req.systemInstruction,
          {
            onDelta: handleDelta,
            onUsage: (usage) => onEvent({ type: 'usage', payload: usage }),
          },
          signal,
          req.attachments
        );
      } else if (model.providerId === 'openrouter') {
        const apiKey = process.env.OPENROUTER_API_KEY || '';
        completedText = await streamOpenAICompatibleResponse(
          {
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey,
            defaultHeaders: {
              'HTTP-Referer': 'https://cortex.ai',
              'X-Title': 'Cortex AI Platform',
            },
          },
          model.id,
          req.messages,
          req.systemInstruction,
          {
            onDelta: handleDelta,
            onUsage: (usage) => onEvent({ type: 'usage', payload: usage }),
          },
          signal
        );
      } else if (model.providerId === 'groq') {
        const apiKey = process.env.GROQ_API_KEY || '';
        const realGroqModel = model.id.replace('groq/', '');
        completedText = await streamOpenAICompatibleResponse(
          {
            baseUrl: 'https://api.groq.com/openai/v1',
            apiKey,
          },
          realGroqModel,
          req.messages,
          req.systemInstruction,
          {
            onDelta: handleDelta,
            onUsage: (usage) => onEvent({ type: 'usage', payload: usage }),
          },
          signal
        );
      } else if (model.providerId === 'nvidia') {
        const apiKey = process.env.NVIDIA_NIM_API_KEY || '';
        const realNvidiaModel = model.id;
        completedText = await streamOpenAICompatibleResponse(
          {
            baseUrl: 'https://integrate.api.nvidia.com/v1',
            apiKey,
          },
          realNvidiaModel,
          req.messages,
          req.systemInstruction,
          {
            onDelta: handleDelta,
            onUsage: (usage) => onEvent({ type: 'usage', payload: usage }),
          },
          signal
        );
      } else {
        // OpenAI compatible fallback
        const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL || 'https://api.openai.com/v1';
        const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY || '';
        completedText = await streamOpenAICompatibleResponse(
          { baseUrl, apiKey },
          model.id,
          req.messages,
          req.systemInstruction,
          {
            onDelta: handleDelta,
            onUsage: (usage) => onEvent({ type: 'usage', payload: usage }),
          },
          signal
        );
      }

      return {
        text: completedText || accumulatedText,
        modelUsed: model.id,
        providerUsed: model.providerId,
      };
    } catch (err: any) {
      if (signal?.aborted) {
        throw err;
      }
      // Only attempt fallback if no tokens have been streamed yet to avoid splicing or duplicating responses
      if (accumulatedText.length === 0) {
        // If Gemini failed, attempt automatic fallback to OpenRouter free model if available
        if (model.providerId === 'gemini' && process.env.OPENROUTER_API_KEY) {
          const fallbackModelId = 'nvidia/nemotron-3.5-lightning:free';
          onEvent({
            type: 'fallback_notice',
            payload: {
              originalModel: model.id,
              fallbackModel: fallbackModelId,
              reason: `Gemini service encountered an issue (${err.message}). Automatically switched to ${fallbackModelId}.`,
            },
          });
          const apiKey = process.env.OPENROUTER_API_KEY;
          completedText = await streamOpenAICompatibleResponse(
            {
              baseUrl: 'https://openrouter.ai/api/v1',
              apiKey,
              defaultHeaders: {
                'HTTP-Referer': 'https://cortex.ai',
                'X-Title': 'Cortex AI Platform',
              },
            },
            fallbackModelId,
            req.messages,
            req.systemInstruction,
            {
              onDelta: handleDelta,
              onUsage: (usage) => onEvent({ type: 'usage', payload: usage }),
            },
            signal
          );
          return {
            text: completedText || accumulatedText,
            modelUsed: fallbackModelId,
            providerUsed: 'openrouter',
          };
        }
        // If non-Gemini provider failed, attempt fallback to Gemini if configured
        if (model.providerId !== 'gemini' && process.env.GEMINI_API_KEY) {
          onEvent({
            type: 'fallback_notice',
            payload: {
              originalModel: model.id,
              fallbackModel: 'gemini-3.8-flash',
              reason: `Primary provider error (${err.message}). Recovering with Gemini fallback.`,
            },
          });
          completedText = await streamGeminiResponse(
            'gemini-3.8-flash',
            req.messages,
            req.systemInstruction,
            {
              onDelta: handleDelta,
              onUsage: (usage) => onEvent({ type: 'usage', payload: usage }),
            },
            signal,
            req.attachments
          );
          return {
            text: completedText || accumulatedText,
            modelUsed: 'gemini-3.8-flash',
            providerUsed: 'gemini',
          };
        }
      }

      onEvent({
        type: 'error',
        payload: {
          message: err.message || 'Stream generation failed',
          partialText: accumulatedText || undefined,
        },
      });
      const streamErr = new Error(err.message || 'Stream generation failed');
      (streamErr as any).partialText = accumulatedText;
      throw streamErr;
    }
  }
}

export const modelRouter = new ModelRouter();
