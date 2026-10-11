import React from 'react';
import { Command, X, MessageSquare, Briefcase, Sparkles, BookOpen, Plus, Zap, PanelLeft, XCircle } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: 'chat' | 'cowork' | 'skills' | 'docs' | 'new_chat' | 'models' | 'toggle_sidebar') => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose, onAction }) => {
  if (!isOpen) return null;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const viewShortcuts = [
    { key: `${modKey}+1`, label: 'Chat View', desc: 'Switch to multi-model streaming chat', icon: <MessageSquare className="w-4 h-4 text-emerald-400" />, action: () => onAction('chat') },
    { key: `${modKey}+2`, label: 'Co-Work Workspace', desc: 'Switch to agentic task planner', icon: <Briefcase className="w-4 h-4 text-emerald-400" />, action: () => onAction('cowork') },
    { key: `${modKey}+3`, label: 'Skills & Personas', desc: 'Browse domain workflows', icon: <Sparkles className="w-4 h-4 text-emerald-400" />, action: () => onAction('skills') },
    { key: `${modKey}+4`, label: 'Architecture & Docs', desc: 'System topology & guides', icon: <BookOpen className="w-4 h-4 text-emerald-400" />, action: () => onAction('docs') },
  ];

  const actionShortcuts = [
    { key: `${modKey}+N`, label: 'New Chat', desc: 'Start a fresh conversation thread', icon: <Plus className="w-4 h-4 text-emerald-400" />, action: () => onAction('new_chat') },
    { key: `${modKey}+M`, label: 'Model Router & Catalog', desc: 'Open multi-provider model picker', icon: <Zap className="w-4 h-4 text-emerald-400" />, action: () => onAction('models') },
    { key: `${modKey}+B`, label: 'Toggle Sidebar', desc: 'Collapse or expand navigation drawer', icon: <PanelLeft className="w-4 h-4 text-emerald-400" />, action: () => onAction('toggle_sidebar') },
    { key: 'Esc', label: 'Close Modals', desc: 'Dismiss active dialog or overlay', icon: <XCircle className="w-4 h-4 text-slate-400" />, action: onClose },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col bg-[#0f1722] border border-[#232f42] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232f42]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Command className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Keyboard Shortcuts &amp; Command Palette</h2>
              <p className="text-[11px] text-slate-400">Global shortcuts for lightning-fast navigation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#1a2533] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* View Navigation Section */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Switch Views
            </div>
            <div className="space-y-1.5">
              {viewShortcuts.map((s) => (
                <div
                  key={s.key}
                  onClick={() => {
                    s.action();
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#121a24] hover:bg-[#182330] border border-[#222e3f] hover:border-[#33445c] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    {s.icon}
                    <div>
                      <div className="text-xs font-medium text-white group-hover:text-emerald-300">{s.label}</div>
                      <div className="text-[11px] text-slate-400">{s.desc}</div>
                    </div>
                  </div>
                  <kbd className="px-2 py-1 text-[11px] font-mono font-semibold text-slate-300 bg-[#090d12] border border-[#26374d] rounded shadow-xs">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Section */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              Quick Actions
            </div>
            <div className="space-y-1.5">
              {actionShortcuts.map((s) => (
                <div
                  key={s.key}
                  onClick={() => {
                    s.action();
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#121a24] hover:bg-[#182330] border border-[#222e3f] hover:border-[#33445c] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    {s.icon}
                    <div>
                      <div className="text-xs font-medium text-white group-hover:text-emerald-300">{s.label}</div>
                      <div className="text-[11px] text-slate-400">{s.desc}</div>
                    </div>
                  </div>
                  <kbd className="px-2 py-1 text-[11px] font-mono font-semibold text-slate-300 bg-[#090d12] border border-[#26374d] rounded shadow-xs">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#0a0f16] border-t border-[#232f42] text-[11px] text-slate-400">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 font-mono text-slate-300 bg-[#16212e] rounded border border-[#243346]">{modKey}+K</kbd> anywhere to open this menu</span>
          <button
            onClick={onClose}
            className="px-3 py-1 font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
