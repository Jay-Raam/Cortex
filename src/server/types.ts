export type ProviderId = 'gemini' | 'openrouter' | 'groq' | 'nvidia' | 'openai' | 'ollama' | 'custom';
export type ModelMode = 'efficient' | 'balanced' | 'powerful';
export type ModelAvailability = 'available' | 'degraded' | 'rate_limited' | 'unconfigured';

export interface ModelCapabilities {
  streaming: boolean;
  vision: boolean;
  toolCalling: boolean;
  reasoning: boolean;
}


export interface CustomModelEndpoint {
  id: string;
  userId: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  contextWindow?: number;
  isEnabled: boolean;
  lastHealthCheck?: string;
  healthStatus?: 'healthy' | 'unreachable' | 'untested';
  latencyMs?: number;
  createdAt: string;
}

export type PromptCategory = 'Engineering' | 'Architecture' | 'Debugging' | 'Security' | 'Quality' | 'Productivity' | 'Custom';

export interface PromptTemplateEntity {
  id: string;
  userId?: string;
  title: string;
  description: string;
  category: PromptCategory;
  prompt: string;
  tags?: string[];
  variables?: string[];
  isBuiltin: boolean;
  createdAt: string;
  updatedAt?: string;
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

export type PermissionMode = 'ask_every_change' | 'approve_plan' | 'session_edit';

export interface ProjectStackInfo {
  framework: string;
  hasTests: boolean;
  packageScripts: Record<string, string>;
  dependencies: Record<string, string>;
  configFiles: string[];
  entryPoints: string[];
}

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  description: string;
  projectRoot?: string;
  isLocalBinding?: boolean;
  gitBranch?: string;
  githubRepo?: string;
  githubUrl?: string;
  permissionMode?: PermissionMode;
  contextWindowPreference?: string; // 'auto' | '32k' | '64k' | '128k' | '200k' | '500k' | '1m'
  detectedStack?: ProjectStackInfo;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus =
  | 'queued'
  | 'planning'
  | 'running'
  | 'awaiting_approval'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface ApprovalRequest {
  id: string;
  taskId: string;
  stepId: string;
  workspaceId: string;
  tool: string;
  toolInput: Record<string, any>;
  reason: string;
  impactLevel: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
}

export interface WorkspaceFileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  updatedAt?: string;
  children?: WorkspaceFileNode[];
}

export interface ExecutionCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export interface WorkspaceCheckpoint {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  files: Array<{ path: string; content: string }>;
  createdAt: string;
}

export interface TaskExecutionEvent {
  taskId: string;
  eventId: string;
  type: string;
  payload: any;
  timestamp: string;
}

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
  operation?: 'create' | 'edit' | 'delete' | 'read' | 'command';
  targetPath?: string;
  createdAt: string;
  completedAt?: string;
}

export type SwarmAgentRole = 'architect' | 'developer' | 'reviewer';

export interface SwarmCollaborationEvent {
  id: string;
  role: SwarmAgentRole;
  agentName: string;
  modelId: string;
  avatarIcon: string;
  title: string;
  message: string;
  status: 'active' | 'completed' | 'flagged';
  timestamp: string;
  deliverables?: string[];
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
  permissionMode?: PermissionMode;
  isPlanApproved?: boolean;
  plannedFiles?: string[];
  steps: AgentTaskStep[];
  artifactIds: string[];
  summary?: string;
  error?: string;
  isSwarmMode?: boolean;
  swarmEvents?: SwarmCollaborationEvent[];
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
