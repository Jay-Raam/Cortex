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
import { Conversation, User } from '../server/types';
import { CognivoLogo } from './CognivoLogo';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  currentUser?: User | null;
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
  currentUser,
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
  ];
  const sampleYesterday = [
    { id: 's_y1', title: 'Generate Creative Ideas for an Eco-Frien...' },
    { id: 's_y2', title: 'Step-by-Step Troubleshooting Guide for...' },
  ];
  const samplePrevious7Days = [
    { id: 's_p1', title: 'Write a Compelling Bio for a Freelance D...' },
    { id: 's_p2', title: 'Brainstorm Unique and Catchy Domain N...' },
    { id: 's_p3', title: 'Create a Comprehensive Onboarding Ch...' },
    { id: 's_p4', title: 'Develop a 30-Day Social Media Content...' },
    { id: 's_p5', title: 'Draft a Professional Job Offer Letter fo...' },
  ];

  // User details with safe fallback
  const userName = currentUser?.name || 'Cortex Architect';
  const userInitial = userName.trim().charAt(0).toUpperCase() || 'C';
  const userRole = currentUser?.role === 'admin' ? 'Pro Member' : 'Free';

  if (isCollapsed) {
    return (
      <aside className="hidden md:flex w-14 border-r border-[#E5E7EB] bg-[#F8F9FA] flex-col items-center py-3 justify-between shrink-0 h-full select-none z-20">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="Expand Sidebar"
          >
            <CognivoLogo size={22} />
          </button>
          <button
            onClick={onNewConversation}
            className="w-9 h-9 rounded-xl bg-[#FF6B00] hover:bg-[#E86000] text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          {/* Collapsed Avatar */}
          <div
            className="w-8 h-8 rounded-full bg-[#FF6B00]/10 border border-orange-200 text-[#FF6B00] flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer"
            title={userName}
          >
            {userInitial}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile Backdrop overlay when expanded */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-2xs z-30 md:hidden"
        onClick={onToggleCollapse}
      />

      <aside className="fixed inset-y-0 left-0 z-40 md:static w-64 md:w-68 border-r border-[#E5E7EB] bg-[#F8F9FA] flex flex-col shrink-0 h-full select-none shadow-xl md:shadow-none animate-in slide-in-from-left duration-200">
        {/* Top Brand Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#F0F2F4]">
          <div className="flex items-center gap-2.5">
            <CognivoLogo size={24} />
            <span className="font-bold text-lg text-slate-900 tracking-tight font-sans">Cortex</span>
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

        {/* Conversation History Groupings */}
        <div className="space-y-4 pt-1">
          {/* Today Group */}
          <div>
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Today
            </div>
            <div className="space-y-0.5">
              {(todayConversations.length > 0 ? todayConversations : sampleToday).map((item) => {
                const isReal = todayConversations.some((c) => c.id === item.id);
                const isActive = activeConversationId === item.id;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => {
                      if (isReal) onSelectConversation(item.id);
                    }}
                    className={`group relative flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-normal transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-white shadow-2xs font-semibold text-slate-900 border border-slate-200/70'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <span className="truncate pr-2">{item.title}</span>
                    {isReal && hoveredId === item.id && (
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onDeleteConversation(item.id)}
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

          {/* Yesterday Group */}
          <div>
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Yesterday
            </div>
            <div className="space-y-0.5">
              {(yesterdayConversations.length > 0 ? yesterdayConversations : sampleYesterday).map(
                (item) => {
                  const isReal = yesterdayConversations.some((c) => c.id === item.id);
                  const isActive = activeConversationId === item.id;
                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredId(item.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => {
                        if (isReal) onSelectConversation(item.id);
                      }}
                      className={`group relative flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-normal transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-white shadow-2xs font-semibold text-slate-900 border border-slate-200/70'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <span className="truncate pr-2">{item.title}</span>
                      {isReal && hoveredId === item.id && (
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onDeleteConversation(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Previous 7 Days Group */}
          <div>
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Previous 7 Days
            </div>
            <div className="space-y-0.5">
              {(olderConversations.length > 0 ? olderConversations : samplePrevious7Days).map(
                (item) => {
                  const isReal = olderConversations.some((c) => c.id === item.id);
                  const isActive = activeConversationId === item.id;
                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => setHoveredId(item.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => {
                        if (isReal) onSelectConversation(item.id);
                      }}
                      className={`group relative flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-normal transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-white shadow-2xs font-semibold text-slate-900 border border-slate-200/70'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <span className="truncate pr-2">{item.title}</span>
                      {isReal && hoveredId === item.id && (
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onDeleteConversation(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sidebar: Settings & Authenticated User Profile Card */}
      <div className="p-3 border-t border-[#E5E7EB] bg-[#F8F9FA] space-y-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer text-left"
        >
          <Settings className="w-4 h-4 text-slate-500" />
          <span>Settings</span>
        </button>

        {/* Authenticated User Card with Initials Fallback */}
        <div
          onClick={onOpenSettings}
          className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs hover:border-slate-300 transition-colors cursor-pointer"
          title={`Signed in as ${userName} (${currentUser?.email || 'authenticated'})`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#FF6B00]/10 border border-orange-200 text-[#FF6B00] flex items-center justify-center text-xs font-bold shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">{userName}</div>
              <div className="text-[10px] text-slate-400 font-medium">{userRole}</div>
            </div>
          </div>
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </div>
      </div>
    </aside>
    </>
  );
};
