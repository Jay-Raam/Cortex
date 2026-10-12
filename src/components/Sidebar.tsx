import React, { useState } from 'react';
import {
  Globe,
  Scissors,
  LayoutGrid,
  Settings,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Trash2,
  Plus,
} from 'lucide-react';
import { Conversation } from '../server/types';
import { CognivoLogo } from './CognivoLogo';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string, currentPin: boolean) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings?: () => void;
  onOpenExplore?: () => void;
  onOpenKnowledge?: () => void;
  onOpenTemplates?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onTogglePin,
  isCollapsed,
  onToggleCollapse,
  onOpenSettings,
  onOpenExplore,
  onOpenKnowledge,
  onOpenTemplates,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  // Group conversations into Today, Yesterday, and Older
  const now = new Date();
  const isToday = (d: string) => {
    const date = new Date(d);
    return date.toDateString() === now.toDateString();
  };
  const isYesterday = (d: string) => {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return new Date(d).toDateString() === yesterday.toDateString();
  };

  const todayConversations = conversations.filter((c) => isToday(c.createdAt));
  const yesterdayConversations = conversations.filter((c) => isYesterday(c.createdAt));
  const olderConversations = conversations.filter((c) => !isToday(c.createdAt) && !isYesterday(c.createdAt));

  // Default sample items if user has few conversations (matches the reference design exactly)
  const sampleToday = [
    { id: 's_t1', title: 'Summarize the Key Insights from the 202...' },
    { id: 's_t2', title: 'Draft a Polite and Professional Follow-U...' },
    { id: 's_t3', title: 'Brainstorm Creative Startup App Ideas f...' },
  ];
  const sampleYesterday = [
    { id: 's_y1', title: 'Explain Blockchain Technology in Simple...' },
    { id: 's_y2', title: 'Translate an English Travel Guide into Sp...' },
    { id: 's_y3', title: 'Write Five Engaging Instagram Captions...' },
    { id: 's_y4', title: 'Help Me Debug a Python Script That Kee...' },
    { id: 's_y5', title: 'Plan a Balanced Weekly Workout Routine...' },
  ];
  const sampleOlder = [
    { id: 's_o1', title: 'Create an SEO-Optimized Blog Outline A...' },
    { id: 's_o2', title: 'Research and Recommend the Best Rem...' },
    { id: 's_o3', title: 'Generate a Catchy Tagline and Slogan fo...' },
  ];

  if (isCollapsed) {
    return (
      <aside className="w-16 border-r border-[#E5E7EB] bg-[#F8F9FA] flex flex-col items-center py-4 gap-4 shrink-0 z-20">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          title={`Expand Sidebar (${modKey}+B)`}
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
        <button
          onClick={onNewConversation}
          className="p-2.5 text-white bg-[#FF6B00] hover:bg-[#E86000] rounded-xl shadow-sm transition-all cursor-pointer"
          title={`New Chat (${modKey}+N)`}
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="mt-auto">
          <div className="w-8 h-8 rounded-full bg-slate-300 overflow-hidden ring-1 ring-slate-200">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 md:w-68 border-r border-[#E5E7EB] bg-[#F8F9FA] flex flex-col shrink-0 h-full select-none z-20">
      {/* Top Brand Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#F0F2F4]">
        <div className="flex items-center gap-2.5">
          <CognivoLogo size={24} />
          <span className="font-bold text-lg text-slate-900 tracking-tight font-sans">Cognivo</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
          title={`Collapse Sidebar (${modKey}+B)`}
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Main Sidebar Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 no-scrollbar">
        {/* + New Chat Vibrant Orange Button */}
        <button
          onClick={onNewConversation}
          className="w-full h-10 px-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#E86000] active:scale-[0.99] text-white flex items-center justify-between shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Chat</span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-[#E05D00] text-white/90 font-mono">
            {modKey} N
          </span>
        </button>

        {/* Secondary Navigation Links */}
        <div className="space-y-0.5 pt-1">
          <button
            type="button"
            onClick={onOpenExplore}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition-colors text-left cursor-pointer"
          >
            <Globe className="w-4 h-4 text-slate-500" />
            <span>Explore Cortex AI</span>
          </button>
          <button
            type="button"
            onClick={onOpenKnowledge}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition-colors text-left cursor-pointer"
          >
            <Scissors className="w-4 h-4 text-slate-500" />
            <span>Knowledge Base</span>
          </button>
          <button
            type="button"
            onClick={onOpenTemplates}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 transition-colors text-left cursor-pointer"
          >
            <LayoutGrid className="w-4 h-4 text-slate-500" />
            <span>Templates</span>
          </button>
        </div>

        {/* Chronological History Groups */}
        <div className="space-y-4 pt-1">
          {/* TODAY */}
          <div>
            <div className="px-3 text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
              Today
            </div>
            <div className="space-y-0.5">
              {(todayConversations.length > 0 ? todayConversations : sampleToday).map((item) => {
                const isReal = conversations.some((c) => c.id === item.id);
                const isActive = activeConversationId === item.id;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => {
                      if (isReal) onSelectConversation(item.id);
                      else onNewConversation();
                    }}
                    className={`group flex items-center justify-between px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-slate-200/80 text-slate-950 font-medium'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate pr-2">{item.title}</span>
                    {isReal && hoveredId === item.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(item.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* YESTERDAY */}
          <div>
            <div className="px-3 text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
              Yesterday
            </div>
            <div className="space-y-0.5">
              {(yesterdayConversations.length > 0 ? yesterdayConversations : sampleYesterday).map((item) => {
                const isReal = conversations.some((c) => c.id === item.id);
                const isActive = activeConversationId === item.id;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => {
                      if (isReal) onSelectConversation(item.id);
                      else onNewConversation();
                    }}
                    className={`group flex items-center justify-between px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-slate-200/80 text-slate-950 font-medium'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate pr-2">{item.title}</span>
                    {isReal && hoveredId === item.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(item.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AUGUST / OLDER */}
          <div>
            <div className="px-3 text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">
              August
            </div>
            <div className="space-y-0.5">
              {(olderConversations.length > 0 ? olderConversations : sampleOlder).map((item) => {
                const isReal = conversations.some((c) => c.id === item.id);
                const isActive = activeConversationId === item.id;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => {
                      if (isReal) onSelectConversation(item.id);
                      else onNewConversation();
                    }}
                    className={`group flex items-center justify-between px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-slate-200/80 text-slate-950 font-medium'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate pr-2">{item.title}</span>
                    {isReal && hoveredId === item.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(item.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sidebar: Settings & User Profile Card */}
      <div className="p-3 border-t border-[#E5E7EB] bg-[#F8F9FA] space-y-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer text-left"
        >
          <Settings className="w-4 h-4 text-slate-500" />
          <span>Settings</span>
        </button>

        {/* User Card */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs hover:border-slate-300 transition-colors cursor-pointer">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 shrink-0">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"
                alt="Joko Handoyo"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">Joko Handoyo</div>
              <div className="text-[10px] text-slate-400 font-medium">Free</div>
            </div>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </div>
      </div>
    </aside>
  );
};
