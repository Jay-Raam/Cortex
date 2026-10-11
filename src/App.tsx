import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { ChatComposer } from './components/ChatComposer';
import { ModelSelectorModal } from './components/ModelSelectorModal';
import { CoworkWorkspace } from './components/CoworkWorkspace';
import { SkillsDrawer } from './components/SkillsDrawer';
import { NotificationModal } from './components/NotificationModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { DocsView } from './components/DocsView';
import { fetchGraphQL, streamChat } from './lib/api';
import {
  Conversation,
  Message,
  ModelInfo,
  ModelMode,
  Skill,
  Workspace,
  NotificationItem,
  NotificationPreferences,
} from './server/types';
import { Sparkles, Bot, Zap, Download, FileText, FileJson } from 'lucide-react';
import { PromptTemplates } from './components/PromptTemplates';
import { exportConversationToMarkdown, exportConversationToJson } from './lib/export';

export default function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'cowork' | 'skills' | 'docs'>('chat');

  // Domain data
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-3.8-flash');
  const [selectedMode, setSelectedMode] = useState<ModelMode>('balanced');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    userId: 'usr_dev_primary',
    emailEnabled: true,
    pushEnabled: true,
    whatsappEnabled: false,
  });

  // UI modal toggles
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const stopStreamRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial load
  const loadInitialData = async () => {
    try {
      const data = await fetchGraphQL(`
        query InitPlatform {
          models {
            id
            providerId
            displayName
            description
            mode
            isFree
            pricingDescription
            contextWindow
            capabilities {
              streaming
              vision
              toolCalling
              reasoning
            }
            availability
            lastChecked
            latencyMs
          }
          conversations {
            id
            title
            modelId
            providerId
            mode
            skillId
            isPinned
            isArchived
            createdAt
            updatedAt
          }
          skills {
            id
            name
            description
            category
            version
            instructions
            allowedTools
            icon
            isSystem
            isEnabled
          }
          workspaces {
            id
            name
            description
            createdAt
            updatedAt
          }
          notifications {
            id
            title
            message
            channel
            type
            read
            createdAt
          }
          notificationPreferences {
            userId
            emailEnabled
            pushEnabled
            whatsappEnabled
          }
        }
      `);

      if (data.models) setModels(data.models);
      if (data.conversations) {
        setConversations(data.conversations);
        if (data.conversations.length > 0 && !activeConversationId) {
          setActiveConversationId(data.conversations[0].id);
        }
      }
      if (data.skills) setSkills(data.skills);
      if (data.workspaces && data.workspaces.length > 0) {
        setWorkspaces(data.workspaces);
        setActiveWorkspace(data.workspaces[0]);
      }
      if (data.notifications) setNotifications(data.notifications);
      if (data.notificationPreferences) setPreferences(data.notificationPreferences);
    } catch (err) {
      console.error('Failed to load initial platform data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const data = await fetchGraphQL(
          `
          query GetConv($id: ID!) {
            conversation(id: $id) {
              id
              title
              modelId
              mode
              skillId
              messages {
                id
                role
                content
                modelUsed
                createdAt
                attachments {
                  id
                  name
                  size
                  mimeType
                  url
                }
              }
            }
          }
        `,
          { id: activeConversationId }
        );

        if (data.conversation) {
          setMessages(data.conversation.messages || []);
          if (data.conversation.modelId) setSelectedModelId(data.conversation.modelId);
          if (data.conversation.mode) setSelectedMode(data.conversation.mode as ModelMode);
          if (data.conversation.skillId) setActiveSkillId(data.conversation.skillId);
        }
      } catch (err) {
        console.error('Failed to load messages for conversation:', err);
      }
    };

    fetchMessages();
  }, [activeConversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Handle new conversation
  const handleNewConversation = useCallback(async () => {
    try {
      const data = await fetchGraphQL(
        `
        mutation CreateConv($title: String!, $modelId: String!, $mode: String, $skillId: String) {
          createConversation(title: $title, modelId: $modelId, mode: $mode, skillId: $skillId) {
            id
            title
            modelId
            mode
            skillId
            isPinned
            isArchived
            createdAt
            updatedAt
          }
        }
      `,
        {
          title: 'New Chat',
          modelId: selectedModelId,
          mode: selectedMode,
          skillId: activeSkillId,
        }
      );

      if (data.createConversation) {
        setConversations((prev) => [data.createConversation, ...prev]);
        setActiveConversationId(data.createConversation.id);
        setMessages([]);
      }
    } catch (err: any) {
      alert(`Failed to create conversation: ${err.message}`);
    }
  }, [selectedModelId, selectedMode, activeSkillId]);

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      // Escape closes modals
      if (e.key === 'Escape') {
        setIsModelModalOpen(false);
        setIsShortcutsOpen(false);
        setIsNotificationsOpen(false);
        setIsSkillsOpen(false);
        return;
      }

      // Modifier key shortcuts (Ctrl / Cmd)
      if (isMod) {
        // Ctrl+1: Switch to Chat view
        if (e.key === '1') {
          e.preventDefault();
          setCurrentView('chat');
          return;
        }
        // Ctrl+2: Switch to Co-Work view
        if (e.key === '2') {
          e.preventDefault();
          setCurrentView('cowork');
          return;
        }
        // Ctrl+3: Switch to Skills view
        if (e.key === '3') {
          e.preventDefault();
          setCurrentView('skills');
          return;
        }
        // Ctrl+4: Switch to Architecture / Docs view
        if (e.key === '4') {
          e.preventDefault();
          setCurrentView('docs');
          return;
        }
        // Ctrl+N: Start New Chat
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          handleNewConversation();
          setCurrentView('chat');
          return;
        }
        // Ctrl+M: Open Model Selector & Catalog
        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          setIsModelModalOpen((prev) => !prev);
          return;
        }
        // Ctrl+K: Open Command Palette / Shortcuts Modal
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          setIsShortcutsOpen((prev) => !prev);
          return;
        }
        // Ctrl+B: Toggle Sidebar
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          setIsSidebarCollapsed((prev) => !prev);
          return;
        }
      }

      // Pressing '?' when not typing in an input opens the shortcuts modal
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(targetTag)) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewConversation]);

  // Delete conversation
  const handleDeleteConversation = async (id: string) => {
    try {
      await fetchGraphQL(
        `
        mutation DelConv($id: ID!) {
          deleteConversation(id: $id)
        }
      `,
        { id }
      );
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      alert(`Failed to delete conversation: ${err.message}`);
    }
  };

  // Toggle Pin
  const handleTogglePin = async (id: string, currentPin: boolean) => {
    try {
      const data = await fetchGraphQL(
        `
        mutation PinConv($id: ID!, $isPinned: Boolean) {
          updateConversation(id: $id, isPinned: $isPinned) {
            id
            isPinned
          }
        }
      `,
        { id, isPinned: !currentPin }
      );

      if (data.updateConversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isPinned: !currentPin } : c))
        );
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Send message with streaming
  const handleSendMessage = async (content: string, attachments: any[]) => {
    if (!content.trim() && attachments.length === 0) return;

    let convId = activeConversationId;
    // If no active conversation, create one first
    if (!convId) {
      try {
        const titleSnippet = content.substring(0, 30) || 'New Conversation';
        const data = await fetchGraphQL(
          `
          mutation CreateConv($title: String!, $modelId: String!, $mode: String, $skillId: String) {
            createConversation(title: $title, modelId: $modelId, mode: $mode, skillId: $skillId) {
              id
              title
              modelId
              mode
              skillId
              isPinned
              isArchived
              createdAt
              updatedAt
            }
          }
        `,
          {
            title: titleSnippet,
            modelId: selectedModelId,
            mode: selectedMode,
            skillId: activeSkillId,
          }
        );
        convId = data.createConversation.id;
        setActiveConversationId(convId);
        setConversations((prev) => [data.createConversation, ...prev]);
      } catch (err: any) {
        alert(`Failed to create conversation: ${err.message}`);
        return;
      }
    }

    // Add optimistic user message to local state
    const userMsg: Message = {
      id: `local_${Date.now()}`,
      conversationId: convId!,
      role: 'user',
      content,
      attachments,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    setIsStreaming(true);
    setStreamingContent('');

    // Trigger SSE stream
    let accumulatedText = '';
    const stopFn = streamChat(
      {
        conversationId: convId!,
        content,
        modelId: selectedModelId,
        mode: selectedMode,
        skillId: activeSkillId || undefined,
        attachments,
      },
      (event) => {
        if (event.type === 'delta') {
          accumulatedText += event.payload.text;
          setStreamingContent(accumulatedText);
        } else if (event.type === 'fallback_notice') {
          console.warn('[Nexa Router Fallback]', event.payload.reason);
        } else if (event.type === 'error') {
          setIsStreaming(false);
          const errorMsg: Message = {
            id: `err_${Date.now()}`,
            conversationId: convId!,
            role: 'assistant',
            content: `Generation failed: ${event.payload?.message || 'Stream processing failed'}`,
            isError: true,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          setStreamingContent('');
        } else if (event.type === 'completed') {
          setIsStreaming(false);
          const msgId = event.payload.messageId || `asst_${Date.now()}`;
          const assistantMsg: Message = {
            id: msgId,
            conversationId: convId!,
            role: 'assistant',
            content: accumulatedText,
            modelUsed: event.payload.modelUsed || selectedModelId,
            providerUsed: event.payload.providerUsed,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => {
            const existingIndex = prev.findIndex((m) => m.id === msgId);
            if (existingIndex !== -1) {
              const updated = [...prev];
              updated[existingIndex] = assistantMsg;
              return updated;
            }
            return [...prev, assistantMsg];
          });
          setStreamingContent('');
        }
      },
      (err) => {
        setIsStreaming(false);
        const errorMsg: Message = {
          id: `err_${Date.now()}`,
          conversationId: convId!,
          role: 'assistant',
          content: `Generation failed: ${err.message}`,
          isError: true,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setStreamingContent('');
      }
    );

    stopStreamRef.current = stopFn;
  };

  const handleStopStreaming = () => {
    if (stopStreamRef.current) {
      stopStreamRef.current();
      stopStreamRef.current = null;
    }
    setIsStreaming(false);
    if (streamingContent) {
      const partialMsg: Message = {
        id: `asst_${Date.now()}`,
        conversationId: activeConversationId!,
        role: 'assistant',
        content: streamingContent + ' *(stopped)*',
        modelUsed: selectedModelId,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, partialMsg]);
      setStreamingContent('');
    }
  };

  const activeModel = models.find((m) => m.id === selectedModelId) || models[0];
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeSkill = skills.find((s) => s.id === activeSkillId);
  const unreadNotifications = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090d12] text-slate-100 font-sans">
      {/* Top Bar (Strict 3-zone contract) */}
      <TopNav
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        selectedModelName={activeModel?.displayName || 'Gemini 3.8 Flash'}
        selectedMode={selectedMode}
        onOpenModelModal={() => setIsModelModalOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        unreadNotificationsCount={unreadNotifications}
      />

      {/* Main View Area */}
      <div className="flex-1 flex overflow-hidden">
        {currentView === 'chat' && (
          <>
            {/* Sidebar for chat history & search */}
            <Sidebar
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={(id) => setActiveConversationId(id)}
              onNewConversation={handleNewConversation}
              onDeleteConversation={handleDeleteConversation}
              onTogglePin={handleTogglePin}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            {/* Central Chat View */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#090d12] relative">
              {/* Active Skill Notice (Quiet inline banner if skill active) */}
              {activeSkill && (
                <div className="px-6 py-2 bg-[#0e171f] border-b border-[#1b2636] flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Active Workflow Persona: <strong className="text-white">{activeSkill.name}</strong>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">({activeSkill.category})</span>
                  </div>
                  <button
                    onClick={() => setActiveSkillId(null)}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Deactivate
                  </button>
                </div>
              )}

              {/* Chat Header Actions Toolbar */}
              {activeConversation && messages.length > 0 && (
                <div className="px-6 py-2 border-b border-[#182333] flex items-center justify-between text-xs text-slate-400 bg-[#090d12]/80 shrink-0">
                  <span className="font-medium text-slate-200 truncate max-w-[260px]">
                    {activeConversation.title || 'Chat'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportConversationToMarkdown(activeConversation, messages)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#101722] hover:bg-[#162130] border border-[#233145] text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Export conversation as Markdown"
                    >
                      <FileText className="w-3 h-3 text-emerald-400" />
                      <span>Export .md</span>
                    </button>
                    <button
                      onClick={() => exportConversationToJson(activeConversation, messages)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#101722] hover:bg-[#162130] border border-[#233145] text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Export conversation as JSON"
                    >
                      <FileJson className="w-3 h-3 text-blue-400" />
                      <span>Export JSON</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Message List */}
              <div className="flex-1 overflow-y-auto">
                {messages.length === 0 && !isStreaming ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-[#121c27] border border-[#233145] flex items-center justify-center text-emerald-400 mb-4 shadow-sm">
                      <Bot className="w-6 h-6" />
                    </div>
                    <h2 className="text-lg font-semibold text-white tracking-tight">How can Cortex assist today?</h2>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Select between <span className="text-slate-300 font-medium">Efficient</span>,{' '}
                      <span className="text-slate-300 font-medium">Balanced</span>, and{' '}
                      <span className="text-slate-300 font-medium">Powerful</span> modes, or launch an autonomous
                      task in the <button onClick={() => setCurrentView('cowork')} className="text-emerald-400 font-medium underline">Co-Work workspace</button>.
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-6 w-full text-left text-xs">
                      <button
                        onClick={() => handleSendMessage('Explain the architecture of a multi-model AI router with fallback guarantees.', [])}
                        className="p-3 rounded-lg bg-[#0e1620] hover:bg-[#14202e] border border-[#212f42] text-slate-300 transition-colors cursor-pointer"
                      >
                        Architecture of an AI model router
                      </button>
                      <button
                        onClick={() => handleSendMessage('Review this code for security vulnerabilities, race conditions, and memory leaks.', [])}
                        className="p-3 rounded-lg bg-[#0e1620] hover:bg-[#14202e] border border-[#212f42] text-slate-300 transition-colors cursor-pointer"
                      >
                        Audit code for OWASP security
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        message={msg}
                        onRegenerate={
                          msg.role === 'assistant'
                            ? () => handleSendMessage('Regenerate previous answer with deeper analysis.', [])
                            : undefined
                        }
                      />
                    ))}

                    {/* Temporary streaming message placeholder */}
                    {isStreaming && (
                      <ChatMessage
                        message={{
                          id: 'streaming_placeholder',
                          conversationId: activeConversationId || '',
                          role: 'assistant',
                          content: streamingContent || 'Reflecting on response...',
                          modelUsed: activeModel?.displayName,
                          createdAt: new Date().toISOString(),
                        }}
                        isStreaming={true}
                      />
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Developer Prompt Presets */}
              <PromptTemplates onSelectTemplate={(prompt) => handleSendMessage(prompt, [])} />

              {/* Chat Composer */}
              <ChatComposer
                onSendMessage={handleSendMessage}
                isStreaming={isStreaming}
                onStopStreaming={handleStopStreaming}
                selectedModelName={activeModel?.displayName || 'Gemini 3.8 Flash'}
                selectedMode={selectedMode}
                onOpenModelModal={() => setIsModelModalOpen(true)}
              />
            </main>
          </>
        )}

        {currentView === 'cowork' && (
          <CoworkWorkspace
            workspace={activeWorkspace}
            onRefreshWorkspace={loadInitialData}
          />
        )}

        {currentView === 'skills' && (
          <div className="flex-1 overflow-hidden">
            <SkillsDrawer
              isOpen={true}
              onClose={() => setCurrentView('chat')}
              skills={skills}
              activeSkillId={activeSkillId}
              onSelectSkill={(id) => {
                setActiveSkillId(id);
                setCurrentView('chat');
              }}
            />
          </div>
        )}

        {currentView === 'docs' && <DocsView />}
      </div>

      {/* Model Selector Modal */}
      <ModelSelectorModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        models={models}
        selectedModelId={selectedModelId}
        selectedMode={selectedMode}
        onSelectModel={(modelId, mode) => {
          setSelectedModelId(modelId);
          setSelectedMode(mode);
          setIsModelModalOpen(false);
        }}
        onSelectMode={(mode) => setSelectedMode(mode)}
      />

      {/* Notification Center Modal */}
      <NotificationModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        preferences={preferences}
        onRefresh={loadInitialData}
      />

      {/* Keyboard Shortcuts Command Palette */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        onAction={(action) => {
          if (action === 'chat') setCurrentView('chat');
          if (action === 'cowork') setCurrentView('cowork');
          if (action === 'skills') setCurrentView('skills');
          if (action === 'docs') setCurrentView('docs');
          if (action === 'new_chat') {
            handleNewConversation();
            setCurrentView('chat');
          }
          if (action === 'models') setIsModelModalOpen(true);
          if (action === 'toggle_sidebar') setIsSidebarCollapsed((prev) => !prev);
        }}
      />
    </div>
  );
}
