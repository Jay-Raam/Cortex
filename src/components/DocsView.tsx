import React from 'react';
import { Layers, Shield, Smartphone, Server, Database, Zap, BookOpen } from 'lucide-react';

export const DocsView: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto space-y-10 bg-[#090d12]">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Cortex AI System Architecture &amp; Operations</h1>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          Production-grade multi-model AI gateway, agentic Co-Work engine, and multi-tenant persistence layer.
        </p>
      </div>

      {/* Architecture Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[#0f1722] border border-[#232f42] rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <Zap className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Multi-Model Gateway</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Routes across Google Gemini 3 series, OpenRouter, Groq LPUs, and NVIDIA NIM. Implements Free-First routing and bounded fallback.
          </p>
        </div>

        <div className="p-4 bg-[#0f1722] border border-[#232f42] rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <Layers className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Agentic Co-Work</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Autonomous multi-step execution with ordered step state machine: planning, running, approval gates, and file artifact production.
          </p>
        </div>

        <div className="p-4 bg-[#0f1722] border border-[#232f42] rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <Shield className="w-4 h-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Security &amp; Privacy</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Strict tenant data isolation, zero private chat persistence in browser local storage, rotating JWT sessions, and server-side secret protection.
          </p>
        </div>
      </div>

      {/* System Architecture Diagram (ASCII / Structured Block) */}
      <div className="p-6 bg-[#0c1219] border border-[#232f42] rounded-xl">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>System Topology &amp; Service Boundaries</span>
        </h3>
        <pre className="p-4 bg-[#070b10] border border-[#1b2636] rounded-lg text-xs font-mono text-emerald-400/90 overflow-x-auto leading-relaxed">
{`+-------------------------------------------------------------------------+
|                 Cortex AI Client Tier (Web & Mobile)                    |
|  - Next.js / React 19 SPA                   - Flutter Android Client   |
|  - SSE Streaming Subscriber                 - Riverpod State & Storage  |
+------------------------------------+------------------------------------+
                                     |
                                     | GraphQL Yoga & SSE (/api/chat/stream)
                                     v
+-------------------------------------------------------------------------+
|                   Cortex AI Express & Yoga Engine                       |
|  - Authentication & Session Rotation       - Bounded Tool Execution     |
|  - Multi-Model Router & Fallback Policy     - Co-Work Step State Machine |
|  - Rate Limiting & Ownership Guard         - Notification Adapter Layer |
+------------------+----------------------------------+-------------------+
                   |                                  |
                   v                                  v
+------------------------------------+   +--------------------------------+
|    AI Provider Adapter Layer       |   |   Canonical Persistence Layer  |
| - Google Gemini 3.8 / 3.1 Pro      |   | - PostgreSQL (User & Messages) |
| - OpenRouter (Zero-Cost Free Tier) |   | - MongoDB (Document Artifacts) |
| - Groq LPU (Sub-200ms Instant)     |   | - Redis (Distributed Caches)   |
| - NVIDIA NIM Catalog               |   |                                |
+------------------------------------+   +--------------------------------+`}
        </pre>
      </div>

      {/* Mobile & Flutter Android Instructions */}
      <div className="p-6 bg-[#0c1219] border border-[#232f42] rounded-xl space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>Flutter Android Client &amp; APK Instructions</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          The repository contains the complete Flutter Android mobile client in <code className="text-emerald-400 font-mono">apps/mobile</code>. Built with Riverpod state management, GoRouter, secure credential storage, and SSE streaming.
        </p>

        <div className="space-y-2 text-xs">
          <div className="font-semibold text-slate-300">1. Run Debug App Locally:</div>
          <pre className="p-3 bg-[#070b10] rounded border border-[#1b2636] font-mono text-slate-300">
cd apps/mobile && flutter pub get && flutter run
          </pre>

          <div className="font-semibold text-slate-300 mt-3">2. Build Signed Release APK:</div>
          <pre className="p-3 bg-[#070b10] rounded border border-[#1b2636] font-mono text-slate-300">
flutter build apk --release --split-per-abi
# Outputs installable APK in: apps/mobile/build/app/outputs/flutter-apk/app-release.apk
          </pre>
        </div>
      </div>

      {/* Deployment & Environment Setup */}
      <div className="p-6 bg-[#0c1219] border border-[#232f42] rounded-xl space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Local Development &amp; Docker Compose</span>
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Local services for PostgreSQL, MongoDB, and Redis can be orchestrated via Docker Compose:
        </p>
        <pre className="p-3 bg-[#070b10] rounded border border-[#1b2636] font-mono text-xs text-slate-300">
docker compose up -d
npm run dev # Starts unified server on port 3000
        </pre>
      </div>
    </div>
  );
};
