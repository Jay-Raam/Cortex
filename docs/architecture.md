# Nexa AI Architecture Overview

Nexa AI is a next-generation multi-model AI chat & Co-Work platform engineered for real-time streaming inference, dynamic model routing with zero-cost prioritization, persistent multi-tenant chat history, autonomous agentic workspaces, and cross-platform clients (React Web & Flutter Android).

## 1. System Topology (Mermaid)

```mermaid
graph TD
    subgraph Clients["Client Tier"]
        Web["Next.js / React 19 Web SPA"]
        Mobile["Flutter Android Mobile App"]
    end

    subgraph Gateway["Application & API Gateway"]
        Express["Express.js Server (Port 3000)"]
        Yoga["GraphQL Yoga Domain API (/graphql)"]
        SSE["SSE Token Streaming Engine (/api/chat/stream)"]
        CoworkAPI["Co-Work Task Advancement API (/api/cowork)"]
    end

    subgraph RoutingEngine["Multi-Model Router & Gateway"]
        Router["Model Router (Free-First Policy)"]
        Catalog["Normalized Model Catalog"]
        CircuitBreaker["Circuit Breaker & Fallback Manager"]
    end

    subgraph Providers["External AI Inference Providers"]
        Gemini["Google Gemini 3.8 / 3.1 Pro"]
        OpenRouter["OpenRouter (Free Tier Models)"]
        Groq["Groq LPU (Sub-200ms Instant)"]
        Nvidia["NVIDIA NIM Catalog"]
    end

    subgraph CoworkEngine["Agentic Co-Work Subsystem"]
        Planner["Step Decomposition Planner"]
        StateMachine["Task State Machine (queued->planning->running->awaiting_approval->completed)"]
        ToolRegistry["Bounded Tool Execution Sandbox"]
    end

    subgraph Storage["Canonical Persistence Layer"]
        PG["PostgreSQL (Users, Sessions, Conversations, Messages)"]
        Mongo["MongoDB (Extensible Document Artifacts)"]
        Redis["Redis (Cache, Rate Limits & Job Locks)"]
    end

    Clients -->|GraphQL & SSE| Express
    Express --> Yoga
    Express --> SSE
    Express --> CoworkAPI

    SSE --> Router
    Router --> Catalog
    Router --> CircuitBreaker
    CircuitBreaker --> Gemini
    CircuitBreaker --> OpenRouter
    CircuitBreaker --> Groq
    CircuitBreaker --> Nvidia

    CoworkAPI --> CoworkEngine
    CoworkEngine --> ToolRegistry
    ToolRegistry --> Storage
    Yoga --> Storage
```

## 2. Model Routing Policies

- **Efficient Mode**: Prioritizes sub-second latency and minimal token consumption for quick Q&A and text summarization (`gemini-3.1-flash-lite`, `groq/llama-3.1-8b-instant`).
- **Balanced Mode**: Provides optimal balance between STEM comprehension, code synthesis, and speed (`gemini-3.8-flash`, `meta-llama/llama-3.3-70b-instruct:free`).
- **Powerful Mode**: Frontier deep reflection models for multi-step algorithmic planning, mathematical reasoning, and full-stack software refactoring (`gemini-3.1-pro-preview`, `deepseek/deepseek-r1:free`).
- **Free-First Guarantee**: Zero-cost models are prioritized. The platform never silently escalates from a free tier to a paid token bill without explicit user confirmation.
