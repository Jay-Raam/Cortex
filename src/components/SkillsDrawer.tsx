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
  Terminal: <Terminal className="w-5 h-5" />,
  ShieldCheck: <ShieldCheck className="w-5 h-5" />,
  Search: <Search className="w-5 h-5" />,
  FileText: <FileText className="w-5 h-5" />,
  BarChart2: <BarChart2 className="w-5 h-5" />,
  BookOpen: <BookOpen className="w-5 h-5" />,
  Bug: <Bug className="w-5 h-5" />,
  Calendar: <Calendar className="w-5 h-5" />,
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
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#0f1722] border border-[#232f42] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232f42]">
          <div>
            <h2 className="text-base font-semibold text-white">Skills &amp; Agent Workflows</h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <span>Domain-Specific Personas</span>
              <span aria-hidden="true">·</span>
              <span>Constrained Tool Allowlists</span>
              <span aria-hidden="true">·</span>
              <span>Zod-Validated Schemas</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#1a2533] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between gap-3 px-6 py-2.5 bg-[#0a0f16] border-b border-[#232f42]">
          <div className="flex items-center gap-1 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {activeSkillId && (
            <button
              onClick={() => onSelectSkill(null)}
              className="text-xs text-amber-400 hover:underline shrink-0"
            >
              Clear Active Skill
            </button>
          )}
        </div>

        {/* Skills Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filtered.map((skill) => {
            const isActive = skill.id === activeSkillId;
            return (
              <div
                key={skill.id}
                onClick={() => onSelectSkill(isActive ? null : skill.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#111e17] border-emerald-500/60 shadow-md'
                    : 'bg-[#121a24] border-[#222f42] hover:border-[#32435b] hover:bg-[#15202c]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-lg shrink-0 ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-[#1a2535] text-slate-300 border border-[#2b3a4f]'
                      }`}
                    >
                      {ICON_MAP[skill.icon] || <Sparkles className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{skill.name}</h3>
                        <span className="text-[10px] text-slate-500 font-mono">v{skill.version}</span>
                        <span className="text-[10px] text-emerald-400/80 font-mono">({skill.category})</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{skill.description}</p>
                    </div>
                  </div>

                  <div className="shrink-0 mt-1">
                    {isActive ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                        <Check className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-500 hover:text-slate-300">
                        Activate
                      </span>
                    )}
                  </div>
                </div>

                {/* Allowed Tools */}
                <div className="mt-3 pt-2.5 border-t border-[#1d293a] flex items-center gap-2 text-[11px] text-slate-500">
                  <Wrench className="w-3 h-3 text-slate-400" />
                  <span>Allowed Tools:</span>
                  <div className="flex flex-wrap gap-1">
                    {skill.allowedTools.map((t) => (
                      <span key={t} className="font-mono text-slate-300">
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
        <div className="flex items-center justify-between px-6 py-3 bg-[#0a0f16] border-t border-[#232f42] text-xs text-slate-400">
          <div>
            Active Skill:{' '}
            <span className="text-white font-medium">
              {skills.find((s) => s.id === activeSkillId)?.name || 'None (Standard Assistant)'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
