import React from 'react';
import { Code2, ShieldCheck, Bug, Sparkles, Database, Layers } from 'lucide-react';

export interface PromptTemplate {
  id: string;
  title: string;
  icon: React.ReactNode;
  category: string;
  prompt: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'code-review',
    title: 'Code Review',
    icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
    category: 'Engineering',
    prompt: 'Review the following code for security vulnerabilities, edge cases, and performance bottlenecks:\n\n```\n// paste code here\n```',
  },
  {
    id: 'architecture',
    title: 'System Design',
    icon: <Layers className="w-3.5 h-3.5 text-blue-400" />,
    category: 'Architecture',
    prompt: 'Design a scalable, highly available system architecture for the following requirements:\n- Goal:\n- Estimated traffic:\n- Key constraints:',
  },
  {
    id: 'debug',
    title: 'Debug Error',
    icon: <Bug className="w-3.5 h-3.5 text-amber-400" />,
    category: 'Debugging',
    prompt: 'Help me debug this issue. Here is the error traceback, expected behavior, and relevant code snippet:\n\nError:\nExpected:\nSnippet:',
  },
  {
    id: 'refactor',
    title: 'Refactor Code',
    icon: <Code2 className="w-3.5 h-3.5 text-purple-400" />,
    category: 'Quality',
    prompt: 'Refactor this code following clean code principles, strict TypeScript types, and high testability:\n\n```\n// paste code here\n```',
  },
  {
    id: 'sql-optimize',
    title: 'SQL Optimizer',
    icon: <Database className="w-3.5 h-3.5 text-cyan-400" />,
    category: 'Database',
    prompt: 'Analyze this SQL query and table indexes to minimize scan overhead and optimize execution plans:\n\n```sql\n-- paste query here\n```',
  },
];

interface PromptTemplatesProps {
  onSelectTemplate: (prompt: string) => void;
  onOpenTemplatesModal?: () => void;
}

export const PromptTemplates: React.FC<PromptTemplatesProps> = ({ onSelectTemplate, onOpenTemplatesModal }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1 px-4 mb-2 no-scrollbar text-xs">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium shrink-0">
        <Sparkles className="w-3 h-3 text-emerald-400" />
        <span>Templates:</span>
      </div>
      {PROMPT_TEMPLATES.map((tmpl) => (
        <button
          key={tmpl.id}
          type="button"
          onClick={() => onSelectTemplate(tmpl.prompt)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#111823] hover:bg-[#192435] border border-[#233145] hover:border-emerald-500/50 text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer shadow-sm text-[11px]"
        >
          {tmpl.icon}
          <span>{tmpl.title}</span>
        </button>
      ))}
      {onOpenTemplatesModal && (
        <button
          type="button"
          onClick={onOpenTemplatesModal}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 transition-all shrink-0 cursor-pointer shadow-sm text-[11px]"
        >
          <Sparkles className="w-3 h-3" />
          <span>More Personas...</span>
        </button>
      )}
    </div>
  );
};
