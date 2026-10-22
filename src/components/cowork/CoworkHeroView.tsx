import React from 'react';
import {
  Sparkles,
  FileText,
  BarChart3,
  Monitor,
  Sunrise,
  Folder,
  MessageSquare,
  Plus,
  ShieldAlert,
  Zap,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { CoworkHeroViewProps } from './types';

export const CoworkHeroView: React.FC<CoworkHeroViewProps> = ({
  workspace,
  inlinePrompt,
  setInlinePrompt,
  isInlineSubmitting,
  onInlinePromptSubmit,
  isExplorerOpen,
  setIsExplorerOpen,
  contextPreference,
  contextBudget,
  onChangeContextPreference,
  onUpdatePermissionMode,
  selectedModelId,
  setSelectedModelId,
  onToggleTasks,
  tasksCount = 0,
}) => {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 max-w-2xl mx-auto w-full my-auto animate-in fade-in duration-200">
      {/* Terracotta Star Emblem & Serif Headline */}
      <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#EA580C] mb-4 shadow-xs">
          <Sparkles className="w-6 h-6 fill-current" />
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-slate-800 tracking-tight text-center leading-snug">
          Let's knock something off your list
        </h2>
      </div>

      {/* 6 Action Cards Grid (2 rows x 3 columns) */}
      <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6 sm:mb-8">
        <button
          type="button"
          onClick={() => setInlinePrompt('Create a new file in workspace: ')}
          className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
        >
          <FileText className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
          <span className="text-xs font-semibold text-slate-800 block">Create a file</span>
        </button>

        <button
          type="button"
          onClick={() => setInlinePrompt('Analyze codebase metrics, dependencies, and performance: ')}
          className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
        >
          <BarChart3 className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
          <span className="text-xs font-semibold text-slate-800 block">Crunch data</span>
        </button>

        <button
          type="button"
          onClick={() => setInlinePrompt('Implement a working prototype for: ')}
          className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
        >
          <Monitor className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
          <span className="text-xs font-semibold text-slate-800 block">Make a prototype</span>
        </button>

        <button
          type="button"
          onClick={() => setInlinePrompt('Summarize project health, open git changes, and run tests: ')}
          className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
        >
          <Sunrise className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
          <span className="text-xs font-semibold text-slate-800 block">Prep for the day</span>
        </button>

        <button
          type="button"
          onClick={() => setInlinePrompt('Refactor and clean up repository directory structure: ')}
          className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
        >
          <Folder className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
          <span className="text-xs font-semibold text-slate-800 block">Organize files</span>
        </button>

        <button
          type="button"
          onClick={() => setInlinePrompt('Run test suite and verify changes: ')}
          className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
        >
          <MessageSquare className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
          <span className="text-xs font-semibold text-slate-800 block">Send a message</span>
        </button>
      </div>

      {/* Floating Bottom Prompt Composer */}
      <div className="w-full">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onInlinePromptSubmit();
          }}
          className="bg-white rounded-2xl border border-[#E5E0D8] focus-within:border-[#EA580C] p-3 shadow-md transition-all flex flex-col gap-2.5"
        >
          <textarea
            value={inlinePrompt}
            onChange={(e) => setInlinePrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onInlinePromptSubmit();
              }
            }}
            rows={2}
            placeholder="Type a task here or use / for more tools"
            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none px-1 leading-relaxed"
          />
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
            <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setIsExplorerOpen(!isExplorerOpen)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                title="Attach file / browse workspace"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* AI Model Selector Pill */}
              <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-[#E5E0D8] px-2.5 py-1 rounded-lg text-xs transition-colors shadow-2xs shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-none cursor-pointer"
                  title="Select AI Model"
                >
                  <option value="gemini-3.8-flash">Gemini 3.8 Flash (Free)</option>
                  <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (Free)</option>
                  <option value="nvidia/llama-3.1-nemotron-70b-instruct:free">Nemotron 70B (Free)</option>
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                </select>
              </div>

              {/* Mode Selector Pill in Prompt Composer */}
              <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-[#E5E0D8] px-2.5 py-1 rounded-lg text-xs transition-colors shadow-2xs shrink-0">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={workspace?.permissionMode || 'approve_plan'}
                  onChange={(e) => onUpdatePermissionMode(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="approve_plan">Mode B: Approve Plan</option>
                  <option value="ask_every_change">Mode A: Ask Each Change</option>
                  <option value="session_edit">Mode C: Session Edit</option>
                </select>
              </div>

              {/* Context Window Selector Pill in Prompt Composer */}
              <div
                className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-[#E5E0D8] px-2.5 py-1 rounded-lg text-xs transition-colors shadow-2xs shrink-0"
                title={contextBudget ? `Effective limit: ${(contextBudget.effectiveLimit / 1024).toFixed(0)}K · Remaining: ${(contextBudget.remainingTokens / 1024).toFixed(1)}K` : undefined}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <select
                  value={contextPreference}
                  onChange={(e) => onChangeContextPreference(e.target.value)}
                  className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="auto">Auto (1M)</option>
                  <option value="32k">32K Tokens</option>
                  <option value="64k">64K Tokens</option>
                  <option value="128k">128K Tokens</option>
                  <option value="200k">200K Tokens</option>
                  <option value="500k">500K Tokens</option>
                  <option value="1m">1M Tokens</option>
                </select>
                {contextBudget && (
                  <span className="text-[10px] font-mono text-slate-500 border-l border-[#E5E0D8] pl-1.5 shrink-0">
                    {contextBudget.utilizationPercent}%
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isInlineSubmitting || !inlinePrompt.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-40 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
            >
              {isInlineSubmitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Start</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
