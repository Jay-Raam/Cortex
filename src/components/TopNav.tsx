import React from 'react';
import { ChevronDown, MoreHorizontal, Link2, Share2, Sparkles, Layers, Wrench, FileText } from 'lucide-react';
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
}) => {
  return (
    <header className="h-14 px-6 flex items-center justify-between border-b border-[#F0F2F4] bg-white rounded-t-2xl shrink-0 z-10 select-none">
      {/* Left: Model Selector Pill matching "Cognivo Core v1 ⌵" */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenModelModal}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-slate-800 text-sm font-semibold tracking-tight"
          title="Select AI Model & Tier"
        >
          <span>Cognivo Core v1</span>
          <span className="text-[11px] font-normal text-slate-400 font-mono">({selectedModelName.split(' ')[0]})</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>

        {/* Quiet view tabs for Co-Work and Platform features */}
        <div className="hidden lg:flex items-center gap-1 ml-4 pl-4 border-l border-slate-200">
          <button
            onClick={() => onNavigate('chat')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'chat' ? 'text-[#FF6B00] bg-orange-50' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => onNavigate('cowork')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'cowork' ? 'text-[#FF6B00] bg-orange-50' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Co-Work</span>
          </button>
          <button
            onClick={() => onNavigate('skills')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'skills' ? 'text-[#FF6B00] bg-orange-50' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Skills</span>
          </button>
          <button
            onClick={() => onNavigate('docs')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'docs' ? 'text-[#FF6B00] bg-orange-50' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Docs</span>
          </button>
        </div>
      </div>

      {/* Right Controls: ••• | 🔗 | ↗ Share */}
      <div className="flex items-center gap-2">
        {/* More options button */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Command Menu / Shortcuts (Ctrl+K)"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Copy Link button */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
          }}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Copy Link to Clipboard"
        >
          <Link2 className="w-4 h-4" />
        </button>

        {/* Share Button Pill */}
        <button
          onClick={onOpenNotifications}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-slate-600" />
          <span>Share</span>
        </button>
      </div>
    </header>
  );
};
