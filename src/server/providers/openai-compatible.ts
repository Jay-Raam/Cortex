import { StreamCallbacks } from './gemini';
import { validateEndpointUrl } from '../security/ssrf-validator';

export interface ProviderEndpointConfig {
  baseUrl: string;
  apiKey: string;
  defaultHeaders?: Record<string, string>;
  allowPrivateNetworks?: boolean;
}

export async function streamOpenAICompatibleResponse(
  config: ProviderEndpointConfig,
  modelId: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemInstruction: string | undefined,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const formattedMessages: Array<{ role: string; content: string }> = [];

  if (systemInstruction) {
    formattedMessages.push({ role: 'system', content: systemInstruction });
  }

  for (const m of messages) {
    formattedMessages.push({ role: m.role, content: m.content });
  }

  // SSRF Protection: Validate target baseUrl before connecting
  const ssrfCheck = await validateEndpointUrl(config.baseUrl, {
    allowPrivateNetworks: config.allowPrivateNetworks,
  });
  if (!ssrfCheck.isValid) {
    throw new Error(`SSRF protection: Request blocked to forbidden endpoint (${ssrfCheck.reason})`);
  }

  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const requestBody: Record<string, any> = {
    model: modelId,
    messages: formattedMessages,
    stream: true,
  };

  // OpenRouter reasoning models (e.g. Nemotron) generate hundreds of internal reasoning tokens
  // before answering unless reasoning tokens are set to 0, which previously caused a 25s delay.
  if (config.baseUrl.includes('openrouter.ai')) {
    requestBody.reasoning = { max_tokens: 0 };
  }

  // Connection timeout: 60s for initial HTTP handshake and headers
  const connectTimeoutMs = 60000;
  let isConnected = false;
  const streamAbortController = new AbortController();

  const connectTimer = setTimeout(() => {
    if (!isConnected) {
      streamAbortController.abort(new Error(`Connection to provider timed out after ${connectTimeoutMs / 1000}s`));
    }
  }, connectTimeoutMs);

  const onUserAbort = () => {
    streamAbortController.abort(new Error('Stream cancelled by user'));
  };

  if (signal) {
    if (signal.aborted) {
      clearTimeout(connectTimer);
      throw new Error('Stream cancelled by user');
    }
    signal.addEventListener('abort', onUserAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...config.defaultHeaders,
      },
      body: JSON.stringify(requestBody),
      signal: streamAbortController.signal,
    });
  } catch (err: any) {
    clearTimeout(connectTimer);
    if (signal) signal.removeEventListener('abort', onUserAbort);
    if (streamAbortController.signal.aborted && !signal?.aborted) {
      throw new Error(`Provider connection timed out after ${connectTimeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    isConnected = true;
    clearTimeout(connectTimer);
  }

  if (!response.ok) {
    if (signal) signal.removeEventListener('abort', onUserAbort);
    const errorText = await response.text();
    throw new Error(`Provider returned ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    if (signal) signal.removeEventListener('abort', onUserAbort);
    throw new Error('No response body received from provider stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';

  // Stream activity / idle timeout: If no chunk is received from provider for 45s, terminate
  const IDLE_CHUNK_TIMEOUT_MS = 45000;

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel().catch(() => {});
        throw new Error('Stream cancelled by user');
      }

      let idleTimer: NodeJS.Timeout | null = null;
      const idlePromise = new Promise<never>((_, reject) => {
        idleTimer = setTimeout(() => {
          reject(new Error(`Stream stalled: no data received from provider for ${IDLE_CHUNK_TIMEOUT_MS / 1000}s`));
        }, IDLE_CHUNK_TIMEOUT_MS);
      });

      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await Promise.race([reader.read(), idlePromise]);
      } catch (err: any) {
        reader.cancel().catch(() => {});
        throw err;
      } finally {
        if (idleTimer) clearTimeout(idleTimer);
      }

      const { done, value } = readResult;
      if (done) break;

      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed === 'data: [DONE]') {
          if (callbacks.onDone) callbacks.onDone();
          return fullText;
        }

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.delta?.reasoning;
            if (delta) {
              fullText += delta;
              callbacks.onDelta(delta);
            }
            if (parsed.usage && callbacks.onUsage) {
              callbacks.onUsage({
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
              });
            }
          } catch {
            // Ignore partial or non-json keepalives
          }
        }
      }
    }
  } finally {
    if (signal) signal.removeEventListener('abort', onUserAbort);
  }

  if (callbacks.onDone) {
    callbacks.onDone();
  }

  return fullText;
}
