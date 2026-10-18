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
  LogOut,
  UserCircle,
  Search,
  Edit2,
  Check,
  Briefcase,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Conversation, User, Workspace } from '../server/types';
import { CognivoLogo } from './CognivoLogo';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  currentUser?: User | null;
  workspaces?: Workspace[];
  activeWorkspaceId?: string | null;
  onSelectWorkspace?: (workspace: Workspace) => void;
  onNewWorkspace?: () => void;
  onDeleteWorkspace?: (id: string) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation?: (id: string, newTitle: string) => void;
  onTogglePin: (id: string, currentPin: boolean) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings?: () => void;
  onOpenExplore?: () => void;
  onOpenKnowledge?: () => void;
  onOpenTemplates?: () => void;
  onLogout?: () => void;
  onOpenAuth?: () => void;
  onOpenProfile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  currentUser,
  workspaces = [],
  activeWorkspaceId,
  onSelectWorkspace,
  onNewWorkspace,
  onDeleteWorkspace,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePin,
  isCollapsed,
  onToggleCollapse,
  onOpenSettings,
  onOpenExplore,
  onOpenKnowledge,
  onOpenTemplates,
  onLogout,
  onOpenAuth,
  onOpenProfile,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditingTitle(currentTitle);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim() && onRenameConversation) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  // Filter conversations by search query
  const filteredConversations = conversations.filter((c) =>
    searchQuery.trim() === ''
      ? true
      : c.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Group real conversations into Today, Yesterday, and Older
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

  const todayConversations = filteredConversations.filter((c) => isToday(c.createdAt));
  const yesterdayConversations = filteredConversations.filter((c) => isYesterday(c.createdAt));
  const olderConversations = filteredConversations.filter((c) => !isToday(c.createdAt) && !isYesterday(c.createdAt));

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
          {workspaces.length > 0 && (
            <button
              onClick={() => {
                if (onSelectWorkspace && workspaces[0]) onSelectWorkspace(workspaces[0]);
              }}
              className="w-9 h-9 rounded-xl hover:bg-slate-200/60 text-[#EA580C] flex items-center justify-center transition-colors cursor-pointer"
              title={`Projects (${workspaces.length})`}
            >
              <Briefcase className="w-4 h-4" />
            </button>
          )}
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

        {/* Dedicated Projects Section - Claude Style */}
        <div className="pt-0.5">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-slate-200/60 shadow-2xs transition-colors">
            <button
              type="button"
              onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
              className="flex items-center gap-2 flex-1 text-left cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-[#EA580C]" />
              <span className="text-xs font-bold text-slate-800">Projects</span>
              <span className="text-[10px] text-slate-400 font-mono">({workspaces.length})</span>
              {isProjectsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 ml-auto" />
              )}
            </button>
            {onNewWorkspace && (
              <button
                type="button"
                onClick={onNewWorkspace}
                className="p-1 text-slate-400 hover:text-[#EA580C] hover:bg-orange-50 rounded transition-colors ml-1 cursor-pointer"
                title="New Project / Bind Folder"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Expanded Projects List */}
          {isProjectsExpanded && (
            <div className="pl-2 pr-1 space-y-1 mt-1.5">
              {workspaces.map((ws) => {
                const isActive = activeWorkspaceId === ws.id;
                return (
                  <div
                    key={ws.id}
                    onClick={() => onSelectWorkspace && onSelectWorkspace(ws)}
                    className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer select-none ${
                      isActive
                        ? 'bg-[#FFF7ED] text-[#EA580C] font-bold border border-[#FED7AA] shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title={`Open ${ws.name} in Co-Work`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0 pr-1">
                      <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#EA580C]' : 'text-amber-500'}`} />
                      <span className="truncate">{ws.name}</span>
                    </div>
                    {onDeleteWorkspace && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Are you sure you want to delete project "${ws.name}"?`)) {
                            onDeleteWorkspace(ws.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {workspaces.length === 0 && (
                <div className="text-[11px] text-slate-400 px-3 py-1 italic">
                  No projects added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Secondary Navigation Links */}
        <div className="space-y-0.5 pt-0.5">
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

        {/* Search Conversations Input */}
        <div className="relative pt-0.5">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/60 focus:bg-white border border-transparent focus:border-[#FF6B00]/40 focus:ring-1 focus:ring-[#FF6B00]/20 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none transition-all"
          />
        </div>

        {/* Conversation History Groupings (Only Real User Data) */}
        <div className="space-y-4 pt-1">
          {/* Today Group */}
          {todayConversations.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Today
              </div>
              <div className="space-y-0.5">
                {todayConversations.map((item) => {
                  const isActive = activeConversationId === item.id;
                  const isEditing = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => !isEditing && onSelectConversation(item.id)}
                      className={`group relative flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-normal transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-white shadow-2xs font-semibold text-slate-900 border border-slate-200/70'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1.5 w-full pr-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(item.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            className="flex-1 px-1.5 py-0.5 bg-white border border-[#FF6B00] rounded text-xs text-slate-900 outline-none font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(item.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate pr-2">{item.title}</span>
                          <div
                            className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleStartRename(item.id, item.title)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors rounded cursor-pointer"
                              title="Rename chat"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteConversation(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded cursor-pointer"
                              title="Delete chat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Yesterday Group */}
          {yesterdayConversations.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Yesterday
              </div>
              <div className="space-y-0.5">
                {yesterdayConversations.map((item) => {
                  const isActive = activeConversationId === item.id;
                  const isEditing = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => !isEditing && onSelectConversation(item.id)}
                      className={`group relative flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-normal transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-white shadow-2xs font-semibold text-slate-900 border border-slate-200/70'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1.5 w-full pr-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(item.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            className="flex-1 px-1.5 py-0.5 bg-white border border-[#FF6B00] rounded text-xs text-slate-900 outline-none font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(item.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate pr-2">{item.title}</span>
                          <div
                            className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleStartRename(item.id, item.title)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors rounded cursor-pointer"
                              title="Rename chat"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteConversation(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded cursor-pointer"
                              title="Delete chat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Previous 7 Days Group */}
          {olderConversations.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Previous 7 Days
              </div>
              <div className="space-y-0.5">
                {olderConversations.map((item) => {
                  const isActive = activeConversationId === item.id;
                  const isEditing = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => !isEditing && onSelectConversation(item.id)}
                      className={`group relative flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-normal transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-white shadow-2xs font-semibold text-slate-900 border border-slate-200/70'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1.5 w-full pr-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(item.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            className="flex-1 px-1.5 py-0.5 bg-white border border-[#FF6B00] rounded text-xs text-slate-900 outline-none font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(item.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate pr-2">{item.title}</span>
                          <div
                            className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleStartRename(item.id, item.title)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors rounded cursor-pointer"
                              title="Rename chat"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteConversation(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded cursor-pointer"
                              title="Delete chat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {conversations.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              No conversations yet. Start a new chat above!
            </div>
          )}

          {conversations.length > 0 && filteredConversations.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              No chats found matching "{searchQuery}"
            </div>
          )}
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

        {/* Authenticated User Card with Initials Fallback & Account Menu */}
        <div className="relative">
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs hover:border-slate-300 transition-colors cursor-pointer"
            title={`Signed in as ${userName} (${currentUser?.email || 'authenticated'})`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={userName}
                  className="w-7 h-7 rounded-full object-cover border border-orange-200 shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#FF6B00]/10 border border-orange-200 text-[#FF6B00] flex items-center justify-center text-xs font-bold shrink-0">
                  {userInitial}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">{userName}</div>
                <div className="text-[10px] text-slate-400 font-medium">{userRole}</div>
              </div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </div>

          {/* User Account Popover */}
          {showUserMenu && (
            <div className="absolute bottom-full left-0 w-full mb-1 p-1 bg-white border border-slate-200 rounded-xl shadow-lg animate-in fade-in zoom-in-95 z-30">
              <div className="px-2.5 py-1.5 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-900 truncate">{userName}</div>
                <div className="text-[10px] text-slate-400 truncate">{currentUser?.email}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  if (onOpenProfile) onOpenProfile();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer text-left"
              >
                <UserCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Profile</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  if (onLogout) onLogout();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};
