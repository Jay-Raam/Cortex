import React from 'react';
import { LayoutGrid, X, FileText, Code2, Sparkles, ArrowRight, MessageSquareText } from 'lucide-react';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({ isOpen, onClose, onSelectPrompt }) => {
  if (!isOpen) return null;

  const templates = [
    {
      title: 'Code Refactoring & Clean Architecture',
      desc: 'Analyze codebase for code smells, tight coupling, and refactor using clean SOLID principles.',
      prompt: 'Review and refactor the following code block for readability, performance, and best practices:\n\n',
      badge: 'Engineering',
    },
    {
      title: 'System Design Spec Generator',
      desc: 'Generate comprehensive system design architecture documents with components and API specs.',
      prompt: 'Draft an end-to-end System Design Specification for a high-throughput real-time service:\n\n',
      badge: 'Architecture',
    },
    {
      title: 'Executive Meeting & Text Summary',
      desc: 'Convert meeting transcripts or dense technical articles into bullet summaries with action items.',
      prompt: 'Summarize the following document into executive takeaways, risks, and next steps:\n\n',
      badge: 'Productivity',
    },
    {
      title: 'Test Suite & Edge Case Generator',
      desc: 'Generate unit tests, boundary conditions, and mock fixtures for high test coverage.',
      prompt: 'Generate exhaustive unit tests covering happy path and edge cases for:\n\n',
      badge: 'Testing',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FFF9F3] border border-[#FFE8D6] flex items-center justify-center text-[#FF6B00]">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Prompt &amp; Workflow Templates</h2>
              <p className="text-[11px] text-slate-500">Pre-built engineering, architecture, and writing templates</p>
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
          {templates.map((tpl, idx) => (
            <div
              key={idx}
              onClick={() => {
                onSelectPrompt(tpl.prompt);
                onClose();
              }}
              className="p-4 rounded-xl border border-slate-200 hover:border-[#FF6B00]/60 hover:shadow-2xs transition-all bg-white cursor-pointer group flex items-start justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-900 group-hover:text-[#FF6B00] transition-colors">
                    {tpl.title}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-[#FF6B00] border border-orange-100">
                    {tpl.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{tpl.desc}</p>
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
