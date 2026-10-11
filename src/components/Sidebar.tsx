import React, { useState } from 'react';
import { Plus, Search, MessageSquare, Pin, Trash2, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react';
import { Conversation } from '../server/types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string, currentPin: boolean) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
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
}) => {
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const pinned = filtered.filter((c) => c.isPinned);
  const recent = filtered.filter((c) => !c.isPinned);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  if (isCollapsed) {
    return (
      <aside className="w-14 border-r border-[#1d2737] bg-[#0c1219] flex flex-col items-center py-3 gap-3 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-[#16202c] transition-colors cursor-pointer"
          title={`Expand Sidebar (${modKey}+B)`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onNewConversation}
          className="p-2 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-md transition-colors cursor-pointer"
          title={`New Conversation (${modKey}+N)`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 border-r border-[#1d2737] bg-[#0c1219] flex flex-col shrink-0 h-full">
      {/* Top action row */}
      <div className="p-3 border-b border-[#1d2737] flex items-center gap-2">
        <button
          onClick={onNewConversation}
          className="flex-1 flex items-center justify-between py-2 px-3 text-xs font-semibold text-white bg-[#14202e] hover:bg-[#1b2b3d] border border-[#27374d] rounded-lg transition-colors cursor-pointer group"
          title={`Start new chat (${modKey}+N)`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>New Chat</span>
          </div>
          <kbd className="text-[10px] font-mono text-slate-400 bg-[#090d12] px-1.5 py-0.5 rounded border border-[#232f42]">
            {modKey}+N
          </kbd>
        </button>

        <button
          onClick={onToggleCollapse}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#16202c] transition-colors cursor-pointer"
          title={`Collapse Sidebar (${modKey}+B)`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#101722] border border-[#202c3e] rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {/* Pinned section */}
        {pinned.length > 0 && (
          <div>
            <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Pinned
            </div>
            <div className="space-y-0.5">
              {pinned.map((conv) => (
                <ConversationRow
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onSelect={() => onSelectConversation(conv.id)}
                  onTogglePin={() => onTogglePin(conv.id, conv.isPinned)}
                  onDelete={() => onDeleteConversation(conv.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent section */}
        <div>
          <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Conversations
          </div>
          {recent.length === 0 && pinned.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              No conversations yet. Start a new chat!
            </div>
          ) : (
            <div className="space-y-0.5">
              {recent.map((conv) => (
                <ConversationRow
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onSelect={() => onSelectConversation(conv.id)}
                  onTogglePin={() => onTogglePin(conv.id, conv.isPinned)}
                  onDelete={() => onDeleteConversation(conv.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#1d2737] text-[11px] text-slate-400 flex items-center justify-between">
        <span>Persistent History</span>
        <span className="font-mono text-emerald-400">PostgreSQL</span>
      </div>
    </aside>
  );
};

const ConversationRow: React.FC<{
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}> = ({ conversation, isActive, onSelect, onTogglePin, onDelete }) => {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between px-2.5 py-2 rounded-md text-xs cursor-pointer transition-colors ${
        isActive
          ? 'bg-[#152119] text-emerald-300 font-medium border border-emerald-500/30'
          : 'text-slate-300 hover:bg-[#131b26] hover:text-white'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
        <span className="truncate">{conversation.title}</span>
      </div>

      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#1e2a3a]"
          title={conversation.isPinned ? 'Unpin' : 'Pin'}
        >
          <Pin className={`w-3 h-3 ${conversation.isPinned ? 'text-emerald-400 fill-emerald-400' : ''}`} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-[#1e2a3a]"
          title="Delete Conversation"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
