import React, { useState } from 'react';
import {
  Terminal,
  ShieldCheck,
  Search,
  FileText,
  BarChart2,
  BookOpen,
  Bug,
  Calendar,
  Check,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { Skill } from '../server/types';

interface SkillsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  skills: Skill[];
  activeSkillId: string | null;
  onSelectSkill: (skillId: string | null) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Terminal: <Terminal className="w-4 h-4 text-[#FF6B00]" />,
  ShieldCheck: <ShieldCheck className="w-4 h-4 text-[#FF6B00]" />,
  Search: <Search className="w-4 h-4 text-[#FF6B00]" />,
  FileText: <FileText className="w-4 h-4 text-[#FF6B00]" />,
  BarChart2: <BarChart2 className="w-4 h-4 text-[#FF6B00]" />,
  BookOpen: <BookOpen className="w-4 h-4 text-[#FF6B00]" />,
  Bug: <Bug className="w-4 h-4 text-[#FF6B00]" />,
  Calendar: <Calendar className="w-4 h-4 text-[#FF6B00]" />,
};

export const SkillsDrawer: React.FC<SkillsDrawerProps> = ({
  isOpen,
  onClose,
  skills,
  activeSkillId,
  onSelectSkill,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = ['all', 'engineering', 'analysis', 'research', 'writing', 'productivity'];

  const filtered = skills.filter((s) => {
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Skills &amp; Agent Workflows</h2>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              <span>Domain-Specific Personas</span>
              <span aria-hidden="true">·</span>
              <span>Constrained Tool Allowlists</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#FF6B00] font-medium">Zod-Validated Schemas</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-3 px-6 py-2.5 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#FF6B00] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {activeSkillId && (
            <button
              onClick={() => onSelectSkill(null)}
              className="text-xs text-[#FF6B00] hover:underline shrink-0 font-medium"
            >
              Clear Active Skill
            </button>
          )}
        </div>

        {/* Skills Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
          {filtered.map((skill) => {
            const isActive = skill.id === activeSkillId;
            return (
              <div
                key={skill.id}
                onClick={() => onSelectSkill(isActive ? null : skill.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#FFF9F3] border-[#FF6B00] shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        isActive
                          ? 'bg-[#FFE8D6] text-[#FF6B00] border border-[#FF6B00]/30'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {ICON_MAP[skill.icon] || <Sparkles className="w-4 h-4 text-[#FF6B00]" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900">{skill.name}</h3>
                        <span className="text-[10px] text-slate-400 font-mono">v{skill.version}</span>
                        <span className="text-[10px] text-[#FF6B00] font-mono font-medium">({skill.category})</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{skill.description}</p>
                    </div>
                  </div>

                  <div className="shrink-0 mt-1">
                    {isActive ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-[#FF6B00]">
                        <Check className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 hover:text-slate-700">
                        Activate
                      </span>
                    )}
                  </div>
                </div>

                {/* Allowed Tools */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
                  <Wrench className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-400">Allowed Tools:</span>
                  <div className="flex flex-wrap gap-1">
                    {skill.allowedTools.map((t) => (
                      <span key={t} className="font-mono text-slate-700 px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Active Skill:{' '}
            <span className="text-slate-900 font-bold">
              {skills.find((s) => s.id === activeSkillId)?.name || 'None (Standard Assistant)'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#FF6B00] hover:bg-[#E86000] rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
