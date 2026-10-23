import React, { useState } from 'react';
import { isDesktopApp } from '../lib/platform';
import {
  ChevronDown,
  MoreHorizontal,
  Link2,
  Share2,
  Layers,
  Wrench,
  FileText,
  Menu,
  Check,
  Radio,
  Swords,
} from 'lucide-react';
import { ModelMode } from '../server/types';

interface TopNavProps {
  currentView: 'chat' | 'cowork' | 'skills' | 'docs' | 'arena';
  onNavigate: (view: 'chat' | 'cowork' | 'skills' | 'docs' | 'arena') => void;
  selectedModelName: string;
  selectedMode: ModelMode;
  onOpenModelModal: () => void;
  onOpenNotifications: () => void;
  onOpenShortcuts: () => void;
  onOpenShareModal: () => void;
  onOpenVoiceMode?: () => void;
  onToggleSidebar?: () => void;
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
  onOpenShareModal,
  onOpenVoiceMode,
  onToggleSidebar,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error('Failed to copy link:', e);
    }
  };

  return (
    <header className="h-14 px-3 sm:px-4 md:px-6 flex items-center justify-between border-b border-[#F0F2F4] bg-white shrink-0 z-10 select-none">
      {/* Left: Mobile hamburger + Model Selector Pill matching "Cortex Core v1 ⌵" */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpenModelModal}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-slate-800 text-xs sm:text-sm font-semibold tracking-tight truncate"
          title="Select AI Model & Tier"
        >
          <span className="truncate">Cortex Core v1</span>
          <span className="text-[11px] font-normal text-slate-400 font-mono hidden sm:inline">
            ({selectedModelName.split(' ')[0]})
          </span>
          <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
        </button>

        {/* Claude Style [ Chat | Cowork ] Pill Toggle */}
        <div className="flex items-center bg-[#F4F1EA] p-0.5 rounded-xl border border-[#E5E0D8] shadow-2xs ml-2 sm:ml-4">
          <button
            onClick={() => onNavigate('chat')}
            className={`px-3.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentView === 'chat'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => onNavigate('arena')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentView === 'arena'
                ? 'bg-white text-[#EA580C] shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Swords className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>Arena</span>
          </button>

          {isDesktopApp() && (
            <button
              onClick={() => onNavigate('cowork')}
              className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'cowork'
                  ? 'bg-white text-[#EA580C] shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Cowork</span>
            </button>
          )}
        </div>

        {/* Secondary feature tabs */}
        <div className="hidden xl:flex items-center gap-1 ml-2">
          <button
            onClick={() => onNavigate('skills')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'skills' ? 'text-[#EA580C] bg-orange-50 font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Skills</span>
          </button>
          <button
            onClick={() => onNavigate('docs')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'docs' ? 'text-[#EA580C] bg-orange-50 font-semibold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Docs</span>
          </button>
        </div>
      </div>

      {/* Right Controls: ••• | 🔗 | ↗ Share */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* More options button */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Command Menu / Shortcuts (Ctrl+K)"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {/* Copy Link button with live copied feedback tooltip/icon */}
        <button
          onClick={handleCopyLink}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer relative ${
            copiedLink
              ? 'text-emerald-600 bg-emerald-50'
              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
          }`}
          title={copiedLink ? 'Link Copied!' : 'Copy Link to Clipboard'}
        >
          {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4" />}
        </button>

        {/* Live Voice Mode Button */}
        {onOpenVoiceMode && (
          <button
            onClick={onOpenVoiceMode}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-orange-200 bg-orange-50/70 hover:bg-orange-100/70 text-xs font-semibold text-[#FF6B00] shadow-2xs transition-all cursor-pointer"
            title="Live Voice Conversation Mode (Ctrl+Shift+V)"
          >
            <Radio className="w-3.5 h-3.5 text-[#FF6B00] animate-pulse" />
            <span className="hidden sm:inline">Voice</span>
          </button>
        )}

        {/* Share Button Pill */}
        <button
          onClick={onOpenShareModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-slate-600" />
          <span className="hidden xs:inline">Share</span>
        </button>
      </div>
    </header>
  );
};
