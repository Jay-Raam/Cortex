import React from 'react';
import { Layers, Shield, Smartphone, Server, Zap } from 'lucide-react';

export const DocsView: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto space-y-10 bg-white font-sans">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cortex AI System Architecture &amp; Operations</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Production-grade multi-model AI gateway, agentic Co-Work engine, and multi-tenant persistence layer.
        </p>
      </div>

      {/* Architecture Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xs hover:border-[#FF6B00]/40 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-[#FF6B00]">
            <Zap className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Multi-Model Gateway</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Routes across Google Gemini 3 series, OpenRouter, Groq LPUs, and NVIDIA NIM. Implements Free-First routing and bounded fallback.
          </p>
        </div>

        <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xs hover:border-[#FF6B00]/40 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-[#FF6B00]">
            <Layers className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Agentic Co-Work</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Autonomous multi-step execution with ordered step state machine: planning, running, approval gates, and file artifact production.
          </p>
        </div>

        <div className="p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xs hover:border-[#FF6B00]/40 transition-colors">
          <div className="flex items-center gap-2 mb-2 text-[#FF6B00]">
            <Shield className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Security &amp; Privacy</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Strict tenant data isolation, zero private chat persistence in browser local storage, rotating JWT sessions, and server-side secret protection.
          </p>
        </div>
      </div>

      {/* System Architecture Diagram (ASCII / Structured Block) */}
      <div className="p-6 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Server className="w-4 h-4 text-[#FF6B00]" />
          <span>System Topology &amp; Service Boundaries</span>
        </h3>
        <pre className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 overflow-x-auto leading-relaxed">
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
      <div className="p-6 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#FF6B00]" />
          <span>Flutter Android Client &amp; APK Instructions</span>
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          The repository contains the complete Flutter Android mobile client in <code className="text-[#FF6B00] font-mono">apps/mobile</code>. Built with Riverpod state management, GoRouter, secure credential storage, and SSE streaming.
        </p>

        <div className="space-y-2 text-xs">
          <div className="font-semibold text-slate-700">1. Run Debug App Locally:</div>
          <pre className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-slate-700">
cd apps/mobile && flutter pub get && flutter run
          </pre>

          <div className="font-semibold text-slate-700 mt-3">2. Build Signed Release APK:</div>
          <pre className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-slate-700">
flutter build apk --release --split-per-abi
# Outputs installable APK in: apps/mobile/build/app/outputs/flutter-apk/app-release.apk
          </pre>
        </div>
      </div>
    </div>
  );
};
