import { StreamCallbacks } from './gemini';

export interface ProviderEndpointConfig {
  baseUrl: string;
  apiKey: string;
  defaultHeaders?: Record<string, string>;
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

  const timeoutSignal = AbortSignal.timeout(25000);
  const combinedSignal = signal && 'any' in AbortSignal ? (AbortSignal as any).any([signal, timeoutSignal]) : (signal || timeoutSignal);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      ...config.defaultHeaders,
    },
    body: JSON.stringify(requestBody),
    signal: combinedSignal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Provider returned ${response.status}: ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body received from provider stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';

  while (true) {
    if (signal?.aborted) {
      reader.cancel();
      throw new Error('Stream cancelled by user');
    }

    const { done, value } = await reader.read();
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

  if (callbacks.onDone) {
    callbacks.onDone();
  }

  return fullText;
}
