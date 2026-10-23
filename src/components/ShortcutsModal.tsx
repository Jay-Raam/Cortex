import React from 'react';
import { Command, MessageSquare, Briefcase, Sparkles, BookOpen, Plus, Zap, PanelLeft, XCircle, X, Radio, Swords } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: 'chat' | 'cowork' | 'skills' | 'docs' | 'new_chat' | 'models' | 'toggle_sidebar' | 'voice' | 'arena') => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose, onAction }) => {
  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const viewShortcuts = [
    { key: `${modKey}+1`, label: 'Chat View', desc: 'Switch to multi-model streaming chat', icon: <MessageSquare className="w-4 h-4 text-[#FF6B00]" />, action: () => onAction('chat') },
    { key: `${modKey}+2`, label: 'Co-Work Workspace', desc: 'Switch to agentic task planner', icon: <Briefcase className="w-4 h-4 text-[#FF6B00]" />, action: () => onAction('cowork') },
    { key: `${modKey}+3`, label: 'Skills & Personas', desc: 'Browse domain workflows', icon: <Sparkles className="w-4 h-4 text-[#FF6B00]" />, action: () => onAction('skills') },
    { key: `${modKey}+4`, label: 'Architecture & Docs', desc: 'System topology & guides', icon: <BookOpen className="w-4 h-4 text-[#FF6B00]" />, action: () => onAction('docs') },
    { key: `${modKey}+5`, label: 'Model Arena', desc: 'Dual-model concurrent streaming battle & comparison', icon: <Swords className="w-4 h-4 text-[#FF6B00]" />, action: () => onAction('arena') },
  ];

  const actionShortcuts = [
    { key: `${modKey}+N`, label: 'New Chat', desc: 'Start a fresh conversation thread', icon: <Plus className="w-4 h-4 text-[#FF6B00]" />, action: () => onAction('new_chat') },
    { key: `${modKey}+M`, label: 'Model Router & Catalog', desc: 'Open multi-provider model picker', icon: <Zap className="w-4 h-4 text-[#FF6B00]" />, action: () => onAction('models') },
    { key: `${modKey}+B`, label: 'Toggle Sidebar', desc: 'Collapse or expand navigation drawer', icon: <PanelLeft className="w-4 h-4 text-[#FF6B00]" />, action: () => onAction('toggle_sidebar') },
        { key: `${modKey}+Shift+V`, label: 'Live Voice Mode', desc: 'Hands-free conversational voice overlay HUD', icon: <Radio className="w-4 h-4 text-[#FF6B00]" />, action: () => onAction('voice') },
    { key: 'Esc', label: 'Close Modals', desc: 'Dismiss active dialog or overlay', icon: <XCircle className="w-4 h-4 text-slate-400" />, action: onClose },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FFF9F3] border border-[#FFE8D6] flex items-center justify-center text-[#FF6B00]">
              <Command className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Keyboard Shortcuts &amp; Command Palette</h2>
              <p className="text-[11px] text-slate-500">Global shortcuts for lightning-fast navigation</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5 no-scrollbar">
          {/* View Navigation Section */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Switch Views
            </div>
            <div className="space-y-1.5">
              {viewShortcuts.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 flex items-center justify-between transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-slate-50 group-hover:bg-[#FFF9F3] transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{item.label}</div>
                      <div className="text-[11px] text-slate-500">{item.desc}</div>
                    </div>
                  </div>
                  <kbd className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-mono font-medium text-slate-600">
                    {item.key}
                  </kbd>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions Section */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              Quick Actions
            </div>
            <div className="space-y-1.5">
              {actionShortcuts.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 flex items-center justify-between transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-slate-50 group-hover:bg-[#FFF9F3] transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{item.label}</div>
                      <div className="text-[11px] text-slate-500">{item.desc}</div>
                    </div>
                  </div>
                  <kbd className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-mono font-medium text-slate-600">
                    {item.key}
                  </kbd>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
