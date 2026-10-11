import React from 'react';
import { Bell, User, Zap, Sparkles } from 'lucide-react';
import { ModelMode } from '../server/types';

interface TopNavProps {
  currentView: 'chat' | 'cowork' | 'skills' | 'docs';
  onNavigate: (view: 'chat' | 'cowork' | 'skills' | 'docs') => void;
  selectedModelName: string;
  selectedMode: ModelMode;
  onOpenModelModal: () => void;
  onOpenNotifications: () => void;
  onOpenShortcuts: () => void;
  unreadNotificationsCount: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentView,
  onNavigate,
  selectedModelName,
  selectedMode,
  onOpenModelModal,
  onOpenNotifications,
  onOpenShortcuts,
  unreadNotificationsCount,
}) => {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <header className="h-14 border-b border-[#1d2737] bg-[#090d12]/95 backdrop-blur-md px-5 flex items-center justify-between gap-8 shrink-0 z-30">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('chat');
          }}
          className="text-base font-bold tracking-tight text-white hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <div className="w-5 h-5 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-mono text-xs font-bold">
            C
          </div>
          <span>Cortex</span>
        </a>

        {/* Quiet Model Indicator Button */}
        <button
          onClick={onOpenModelModal}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 bg-[#121a24] hover:bg-[#182330] border border-[#232f42] rounded-md transition-colors cursor-pointer"
          title={`Open Model Catalog & Routing (${modKey}+M)`}
        >
          <Zap className="w-3 h-3 text-emerald-400" />
          <span className="font-medium text-white max-w-[140px] truncate">{selectedModelName}</span>
          <span className="text-slate-500 font-mono text-[11px]">({selectedMode})</span>
        </button>
      </div>

      {/* Zone 2: 4-5 clean single-line text navigation links with shortcut hints */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
        <button
          onClick={() => onNavigate('chat')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentView === 'chat' ? 'text-emerald-400 font-semibold' : ''
          }`}
          title={`Chat View (${modKey}+1)`}
        >
          <span>Chat</span>
          <span className="text-[10px] font-mono text-slate-600 group-hover:text-slate-400">1</span>
        </button>
        <button
          onClick={() => onNavigate('cowork')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentView === 'cowork' ? 'text-emerald-400 font-semibold' : ''
          }`}
          title={`Co-Work Workspace (${modKey}+2)`}
        >
          <span>Co-Work</span>
          <span className="text-[10px] font-mono text-slate-600 group-hover:text-slate-400">2</span>
        </button>
        <button
          onClick={() => onNavigate('skills')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentView === 'skills' ? 'text-emerald-400 font-semibold' : ''
          }`}
          title={`Skills & Personas (${modKey}+3)`}
        >
          <span>Skills</span>
          <span className="text-[10px] font-mono text-slate-600 group-hover:text-slate-400">3</span>
        </button>
        <button
          onClick={onOpenModelModal}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
          title={`Model Catalog (${modKey}+M)`}
        >
          <span>Model Router</span>
        </button>
        <button
          onClick={() => onNavigate('docs')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
            currentView === 'docs' ? 'text-emerald-400 font-semibold' : ''
          }`}
          title={`Architecture Docs (${modKey}+4)`}
        >
          <span>Architecture</span>
          <span className="text-[10px] font-mono text-slate-600 group-hover:text-slate-400">4</span>
        </button>
      </nav>

      {/* Zone 3: 1 primary action zone */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Command palette / Shortcuts trigger button */}
        <button
          onClick={onOpenShortcuts}
          className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-white bg-[#121a24] hover:bg-[#182330] border border-[#232f42] rounded-md transition-colors cursor-pointer"
          title={`Shortcuts & Command Palette (${modKey}+K)`}
        >
          <span className="text-[11px] font-medium">Shortcuts</span>
          <kbd className="px-1 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-[#090d12] rounded border border-[#212f42]">
            {modKey}+K
          </kbd>
        </button>

        <button
          onClick={onOpenNotifications}
          className="relative p-2 text-slate-400 hover:text-white bg-[#121a24] hover:bg-[#182330] border border-[#232f42] rounded-md transition-colors cursor-pointer"
          title="Notifications Center"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 text-[9px] font-bold text-black rounded-full flex items-center justify-center">
              {unreadNotificationsCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 px-2.5 py-1 text-xs text-slate-300 bg-[#121a24] border border-[#232f42] rounded-md">
          <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
            A
          </div>
          <span className="hidden sm:inline font-medium">Architect</span>
        </div>
      </div>
    </header>
  );
};
