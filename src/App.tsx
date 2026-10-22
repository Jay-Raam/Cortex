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
import { CognivoLogo } from './components/CognivoLogo';
import { ExploreModal } from './components/ExploreModal';
import { KnowledgeModal } from './components/KnowledgeModal';
import { TemplatesModal } from './components/TemplatesModal';
import { ShareModal } from './components/ShareModal';
import { AuthPage } from './components/AuthPage';
import { ProfileModal } from './components/ProfileModal';
import { UsageModal } from './components/UsageModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { fetchGraphQL, streamChat, checkAuth, loginUser, registerUser, logoutUser, renameConversationApi } from './lib/api';
import {
  Conversation,
  Message,
  ModelInfo,
  ModelMode,
  Skill,
  Workspace,
  NotificationItem,
  NotificationPreferences,
  User,
} from './server/types';
import {
  Sparkles,
  FileText,
  FileJson,
  PenLine,
  Lightbulb,
  HelpCircle,
  Languages,
} from 'lucide-react';
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    userId: 'usr_dev_primary',
    emailEnabled: true,
    pushEnabled: true,
    whatsappEnabled: false,
  });

  // UI state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const stopStreamRef = useRef<(() => void) | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check authentication session on mount
  useEffect(() => {
    checkAuth()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
        }
      })
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, []);

  const handleLogin = async (email: string, pass: string) => {
    const user = await loginUser(email, pass);
    setCurrentUser(user);
    await loadInitialData();
    return user;
  };

  const handleRegister = async (email: string, name: string, pass: string) => {
    const user = await registerUser(email, name, pass);
    setCurrentUser(user);
    await loadInitialData();
    return user;
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
  };

  // Initial Load: Models, Skills, Conversations, Notifications
  const loadInitialData = useCallback(async () => {
    try {
      const data = await fetchGraphQL(`
        query GetInitialData {
          me {
            id
            name
            email
            role
            createdAt
          }
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
        }
      `);

      if (data) {
        if (data.me) setCurrentUser(data.me);
        if (data.models) setModels(data.models);
        if (data.skills) setSkills(data.skills);
        if (data.conversations) {
          setConversations(data.conversations);
          if (data.conversations.length > 0 && !activeConversationId) {
            setActiveConversationId(data.conversations[0].id);
          }
        }
        if (data.workspaces) {
          setWorkspaces(data.workspaces);
          if (data.workspaces.length > 0 && !activeWorkspace) {
            setActiveWorkspace(data.workspaces[0]);
          }
        }
        if (data.notifications) setNotifications(data.notifications);
      }
    } catch (err) {
      console.error('[Cognivo Initial Load Error]', err);
    }
  }, [activeConversationId, activeWorkspace]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const data = await fetchGraphQL(`
          query GetMessages($conversationId: ID!) {
            messages(conversationId: $conversationId) {
              id
              conversationId
              role
              content
              modelUsed
              providerUsed
              isError
              attachments {
                id
                name
                size
                mimeType
                url
              }
              createdAt
            }
          }
        `, { conversationId: activeConversationId });

        if (data?.messages) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('[Cognivo Messages Load Error]', err);
      }
    };

    loadMessages();
  }, [activeConversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Keyboard Shortcuts (Ctrl+K, Ctrl+N, Ctrl+B, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewConversation();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setIsModelModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers
  const handleNewConversation = async () => {
    try {
      const data = await fetchGraphQL(`
        mutation CreateConversation($title: String!, $modelId: String!, $mode: String, $skillId: String) {
          createConversation(title: $title, modelId: $modelId, mode: $mode, skillId: $skillId) {
            id
            title
            modelId
            providerId
            mode
            skillId
            createdAt
          }
        }
      `, {
        title: 'New Chat',
        modelId: selectedModelId,
        mode: selectedMode,
        skillId: activeSkillId,
      });

      if (data?.createConversation) {
        setConversations((prev) => [data.createConversation, ...prev]);
        setActiveConversationId(data.createConversation.id);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to create conversation', err);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      const data = await fetchGraphQL(`
        mutation DeleteConversation($id: ID!) {
          deleteConversation(id: $id)
        }
      `, { id });

      if (data?.deleteConversation) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          const remaining = conversations.filter((c) => c.id !== id);
          setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  const handleCreateBlankProject = async (name: string, description: string) => {
    try {
      const data = await fetchGraphQL(`
        mutation CreateWorkspace($name: String!, $description: String!) {
          createWorkspace(name: $name, description: $description) {
            id
            name
            description
            createdAt
            updatedAt
          }
        }
      `, { name, description: description || '' });
      if (data?.createWorkspace) {
        setWorkspaces((prev) => [data.createWorkspace, ...prev]);
        setActiveWorkspace(data.createWorkspace);
        setCurrentView('cowork');
      }
    } catch (err) {
      console.error('Failed to create workspace', err);
    }
  };

  const handleImportLocalProject = async (
    name: string,
    folderName: string,
    files: Array<{ path: string; content: string }>,
    originalPath?: string
  ) => {
    try {
      const res = await fetch('/api/cowork/workspaces/import-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || folderName || 'Local Project',
          folderName,
          originalPath: originalPath || folderName,
          files,
        }),
      });
      const data = await res.json();
      if (data.success && data.workspace) {
        setWorkspaces((prev) => [data.workspace, ...prev]);
        setActiveWorkspace(data.workspace);
        setCurrentView('cowork');
      } else {
        alert(data.error || 'Failed to import local folder');
      }
    } catch (err: any) {
      alert(`Error importing folder: ${err.message}`);
    }
  };

  const handleBindLocalProjectPath = async (folderPath: string, name?: string) => {
    try {
      const res = await fetch('/api/cowork/workspaces/bind-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: folderPath.trim(),
          name: name?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.workspace) {
        setWorkspaces((prev) => [data.workspace, ...prev]);
        setActiveWorkspace(data.workspace);
        setCurrentView('cowork');
      } else {
        alert(data.error || 'Failed to bind local folder');
      }
    } catch (err: any) {
      alert(`Error binding folder: ${err.message}`);
    }
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    try {
      const res = await fetch(`/api/cowork/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
        if (activeWorkspace?.id === workspaceId) {
          const remaining = workspaces.filter((w) => w.id !== workspaceId);
          setActiveWorkspace(remaining.length > 0 ? remaining[0] : null);
        }
      }
    } catch (err) {
      console.error('Failed to delete workspace', err);
    }
  };

  const handleTogglePin = async (id: string, currentPin: boolean) => {
    try {
      const data = await fetchGraphQL(`
        mutation UpdateConversation($id: ID!, $isPinned: Boolean) {
          updateConversation(id: $id, isPinned: $isPinned) {
            id
            isPinned
          }
        }
      `, {
        id,
        isPinned: !currentPin,
      });

      if (data?.updateConversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isPinned: !currentPin } : c))
        );
      }
    } catch (err) {
      console.error('Failed to toggle pin', err);
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await renameConversationApi(id, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      );
    } catch (err) {
      console.error('Failed to rename conversation', err);
    }
  };

  const handleSendMessage = async (content: string, attachments: any[], overrideModelId?: string) => {
    if (!content.trim() && attachments.length === 0) return;

    const modelToUse = overrideModelId || selectedModelId;
    let convId = activeConversationId;
    if (!convId) {
      try {
        const titleSnippet = content.substring(0, 30) || 'New Conversation';
        const data = await fetchGraphQL(`
          mutation CreateConversation($title: String!, $modelId: String!, $mode: String, $skillId: String) {
            createConversation(title: $title, modelId: $modelId, mode: $mode, skillId: $skillId) {
              id
              title
              modelId
              providerId
              mode
              createdAt
            }
          }
        `, {
          title: titleSnippet,
          modelId: modelToUse,
          mode: selectedMode,
          skillId: activeSkillId,
        });

        if (data?.createConversation) {
          convId = data.createConversation.id;
          setConversations((prev) => [data.createConversation, ...prev]);
          setActiveConversationId(convId);
        }
      } catch (err) {
        console.error('Failed to auto-create conversation', err);
        return;
      }
    }

    const userMsg: Message = {
      id: `msg_${Date.now()}_u`,
      conversationId: convId!,
      role: 'user',
      content,
      attachments,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent('');

    let accumulatedText = '';

    const stopFn = streamChat(
      {
        conversationId: convId!,
        content,
        modelId: modelToUse,
        skillId: activeSkillId || undefined,
        attachments: attachments,
      },
      (event) => {
        if (event.type === 'delta') {
          accumulatedText += event.payload.text;
          setStreamingContent(accumulatedText);
        } else if (event.type === 'fallback_notice') {
          console.warn('[Cognivo Router Fallback]', event.payload.reason);
        } else if (event.type === 'error') {
          setIsStreaming(false);
          const errorReason = event.payload?.message || 'Stream processing failed';
          const partialText = (accumulatedText || event.payload?.partialText || '').trim();

          if (partialText.length > 0) {
            const partialMsg: Message = {
              id: `asst_${Date.now()}`,
              conversationId: convId!,
              role: 'assistant',
              content: `${partialText}\n\n*(Generation interrupted: ${errorReason})*`,
              modelUsed: selectedModelId,
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, partialMsg]);
          } else {
            const errorMsg: Message = {
              id: `err_${Date.now()}`,
              conversationId: convId!,
              role: 'assistant',
              content: `Generation failed: ${errorReason}`,
              isError: true,
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMsg]);
          }
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
        const errorReason = err?.message || 'Stream processing failed';
        const partialText = accumulatedText.trim();
        if (partialText.length > 0) {
          const partialMsg: Message = {
            id: `asst_${Date.now()}`,
            conversationId: convId!,
            role: 'assistant',
            content: `${partialText}\n\n*(Generation interrupted: ${errorReason})*`,
            modelUsed: selectedModelId,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, partialMsg]);
        } else {
          const errorMsg: Message = {
            id: `err_${Date.now()}`,
            conversationId: convId!,
            role: 'assistant',
            content: `Generation failed: ${errorReason}`,
            isError: true,
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
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

  const handleRegenerate = (messageId: string, overrideModelId?: string) => {
    if (isStreaming) return;
    const msgIndex = messages.findIndex((m) => m.id === messageId);
    let userPrompt = 'Regenerate previous answer with deeper analysis.';
    let attachments: any[] = [];
    if (msgIndex !== -1) {
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userPrompt = messages[i].content;
          attachments = messages[i].attachments || [];
          break;
        }
      }
    }
    handleSendMessage(userPrompt, attachments, overrideModelId);
  };

  const activeModel = models.find((m) => m.id === selectedModelId) || models[0];
  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeSkill = skills.find((s) => s.id === activeSkillId);
  const unreadNotifications = notifications.filter((n) => !n.read).length;

  // 1. Loading state while checking authentication session
  if (isAuthChecking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-orange-200 border-t-[#FF6B00] rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-400">Loading Cortex...</span>
        </div>
      </div>
    );
  }

  // 2. Dedicated Full-Page Login & Registration Screen if not authenticated
  if (!currentUser) {
    return (
      <AuthPage
        onLogin={handleLogin}
        onRegister={handleRegister}
        onSuccess={() => {}}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen bg-white text-slate-900 font-sans overflow-hidden select-none">
      {/* Full-width, full-height Application Container */}
      <div className="flex h-full w-full bg-white overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          currentUser={currentUser}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspace?.id}
          onSelectWorkspace={(ws) => {
            setActiveWorkspace(ws);
            setCurrentView('cowork');
          }}
          onNewWorkspace={() => setIsCreateProjectModalOpen(true)}
          onDeleteWorkspace={handleDeleteWorkspace}
          onSelectConversation={(id) => setActiveConversationId(id)}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onTogglePin={handleTogglePin}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenSettings={() => setIsNotificationsOpen(true)}
          onOpenExplore={() => setIsExploreOpen(true)}
          onOpenKnowledge={() => setIsKnowledgeOpen(true)}
          onOpenTemplates={() => setIsTemplatesOpen(true)}
          onLogout={handleLogout}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* Right Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
          {/* Top Bar Header */}
          <TopNav
            currentView={currentView}
            onNavigate={(view) => setCurrentView(view)}
            selectedModelName={activeModel?.displayName || 'Cortex Core v1'}
            selectedMode={selectedMode}
            onOpenModelModal={() => setIsModelModalOpen(true)}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
            onOpenShortcuts={() => setIsShortcutsOpen(true)}
            onOpenShareModal={() => setIsShareModalOpen(true)}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            unreadNotificationsCount={unreadNotifications}
          />

          {/* View Routing */}
          {currentView === 'chat' && (
            <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-white">
              {/* Active Skill Notice (Quiet inline banner) */}
              {activeSkill && (
                <div className="px-6 py-2 bg-orange-50/70 border-b border-orange-100 flex items-center justify-between text-xs text-orange-950">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>
                      Active Workflow Persona: <strong className="font-semibold text-slate-900">{activeSkill.name}</strong>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">({activeSkill.category})</span>
                  </div>
                  <button
                    onClick={() => setActiveSkillId(null)}
                    className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                  >
                    Deactivate
                  </button>
                </div>
              )}

              {/* Chat Header Actions Toolbar (Visible when conversation has messages) */}
              {activeConversation && messages.length > 0 && (
                <div className="px-6 py-2 border-b border-[#F0F2F4] flex items-center justify-between text-xs text-slate-500 bg-white shrink-0">
                  <span className="font-semibold text-slate-800 truncate max-w-[280px]">
                    {activeConversation.title || 'Chat'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportConversationToMarkdown(activeConversation, messages)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                      title="Export conversation as Markdown"
                    >
                      <FileText className="w-3 h-3 text-[#FF6B00]" />
                      <span>Export .md</span>
                    </button>
                    <button
                      onClick={() => exportConversationToJson(activeConversation, messages)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                      title="Export conversation as JSON"
                    >
                      <FileJson className="w-3 h-3 text-blue-500" />
                      <span>Export JSON</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Message List or Empty State */}
              <div className="flex-1 overflow-y-auto px-4 py-4 md:py-6 no-scrollbar min-h-0">
                {messages.length === 0 && !isStreaming ? (
                  /* Cognivo Empty State matching Image 1 & 3 pixel-by-pixel */
                  <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto py-2">
                    {/* Top Upgrade Plan Banner Pill */}
                    <div className="mb-8">
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF9F3] border border-[#FFE8D6] text-xs font-semibold text-[#D97706] shadow-2xs hover:bg-[#FFF3E8] transition-colors cursor-pointer">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
                        <span>Upgrade free plan to full access</span>
                      </div>
                    </div>

                    {/* Center Woven Logo & Headline */}
                    <div className="flex flex-col items-center text-center mb-7">
                      <CognivoLogo size={46} />
                      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-4 font-sans">
                        Let's start a smart conversation
                      </h1>
                    </div>

                    {/* Composer Card inside Empty Hero */}
                    <div className="w-full mb-6">
                      <ChatComposer
                        onSendMessage={handleSendMessage}
                        isStreaming={isStreaming}
                        onStopStreaming={handleStopStreaming}
                        selectedModelName={activeModel?.displayName || 'Cognivo Core v1'}
                        selectedMode={selectedMode}
                        onOpenModelModal={() => setIsModelModalOpen(true)}
                        onOpenUsageModal={() => setIsUsageModalOpen(true)}
                        showUpgradeBanner={true}
                      />
                    </div>

                    {/* 3-Column Action Cards */}
                    <div className="w-full max-w-3xl px-4 grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                      {/* Card 1: Summarize Text */}
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Summarize the key points of the following text in clean bullet points:\n\n', [])}
                        className="p-3.5 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#FF6B00]/60 hover:shadow-2xs transition-all text-left cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-1.5 text-slate-800">
                          <FileText className="w-4 h-4 text-slate-500 group-hover:text-[#FF6B00] transition-colors" />
                          <span className="text-xs font-bold text-slate-900">Summarize Text</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Turn long articles into easy summaries.
                        </p>
                      </button>

                      {/* Card 2: Creative Writing */}
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Generate an engaging, creative story or article pitch about:\n\n', [])}
                        className="p-3.5 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#FF6B00]/60 hover:shadow-2xs transition-all text-left cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-1.5 text-slate-800">
                          <PenLine className="w-4 h-4 text-slate-500 group-hover:text-[#FF6B00] transition-colors" />
                          <span className="text-xs font-bold text-slate-900">Creative Writing</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Generate stories, blog posts, or fresh content ideas in seconds.
                        </p>
                      </button>

                      {/* Card 3: Answer Questions */}
                      <button
                        type="button"
                        onClick={() => handleSendMessage('Answer the following technical question with deep factual accuracy:\n\n', [])}
                        className="p-3.5 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#FF6B00]/60 hover:shadow-2xs transition-all text-left cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-1.5 text-slate-800">
                          <Lightbulb className="w-4 h-4 text-slate-500 group-hover:text-[#FF6B00] transition-colors" />
                          <span className="text-xs font-bold text-slate-900">Answer Questions</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Ask me anything—from facts to advice—and get instant answers.
                        </p>
                      </button>
                    </div>

                    {/* Bottom Disclaimer and Language/Help Icons */}
                    <div className="w-full max-w-3xl px-4 flex items-center justify-between text-[11px] text-slate-400 mt-auto pt-4">
                      <div className="mx-auto text-center">
                        <span>Cortex can make mistakes. Check important info. </span>
                        <a href="#cookies" className="underline hover:text-slate-600 transition-colors">
                          See Cookie Preferences
                        </a>
                        .
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 shrink-0">
                        <button className="p-1 hover:text-slate-700 transition-colors cursor-pointer" title="Languages">
                          <Languages className="w-4 h-4" />
                        </button>
                        <button className="p-1 hover:text-slate-700 transition-colors cursor-pointer" title="Help">
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Active Chat Stream */
                  <div className="max-w-3xl mx-auto space-y-4 pb-6">
                    {messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        message={msg}
                        availableModels={models}
                        onRegenerate={
                          msg.role === 'assistant'
                            ? () => handleRegenerate(msg.id)
                            : undefined
                        }
                        onRegenerateWithModel={
                          msg.role === 'assistant'
                            ? (modelId) => handleRegenerate(msg.id, modelId)
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

              {/* Chat Composer pinned cleanly at bottom when conversation is active */}
              {messages.length > 0 && (
                <div className="shrink-0 pt-1.5 pb-2 bg-white border-t border-[#F0F2F4]">
                  <ChatComposer
                    onSendMessage={handleSendMessage}
                    isStreaming={isStreaming}
                    onStopStreaming={handleStopStreaming}
                    selectedModelName={activeModel?.displayName || 'Cortex Core v1'}
                    selectedMode={selectedMode}
                    onOpenModelModal={() => setIsModelModalOpen(true)}
                    onOpenUsageModal={() => setIsUsageModalOpen(true)}
                  />
                  <div className="text-center text-[11px] text-slate-400 mt-1">
                    Cortex can make mistakes. Check important info.
                  </div>
                </div>
              )}
            </main>
          )}

          {currentView === 'cowork' && (
            <CoworkWorkspace
              workspace={activeWorkspace}
              onRefreshWorkspace={loadInitialData}
              onSelectWorkspace={(ws) => setActiveWorkspace(ws)}
              onDeleteWorkspace={handleDeleteWorkspace}
            />
          )}

          {currentView === 'skills' && (
            <SkillsDrawer
              isOpen={currentView === 'skills'}
              skills={skills}
              activeSkillId={activeSkillId}
              onSelectSkill={(id) => setActiveSkillId(id)}
              onClose={() => setCurrentView('chat')}
            />
          )}

          {currentView === 'docs' && <DocsView />}
        </div>
      </div>

      {/* Modals & Dialogs */}
      <ModelSelectorModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        models={models}
        selectedModelId={selectedModelId}
        selectedMode={selectedMode}
        onSelectModel={(id) => setSelectedModelId(id)}
        onSelectMode={(mode) => setSelectedMode(mode)}
      />

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onCreateBlank={handleCreateBlankProject}
        onImportLocalFolder={handleImportLocalProject}
        onBindLocalPath={handleBindLocalProjectPath}
      />

      <NotificationModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        preferences={preferences}
        onRefresh={loadInitialData}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        conversationTitle={activeConversation?.title || 'Cortex AI Workspace Session'}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        onAction={(act) => {
          if (act === 'chat' || act === 'cowork' || act === 'skills' || act === 'docs') {
            setCurrentView(act);
          } else if (act === 'new_chat') {
            handleNewConversation();
          } else if (act === 'models') {
            setIsModelModalOpen(true);
          } else if (act === 'toggle_sidebar') {
            setIsSidebarCollapsed(!isSidebarCollapsed);
          }
        }}
      />

      <ExploreModal
        isOpen={isExploreOpen}
        onClose={() => setIsExploreOpen(false)}
        onSelectPrompt={(prompt) => {
          handleSendMessage(prompt, []);
        }}
      />

      <KnowledgeModal
        isOpen={isKnowledgeOpen}
        onClose={() => setIsKnowledgeOpen(false)}
      />

      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectPrompt={(prompt) => {
          handleSendMessage(prompt, []);
        }}
      />


      {/* User Profile Edit Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onProfileUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
        }}
      />

      {/* Antigravity-Style View Usage & Telemetry Modal */}
      <UsageModal
        isOpen={isUsageModalOpen}
        onClose={() => setIsUsageModalOpen(false)}
        activeConversationTitle={activeConversation?.title || 'Current Conversation'}
        activeModelName={activeModel?.displayName || 'Gemini 3.8 Flash'}
        contextWindowLimit={activeModel?.contextWindow || 1000000}
        messages={messages}
        selectedMode={selectedMode}
        onSelectMode={(mode) => setSelectedMode(mode)}
      />
    </div>
  );
}
