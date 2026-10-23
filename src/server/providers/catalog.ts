import { ModelInfo } from '../types';

export const INITIAL_MODELS: ModelInfo[] = [
  // --- Google Gemini Models ---
  {
    id: 'gemini-3.8-flash',
    providerId: 'gemini',
    displayName: 'Gemini 3.8 Flash',
    description: 'Fast, state-of-the-art multimodal model with balanced latency and high reasoning capability.',
    mode: 'balanced',
    isFree: true,
    pricingDescription: 'Zero-cost tier available (Free for standard usage limits)',
    contextWindow: 1048576,
    capabilities: {
      streaming: true,
      vision: true,
      toolCalling: true,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 240,
  },
  {
    id: 'gemini-3.1-flash-lite',
    providerId: 'gemini',
    displayName: 'Gemini 3.1 Flash Lite',
    description: 'Ultra-low latency model engineered for instant throughput, streaming, and light automation.',
    mode: 'efficient',
    isFree: true,
    pricingDescription: 'Zero-cost tier available',
    contextWindow: 1048576,
    capabilities: {
      streaming: true,
      vision: true,
      toolCalling: true,
      reasoning: false,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 120,
  },
  {
    id: 'gemini-3.1-pro-preview',
    providerId: 'gemini',
    displayName: 'Gemini 3.1 Pro',
    description: 'Frontier reasoning model for advanced code synthesis, multi-step math, and complex agentic tasks.',
    mode: 'powerful',
    isFree: false,
    pricingDescription: 'Standard token pricing ($1.25 / 1M prompt tokens)',
    contextWindow: 2097152,
    capabilities: {
      streaming: true,
      vision: true,
      toolCalling: true,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 680,
  },

  // --- OpenRouter Free Models ---
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    providerId: 'openrouter',
    displayName: 'Nemotron 3.5 Lightning (Free)',
    description: 'Fast, high-throughput free model for streaming conversation, coding assistance, and reasoning.',
    mode: 'balanced',
    isFree: true,
    pricingDescription: 'Free tier on OpenRouter',
    contextWindow: 131072,
    capabilities: {
      streaming: true,
      vision: false,
      toolCalling: true,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 310,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    providerId: 'openrouter',
    displayName: 'Llama 3.3 70B Instruct (Free)',
    description: 'Open-weights flagship model with leading instruction following, coding, and mathematical reasoning.',
    mode: 'balanced',
    isFree: true,
    pricingDescription: 'Free tier on OpenRouter',
    contextWindow: 131072,
    capabilities: {
      streaming: true,
      vision: false,
      toolCalling: true,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 410,
  },
  {
    id: 'deepseek/deepseek-r1:free',
    providerId: 'openrouter',
    displayName: 'DeepSeek R1 (Free)',
    description: 'Open reasoning model specialized in step-by-step mathematical reasoning, STEM, and logic puzzles.',
    mode: 'powerful',
    isFree: true,
    pricingDescription: 'Free tier on OpenRouter',
    contextWindow: 65536,
    capabilities: {
      streaming: true,
      vision: false,
      toolCalling: false,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 890,
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct:free',
    providerId: 'openrouter',
    displayName: 'Qwen 2.5 Coder 32B (Free)',
    description: 'Specialized code generation, debugging, refactoring, and AST manipulation model.',
    mode: 'efficient',
    isFree: true,
    pricingDescription: 'Free tier on OpenRouter',
    contextWindow: 32768,
    capabilities: {
      streaming: true,
      vision: false,
      toolCalling: true,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 350,
  },

  // --- Groq High-Speed Models ---
  {
    id: 'groq/llama-3.1-8b-instant',
    providerId: 'groq',
    displayName: 'Llama 3.1 8B Instant (Groq LPU)',
    description: 'Blazing fast LPUs delivering 800+ tokens/sec for rapid conversational turns and summary tasks.',
    mode: 'efficient',
    isFree: true,
    pricingDescription: 'Free developer tier on Groq',
    contextWindow: 131072,
    capabilities: {
      streaming: true,
      vision: false,
      toolCalling: true,
      reasoning: false,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 90,
  },
  {
    id: 'groq/llama-3.3-70b-versatile',
    providerId: 'groq',
    displayName: 'Llama 3.3 70B Versatile (Groq LPU)',
    description: 'Large-scale 70B parameter model running on ultra-fast Groq LPU inference hardware.',
    mode: 'balanced',
    isFree: true,
    pricingDescription: 'Free developer tier on Groq',
    contextWindow: 131072,
    capabilities: {
      streaming: true,
      vision: false,
      toolCalling: true,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 180,
  },

  // --- NVIDIA NIM Models ---
  {
    id: 'nvidia/nemotron-4-340b-instruct',
    providerId: 'nvidia',
    displayName: 'NVIDIA Nemotron-4 340B Instruct',
    description: 'Enterprise-grade 340B parameter synthetic data and reasoning engine hosted on NVIDIA API Catalog.',
    mode: 'powerful',
    isFree: false,
    pricingDescription: 'Free credits on NVIDIA NIM Catalog / Paid tier',
    contextWindow: 4096,
    capabilities: {
      streaming: true,
      vision: false,
      toolCalling: true,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 520,
  },

  // --- Local Ollama Models (100% Free, Private, Offline) ---
  {
    id: 'ollama/qwen2.5-coder',
    providerId: 'ollama',
    displayName: 'Qwen 2.5 Coder (Local Ollama)',
    description: 'State-of-the-art open-source coding model running locally on your hardware with zero API costs.',
    mode: 'balanced',
    isFree: true,
    pricingDescription: '100% Free & Local (Ollama)',
    contextWindow: 32768,
    capabilities: {
      streaming: true,
      vision: false,
      toolCalling: true,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 80,
  },
  {
    id: 'ollama/llama3.3',
    providerId: 'ollama',
    displayName: 'Llama 3.3 70B (Local Ollama)',
    description: 'High-capability local general intelligence and coding assistance running completely offline.',
    mode: 'powerful',
    isFree: true,
    pricingDescription: '100% Free & Local (Ollama)',
    contextWindow: 131072,
    capabilities: {
      streaming: true,
      vision: false,
      toolCalling: true,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 120,
  },
  {
    id: 'ollama/deepseek-r1',
    providerId: 'ollama',
    displayName: 'DeepSeek R1 (Local Ollama)',
    description: 'Frontier open-weights reasoning model running locally on your PC.',
    mode: 'powerful',
    isFree: true,
    pricingDescription: '100% Free & Local (Ollama)',
    contextWindow: 65536,
    capabilities: {
      streaming: true,
      vision: false,
      toolCalling: true,
      reasoning: true,
    },
    availability: 'available',
    lastChecked: new Date().toISOString(),
    latencyMs: 200,
  },
];

class ModelCatalog {
  private models: ModelInfo[] = [...INITIAL_MODELS];

  getModels(): ModelInfo[] {
    return this.models.map((m) => {
      // dynamically evaluate availability based on configured environment keys
      let availability = m.availability;
      if (m.providerId === 'gemini' && !process.env.GEMINI_API_KEY) {
        availability = 'unconfigured';
      } else if (m.providerId === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
        // OpenRouter free models can be flagged if no key
        availability = 'available'; // OpenRouter supports certain public free endpoints or fallbacks
      } else if (m.providerId === 'groq' && !process.env.GROQ_API_KEY) {
        availability = 'unconfigured';
      } else if (m.providerId === 'nvidia' && !process.env.NVIDIA_NIM_API_KEY) {
        availability = 'unconfigured';
      }
      return { ...m, availability };
    });
  }

  getModelById(id: string): ModelInfo | undefined {
    return this.getModels().find((m) => m.id === id);
  }

  getModelsByMode(mode: 'efficient' | 'balanced' | 'powerful'): ModelInfo[] {
    return this.getModels().filter((m) => m.mode === mode);
  }

  getFreeModels(): ModelInfo[] {
    return this.getModels().filter((m) => m.isFree);
  }
}

export const modelCatalog = new ModelCatalog();
