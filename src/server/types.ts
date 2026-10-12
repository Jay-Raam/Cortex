export type ProviderId = 'gemini' | 'openrouter' | 'groq' | 'nvidia' | 'openai';
export type ModelMode = 'efficient' | 'balanced' | 'powerful';
export type ModelAvailability = 'available' | 'degraded' | 'rate_limited' | 'unconfigured';

export interface ModelCapabilities {
  streaming: boolean;
  vision: boolean;
  toolCalling: boolean;
  reasoning: boolean;
}

export interface ModelInfo {
  id: string;
  providerId: ProviderId;
  displayName: string;
  description: string;
  mode: ModelMode;
  isFree: boolean;
  pricingDescription: string;
  contextWindow: number;
  capabilities: ModelCapabilities;
  availability: ModelAvailability;
  lastChecked: string;
  latencyMs: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'user' | 'admin';
  avatar?: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: number;
  userAgent?: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  toolCalls?: Array<{
    name: string;
    args: Record<string, any>;
    result?: string;
  }>;
  modelUsed?: string;
  providerUsed?: ProviderId;
  isError?: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  modelId: string;
  providerId: ProviderId;
  mode: ModelMode;
  skillId?: string;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'engineering' | 'analysis' | 'research' | 'writing' | 'productivity';
  version: string;
  instructions: string;
  inputSchema?: Record<string, any>;
  allowedTools: string[];
  icon: string;
  isSystem: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceArtifact {
  id: string;
  workspaceId: string;
  title: string;
  fileName: string;
  language: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentTaskStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_approval';
  tool?: string;
  toolInput?: Record<string, any>;
  toolOutput?: Record<string, any>;
  requiresApproval?: boolean;
  isApproved?: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface AgentTask {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  goal: string;
  constraints?: string;
  desiredOutput?: string;
  status: TaskStatus;
  modelId: string;
  skillId?: string;
  steps: AgentTaskStep[];
  artifactIds: string[];
  summary?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  channel: 'in_app' | 'push' | 'email' | 'whatsapp';
  type: 'task_completed' | 'security_alert' | 'quota_warning' | 'system';
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}
