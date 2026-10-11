import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the server environment.');
    }
    if (!apiKey.startsWith('AIzaSy')) {
      throw new Error('GEMINI_API_KEY is invalid (Google Gemini API keys start with AIzaSy).');
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onUsage?: (usage: { promptTokens?: number; completionTokens?: number }) => void;
  onError?: (err: Error) => void;
  onDone?: () => void;
}

export async function streamGeminiResponse(
  modelId: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemInstruction: string | undefined,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const ai = getGeminiClient();

  // Map messages to format expected by GoogleGenAI
  const contents = messages.map((m) => {
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    };
  });

  const config: Record<string, any> = {};
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  // Model selection check - ensure valid Gemini 3 model
  const validModel = modelId.startsWith('gemini-') ? modelId : 'gemini-3.8-flash';

  const responseStream = await ai.models.generateContentStream({
    model: validModel,
    contents,
    config,
  });

  let fullText = '';
  for await (const chunk of responseStream) {
    if (signal?.aborted) {
      throw new Error('Request aborted by user');
    }
    const textDelta = chunk.text;
    if (textDelta) {
      fullText += textDelta;
      callbacks.onDelta(textDelta);
    }
  }

  if (callbacks.onDone) {
    callbacks.onDone();
  }

  return fullText;
}

export async function generateGeminiContent(
  modelId: string,
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const ai = getGeminiClient();
  const validModel = modelId.startsWith('gemini-') ? modelId : 'gemini-3.8-flash';

  const response = await ai.models.generateContent({
    model: validModel,
    contents: prompt,
    config: systemInstruction ? { systemInstruction } : undefined,
  });

  return response.text || '';
}
