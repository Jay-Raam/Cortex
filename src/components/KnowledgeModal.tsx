import React from 'react';
import { BookOpen, X, FileText, CheckCircle2, Search, ArrowRight, ShieldCheck, Database, Cpu } from 'lucide-react';

interface KnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KnowledgeModal: React.FC<KnowledgeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const topics = [
    {
      title: 'Free-First Model Routing Architecture',
      desc: 'How Cortex balances zero-cost inference across OpenRouter and Gemini before invoking paid tiers.',
      tag: 'Core System',
    },
    {
      title: 'Agentic Co-Work Step Decomposition',
      desc: 'Ordered execution graph, automated tool calling, and human-in-the-loop approval gates.',
      tag: 'Co-Work Engine',
    },
    {
      title: 'Multi-Tenant Data Isolation Guard',
      desc: 'Tenant ID validation ensuring user sessions and conversation histories never leak cross-tenant.',
      tag: 'Security & Auth',
    },
    {
      title: 'Real-Time SSE Streaming Protocols',
      desc: 'Server-Sent Events architecture delivering token-by-token streaming under 200ms latency.',
      tag: 'Network & API',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FFF9F3] border border-[#FFE8D6] flex items-center justify-center text-[#FF6B00]">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Knowledge Base</h2>
              <p className="text-[11px] text-slate-500">Architecture docs, guides, and technical specifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
          {topics.map((t, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-200 hover:border-[#FF6B00]/60 hover:shadow-2xs transition-all bg-white flex items-start justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-900">{t.title}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                    {t.tag}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{t.desc}</p>
              </div>

              <div className="text-xs font-semibold text-[#FF6B00] shrink-0 mt-1 flex items-center gap-1 cursor-pointer">
                <span>Read</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
