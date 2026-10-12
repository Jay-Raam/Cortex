import React from 'react';
import { Globe, X, Sparkles, Compass, ArrowRight, BookOpen, Layers, Bot } from 'lucide-react';

interface ExploreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

export const ExploreModal: React.FC<ExploreModalProps> = ({ isOpen, onClose, onSelectPrompt }) => {
  if (!isOpen) return null;

  const features = [
    {
      title: 'Autonomous Co-Work Engine',
      desc: 'Plan, execute, and verify complex multi-step technical workflows with approval gates.',
      category: 'Agentic Workflows',
      prompt: 'Help me plan and scaffold a complete full-stack web feature with automated tests.',
    },
    {
      title: 'Multi-Model Intelligent Routing',
      desc: 'Switch between Gemini 3.8, OpenRouter free models, and Groq LPUs based on cost and latency.',
      category: 'Inference',
      prompt: 'Compare the performance tradeoffs between sub-second LPUs and deep reasoning models.',
    },
    {
      title: 'Domain Persona Skills',
      desc: 'Activate specialized personas for Engineering, Analysis, Research, Writing, and Productivity.',
      category: 'Specialization',
      prompt: 'Act as a Senior Principal Software Architect and critique my current system architecture.',
    },
    {
      title: 'Deeper Research Mode',
      desc: 'Synthesize across technical documentation, benchmark matrices, and structured data sources.',
      category: 'Deep Analysis',
      prompt: 'Conduct a deep research overview into modern zero-cost AI model routing architectures.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FFF9F3] border border-[#FFE8D6] flex items-center justify-center text-[#FF6B00]">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Explore Cortex AI</h2>
              <p className="text-[11px] text-slate-500">Discover platform capabilities, agentic tools, and workflows</p>
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
          {features.map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                onSelectPrompt(item.prompt);
                onClose();
              }}
              className="p-4 rounded-xl border border-slate-200 hover:border-[#FF6B00]/60 hover:shadow-2xs transition-all bg-white cursor-pointer group flex items-start justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors">
                    {item.title}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-[#FF6B00] border border-orange-100">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-[#FFF9F3] text-slate-400 group-hover:text-[#FF6B00] transition-colors shrink-0 mt-1">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
