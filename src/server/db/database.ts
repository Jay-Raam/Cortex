import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  Session,
  Conversation,
  Message,
  Skill,
  Workspace,
  WorkspaceArtifact,
  AgentTask,
  NotificationItem,
  NotificationPreferences,
  ApprovalRequest,
  WorkspaceCheckpoint,
  CustomModelEndpoint,
  PromptTemplateEntity,
} from '../types';


export interface ArenaVote {
  id: string;
  userId: string;
  prompt: string;
  modelA: string;
  modelB: string;
  winner: 'model_a' | 'model_b' | 'tie' | 'both_bad';
  latencyMsA?: number;
  latencyMsB?: number;
  createdAt: string;
}

interface DatabaseSchema {
  users: User[];
  sessions: Session[];
  conversations: Conversation[];
  messages: Message[];
  skills: Skill[];
  workspaces: Workspace[];
  artifacts: WorkspaceArtifact[];
  tasks: AgentTask[];
  approvals: ApprovalRequest[];
  checkpoints: WorkspaceCheckpoint[];
  notifications: NotificationItem[];
  preferences: NotificationPreferences[];
  arenaVotes?: ArenaVote[];
  customEndpoints?: CustomModelEndpoint[];
  promptTemplates?: PromptTemplateEntity[];
  workspaceSecrets?: EncryptedSecretRecord[];
}

export interface EncryptedSecretRecord {
  id: string;
  workspaceId: string;
  key: string;
  ciphertext: string;
  iv: string;
  tag: string;
  salt: string;
  maskedValue: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = process.env.CORTEX_DATA_DIR || path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'cortex_db.json');

const INITIAL_SKILLS: Skill[] = [
  {
    id: 'skill-software-engineer',
    name: 'Software Engineer',
    description: 'Full-stack software engineering, architecture design, TypeScript/Go/Python coding, and clean refactoring.',
    category: 'engineering',
    version: '1.2.0',
    instructions: 'You are a principal software engineer. Provide idiomatic, clean, modular code with production error handling, type safety, and clear docstrings. Avoid unnecessary dependencies.',
    allowedTools: ['workspace_list_files', 'workspace_read_file', 'workspace_create_artifact', 'workspace_edit_artifact', 'code_diff_analyzer'],
    icon: 'Terminal',
    isSystem: true,
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-code-reviewer',
    name: 'Code Reviewer',
    description: 'Rigorous static analysis, OWASP security audit, performance bottlenecks, and architectural critique.',
    category: 'engineering',
    version: '1.1.0',
    instructions: 'You are an adversarial senior code reviewer. Scrutinize code for security vulnerabilities, logic bugs, race conditions, memory leaks, and readability. Produce prioritized findings: High, Medium, Low.',
    allowedTools: ['workspace_read_file', 'code_diff_analyzer'],
    icon: 'ShieldCheck',
    isSystem: true,
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-technical-researcher',
    name: 'Technical Researcher',
    description: 'Literature synthesis, distributed systems research, benchmark analysis, and technological tradeoff matrices.',
    category: 'research',
    version: '1.0.0',
    instructions: 'You are a technical researcher. Provide thorough, objective analysis supported by algorithmic complexity, empirical measurements, and structural comparisons.',
    allowedTools: ['workspace_search', 'document_outline_generator'],
    icon: 'Search',
    isSystem: true,
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-document-analyst',
    name: 'Document Analyst',
    description: 'Deep document comprehension, contract analysis, structured summary extraction, and table parsing.',
    category: 'analysis',
    version: '1.0.0',
    instructions: 'You are a senior document analyst. Extract key executive takeaways, obligations, numerical figures, and discrepancies with high precision.',
    allowedTools: ['workspace_read_file', 'structured_data_extractor'],
    icon: 'FileText',
    isSystem: true,
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-data-analyst',
    name: 'Data Analyst',
    description: 'Exploratory data analysis, SQL query synthesis, statistical modeling, and CSV/JSON data transformation.',
    category: 'analysis',
    version: '1.1.0',
    instructions: 'You are a staff data analyst. Analyze distributions, detect anomalies, write performant SQL/pandas transformations, and communicate insights with quantitative clarity.',
    allowedTools: ['structured_data_extractor', 'workspace_create_artifact'],
    icon: 'BarChart2',
    isSystem: true,
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-technical-writer',
    name: 'Technical Writer',
    description: 'Clear API documentation, architecture decision records (ADRs), runbooks, and developer tutorials.',
    category: 'writing',
    version: '1.0.0',
    instructions: 'You are a principal technical writer. Write scannable, precise, jargon-free technical prose with concrete code snippets, parameters tables, and quickstarts.',
    allowedTools: ['workspace_create_artifact', 'workspace_edit_artifact'],
    icon: 'BookOpen',
    isSystem: true,
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-bug-investigator',
    name: 'Bug Investigator',
    description: 'Stack trace deconstruction, bisect analysis, root-cause isolation, and regression prevention testing.',
    category: 'engineering',
    version: '1.0.0',
    instructions: 'You are a debugging specialist. Formulate hypotheses, trace call graphs, examine state transitions, and produce minimal reproduction steps followed by the verified fix.',
    allowedTools: ['workspace_read_file', 'code_diff_analyzer', 'workspace_create_artifact'],
    icon: 'Bug',
    isSystem: true,
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-project-planner',
    name: 'Project Planner',
    description: 'Milestone decomposition, critical path analysis, dependency graphs, and engineering estimation.',
    category: 'productivity',
    version: '1.0.0',
    instructions: 'You are a technical product manager and project lead. Break down epics into actionable user stories with explicit acceptance criteria, sequencing, and risks.',
    allowedTools: ['document_outline_generator', 'workspace_create_artifact'],
    icon: 'Calendar',
    isSystem: true,
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const BUILTIN_PROMPT_TEMPLATES: PromptTemplateEntity[] = [
  {
    id: 'tmpl_code_review',
    title: 'Code Review & Security Audit',
    description: 'Thorough inspection for OWASP vulnerabilities, concurrency bugs, edge conditions, and performance bottlenecks.',
    category: 'Security',
    prompt: 'Review the following {{language}} code for security vulnerabilities, logic edge cases, and performance bottlenecks:\n\n```{{language}}\n{{code}}\n```',
    tags: ['security', 'review', 'audit', 'owasp'],
    variables: ['language', 'code'],
    isBuiltin: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'tmpl_system_design',
    title: 'System Architecture & Scalability Spec',
    description: 'Draft comprehensive high-level design (HLD) specifications with trade-off analysis, bottlenecks, and data model.',
    category: 'Architecture',
    prompt: 'Design an end-to-end distributed system architecture for {{service_name}} targeting {{scale_target}} with the following constraints: {{constraints}}.\nInclude:\n1. Component topology & sequence flow\n2. Storage and cache hierarchy\n3. Failure modes & graceful degradation\n4. Latency vs consistency trade-offs',
    tags: ['architecture', 'system-design', 'scalability', 'hld'],
    variables: ['service_name', 'scale_target', 'constraints'],
    isBuiltin: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'tmpl_root_cause_debug',
    title: 'Root-Cause Debugger & Stack Trace Analyzer',
    description: 'Diagnose runtime errors, unhandled rejections, race conditions, and provide verified patches.',
    category: 'Debugging',
    prompt: 'Help diagnose this error. Here is the traceback and code snippet:\n\nError:\n{{error_message}}\n\nSnippet:\n```\n{{code_snippet}}\n```\nProvide root-cause analysis, reproducible test case, and verified fix.',
    tags: ['debugging', 'traceback', 'fix', 'error'],
    variables: ['error_message', 'code_snippet'],
    isBuiltin: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'tmpl_clean_refactor',
    title: 'Clean Code & SOLID Refactoring Engine',
    description: 'Refactor complex code smells into modular, testable, typed patterns following SOLID and clean architecture.',
    category: 'Quality',
    prompt: 'Refactor this {{language}} implementation to eliminate code smells and improve maintainability:\n\n```{{language}}\n{{target_code}}\n```\nFollow strict type safety, modular dependency inversion, and preserve original behavioral semantics.',
    tags: ['refactoring', 'clean-code', 'solid', 'types'],
    variables: ['language', 'target_code'],
    isBuiltin: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'tmpl_sql_optimizer',
    title: 'SQL Query Plan & Index Optimizer',
    description: 'Analyze query execution plans, indexes, partition pruning, and rewrite queries to minimize scans.',
    category: 'Engineering',
    prompt: 'Analyze and optimize this {{dialect}} SQL query for maximum throughput and low latency:\n\n```sql\n{{query}}\n```\nExisting table indexes:\n{{indexes}}\nExplain execution plan changes, composite indexes, and index selectivity improvements.',
    tags: ['sql', 'database', 'performance', 'indexing'],
    variables: ['dialect', 'query', 'indexes'],
    isBuiltin: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'tmpl_unit_tests',
    title: 'Unit Test Suite & Mock Generator',
    description: 'Generate high-coverage unit tests including boundary cases, error branches, and mock fixtures.',
    category: 'Engineering',
    prompt: 'Generate an exhaustive test suite using {{framework}} for the following code:\n\n```\n{{code}}\n```\nCover happy path, boundary edge cases, null/undefined inputs, and async error rejections.',
    tags: ['testing', 'unit-tests', 'coverage', 'mocks'],
    variables: ['framework', 'code'],
    isBuiltin: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'tmpl_executive_summary',
    title: 'Executive Technical Summary & Action Items',
    description: 'Synthesize complex technical proposals, incident post-mortems, or architecture RFCs into executive briefs.',
    category: 'Productivity',
    prompt: 'Synthesize the following document into a concise executive briefing with key decisions, risk assessment, and immediate action items:\n\n{{document_text}}',
    tags: ['summary', 'executive', 'action-items', 'rfcs'],
    variables: ['document_text'],
    isBuiltin: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
];

class Database {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = this.loadData();
    this.ensureSeedData();
  }

  private loadData(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || [],
          sessions: parsed.sessions || [],
          conversations: parsed.conversations || [],
          messages: parsed.messages || [],
          skills: parsed.skills || [...INITIAL_SKILLS],
          workspaces: parsed.workspaces || [],
          artifacts: parsed.artifacts || [],
          tasks: parsed.tasks || [],
          approvals: parsed.approvals || [],
          checkpoints: parsed.checkpoints || [],
          notifications: parsed.notifications || [],
          preferences: parsed.preferences || [],
          customEndpoints: parsed.customEndpoints || [],
          promptTemplates: parsed.promptTemplates || [],
          workspaceSecrets: parsed.workspaceSecrets || [],
        };
      }
    } catch (err) {
      console.error('Error loading database file, initializing clean database:', err);
    }
    return {
      users: [],
      sessions: [],
      conversations: [],
      messages: [],
      skills: [...INITIAL_SKILLS],
      workspaces: [],
      artifacts: [],
      tasks: [],
      approvals: [],
      checkpoints: [],
      notifications: [],
      preferences: [],
      workspaceSecrets: [],
    };
  }

  private ensureSeedData() {
    // Only seed an initial admin user if explicitly configured via environment variables
    const adminEmail = process.env.CORTEX_ADMIN_EMAIL?.trim();
    const adminPassword = process.env.CORTEX_ADMIN_PASSWORD?.trim();
    const adminName = process.env.CORTEX_ADMIN_NAME?.trim() || "System Administrator";

    if (this.data.users.length === 0 && adminEmail && adminPassword) {
      const adminUser: User = {
        id: `usr_admin_${Date.now()}`,
        email: adminEmail,
        name: adminName,
        passwordHash: bcrypt.hashSync(adminPassword, 10),
        role: "admin",
        createdAt: new Date().toISOString(),
      };
      this.data.users.push(adminUser);

      // Create default workspace for initial admin
      const defaultWorkspace: Workspace = {
        id: `ws_default_${Date.now()}`,
        userId: adminUser.id,
        name: "General Engineering Workspace",
        description: "Default agentic co-work environment for system design, artifacts, and multi-model workflows.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.data.workspaces.push(defaultWorkspace);
      this.persist();
    }

        // Ensure skills are present
    if (!this.data.skills || this.data.skills.length === 0) {
      this.data.skills = [...INITIAL_SKILLS];
      this.persist();
    }
  }

  persistSync() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempFile = `${DATA_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DATA_FILE);
    } catch (err) {
      console.error('Failed to write database file synchronously:', err);
    }
  }

  private persist() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const tempFile = `${DATA_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
        fs.renameSync(tempFile, DATA_FILE);
      } catch (err) {
        console.error('Failed to write database file:', err);
      }
    }, 100);
  }

  // --- Users & Auth ---
  getUsers(): User[] {
    return [...this.data.users];
  }

  getUserCount(): number {
    return this.data.users.length;
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(user: User): User {
    this.data.users.push(user);
    this.persist();
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const userIndex = this.data.users.findIndex((u) => u.id === id);
    if (userIndex === -1) return undefined;
    this.data.users[userIndex] = { ...this.data.users[userIndex], ...updates };
    this.persist();
    return this.data.users[userIndex];
  }

  createSession(session: Session): Session {
    this.data.sessions = this.data.sessions.filter((s) => s.expiresAt > Date.now());
    this.data.sessions.push(session);
    this.persist();
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.data.sessions.find((s) => s.id === id && s.expiresAt > Date.now());
  }

  deleteSession(id: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.id !== id);
    this.persist();
  }

  deleteUserSessions(userId: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    this.persist();
  }

  // --- Conversations ---
  getConversations(userId: string, search?: string, limit = 50): Conversation[] {
    let list = this.data.conversations.filter((c) => c.userId === userId && !c.isArchived);
    if (search && search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    // Sort pinned first, then newest updated
    return list
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, limit);
  }

  getConversationById(id: string, userId: string): Conversation | undefined {
    return this.data.conversations.find((c) => c.id === id && c.userId === userId);
  }

  createConversation(conv: Conversation): Conversation {
    this.data.conversations.unshift(conv);
    this.persist();
    return conv;
  }

  updateConversation(
    id: string,
    userId: string,
    updates: Partial<Pick<Conversation, 'title' | 'modelId' | 'providerId' | 'mode' | 'skillId' | 'isPinned' | 'isArchived'>>
  ): Conversation | undefined {
    const conv = this.getConversationById(id, userId);
    if (!conv) return undefined;
    Object.assign(conv, updates, { updatedAt: new Date().toISOString() });
    this.persist();
    return conv;
  }

  deleteConversation(id: string, userId: string): boolean {
    const conv = this.getConversationById(id, userId);
    if (!conv) return false;
    this.data.conversations = this.data.conversations.filter((c) => c.id !== id);
    this.data.messages = this.data.messages.filter((m) => m.conversationId !== id);
    this.persist();
    return true;
  }

  // --- Messages ---
  getMessages(conversationId: string, userId: string): Message[] {
    const conv = this.getConversationById(conversationId, userId);
    if (!conv) return [];
    return this.data.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  addMessage(msg: Message, userId: string): Message {
    const conv = this.getConversationById(msg.conversationId, userId);
    if (!conv) throw new Error('Unauthorized or conversation not found');
    this.data.messages.push(msg);
    conv.updatedAt = new Date().toISOString();
    this.persist();
    return msg;
  }

  updateMessage(id: string, content: string, userId: string): Message | undefined {
    const msg = this.data.messages.find((m) => m.id === id);
    if (!msg) return undefined;
    const conv = this.getConversationById(msg.conversationId, userId);
    if (!conv) return undefined;
    msg.content = content;
    this.persist();
    return msg;
  }

  // --- Skills ---
  getSkills(): Skill[] {
    return this.data.skills;
  }

  getSkillById(id: string): Skill | undefined {
    return this.data.skills.find((s) => s.id === id);
  }

  createSkill(skill: Skill): Skill {
    this.data.skills.push(skill);
    this.persist();
    return skill;
  }

  updateSkill(id: string, updates: Partial<Skill>): Skill | undefined {
    const skill = this.getSkillById(id);
    if (!skill) return undefined;
    Object.assign(skill, updates, { updatedAt: new Date().toISOString() });
    this.persist();
    return skill;
  }

  // --- Workspaces ---
  getWorkspaces(userId: string): Workspace[] {
    return this.data.workspaces.filter((w) => w.userId === userId);
  }

  getWorkspaceById(id: string, userId: string): Workspace | undefined {
    return this.data.workspaces.find((w) => w.id === id && w.userId === userId);
  }

  createWorkspace(workspace: Workspace): Workspace {
    this.data.workspaces.push(workspace);
    this.persist();
    return workspace;
  }

  updateWorkspace(id: string, userId: string, updates: Partial<Workspace>): Workspace | undefined {
    const ws = this.getWorkspaceById(id, userId);
    if (!ws) return undefined;
    Object.assign(ws, updates, { updatedAt: new Date().toISOString() });
    this.persist();
    return ws;
  }

  deleteWorkspace(id: string, userId: string): boolean {
    const ws = this.getWorkspaceById(id, userId);
    if (!ws) return false;
    this.data.workspaces = this.data.workspaces.filter((w) => !(w.id === id && w.userId === userId));
    this.data.artifacts = this.data.artifacts.filter((a) => a.workspaceId !== id);
    this.data.tasks = this.data.tasks.filter((t) => t.workspaceId !== id);
    this.data.checkpoints = this.data.checkpoints.filter((c) => c.workspaceId !== id);
    this.persist();
    return true;
  }

  // --- Artifacts ---
  getArtifacts(workspaceId: string, userId: string): WorkspaceArtifact[] {
    const ws = this.getWorkspaceById(workspaceId, userId);
    if (!ws) return [];
    return this.data.artifacts.filter((a) => a.workspaceId === workspaceId);
  }

  getArtifactById(id: string, userId: string): WorkspaceArtifact | undefined {
    const artifact = this.data.artifacts.find((a) => a.id === id);
    if (!artifact) return undefined;
    const ws = this.getWorkspaceById(artifact.workspaceId, userId);
    if (!ws) return undefined;
    return artifact;
  }

  createArtifact(artifact: WorkspaceArtifact, userId: string): WorkspaceArtifact {
    const ws = this.getWorkspaceById(artifact.workspaceId, userId);
    if (!ws) throw new Error('Unauthorized or workspace not found');
    this.data.artifacts.push(artifact);
    this.persist();
    return artifact;
  }

  updateArtifact(id: string, content: string, userId: string): WorkspaceArtifact | undefined {
    const art = this.getArtifactById(id, userId);
    if (!art) return undefined;
    art.content = content;
    art.version += 1;
    art.updatedAt = new Date().toISOString();
    this.persist();
    return art;
  }

  // --- Agent Tasks ---
  getTasks(workspaceId: string, userId: string): AgentTask[] {
    const ws = this.getWorkspaceById(workspaceId, userId);
    if (!ws) return [];
    return this.data.tasks
      .filter((t) => t.workspaceId === workspaceId && t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getTaskById(id: string, userId: string): AgentTask | undefined {
    return this.data.tasks.find((t) => t.id === id && t.userId === userId);
  }

  createTask(task: AgentTask): AgentTask {
    this.data.tasks.unshift(task);
    this.persist();
    return task;
  }

  updateTask(id: string, userId: string, updates: Partial<AgentTask>): AgentTask | undefined {
    const task = this.getTaskById(id, userId);
    if (!task) return undefined;
    Object.assign(task, updates, { updatedAt: new Date().toISOString() });
    this.persist();
    return task;
  }

  // --- Notifications ---
  getNotifications(userId: string): NotificationItem[] {
    return this.data.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  addNotification(item: NotificationItem): NotificationItem {
    this.data.notifications.unshift(item);
    this.persist();
    return item;
  }

  markNotificationRead(id: string, userId: string): boolean {
    const notif = this.data.notifications.find((n) => n.id === id && n.userId === userId);
    if (!notif) return false;
    notif.read = true;
    this.persist();
    return true;
  }

  markAllNotificationsRead(userId: string): void {
    for (const n of this.data.notifications) {
      if (n.userId === userId) n.read = true;
    }
    this.persist();
  }

  getPreferences(userId: string): NotificationPreferences {
    let pref = this.data.preferences.find((p) => p.userId === userId);
    if (!pref) {
      pref = {
        userId,
        emailEnabled: true,
        pushEnabled: true,
        whatsappEnabled: false,
      };
      this.data.preferences.push(pref);
      this.persist();
    }
    return pref;
  }

  updatePreferences(userId: string, updates: Partial<NotificationPreferences>): NotificationPreferences {
    const pref = this.getPreferences(userId);
    Object.assign(pref, updates);
    this.persist();
    return pref;
  }

  // --- Approval Requests ---
  getApprovalRequests(taskId: string): ApprovalRequest[] {
    return this.data.approvals.filter((a) => a.taskId === taskId);
  }

  getApprovalById(id: string): ApprovalRequest | undefined {
    return this.data.approvals.find((a) => a.id === id);
  }

  createApprovalRequest(approval: ApprovalRequest): ApprovalRequest {
    this.data.approvals.unshift(approval);
    this.persist();
    return approval;
  }

  updateApprovalRequest(id: string, status: 'approved' | 'rejected'): ApprovalRequest | undefined {
    const approval = this.getApprovalById(id);
    if (!approval) return undefined;
    approval.status = status;
    approval.resolvedAt = new Date().toISOString();
    this.persist();
    return approval;
  }

  // --- Checkpoints ---
  getCheckpoints(workspaceId: string): WorkspaceCheckpoint[] {
    return this.data.checkpoints
      .filter((c) => c.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getCheckpointById(id: string): WorkspaceCheckpoint | undefined {
    return this.data.checkpoints.find((c) => c.id === id);
  }


  addArenaVote(vote: ArenaVote): ArenaVote {
    if (!this.data.arenaVotes) this.data.arenaVotes = [];
    this.data.arenaVotes.push(vote);
    this.persist();
    return vote;
  }

  getArenaVotes(userId: string): ArenaVote[] {
    if (!this.data.arenaVotes) return [];
    return this.data.arenaVotes.filter((v) => v.userId === userId);
  }


  // --- Custom Model Endpoints ---
  getCustomEndpoints(userId: string): CustomModelEndpoint[] {
    if (!this.data.customEndpoints) return [];
    return this.data.customEndpoints.filter((e) => e.userId === userId);
  }

  getCustomEndpointById(id: string, userId?: string): CustomModelEndpoint | undefined {
    if (!this.data.customEndpoints) return undefined;
    return this.data.customEndpoints.find((e) => e.id === id && (!userId || e.userId === userId));
  }

  saveCustomEndpoint(endpoint: CustomModelEndpoint): CustomModelEndpoint {
    if (!this.data.customEndpoints) this.data.customEndpoints = [];
    const idx = this.data.customEndpoints.findIndex((e) => e.id === endpoint.id && e.userId === endpoint.userId);
    if (idx >= 0) {
      this.data.customEndpoints[idx] = endpoint;
    } else {
      this.data.customEndpoints.push(endpoint);
    }
    this.persist();
    return endpoint;
  }

  deleteCustomEndpoint(id: string, userId: string): boolean {
    if (!this.data.customEndpoints) return false;
    const initialLen = this.data.customEndpoints.length;
    this.data.customEndpoints = this.data.customEndpoints.filter((e) => !(e.id === id && e.userId === userId));
    const deleted = this.data.customEndpoints.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  // --- Prompt Templates & Personas ---
  getPromptTemplates(userId: string): PromptTemplateEntity[] {
    const custom = (this.data.promptTemplates || []).filter((t) => t.userId === userId);
    return [...BUILTIN_PROMPT_TEMPLATES, ...custom];
  }

  getPromptTemplateById(id: string, userId: string): PromptTemplateEntity | undefined {
    const builtin = BUILTIN_PROMPT_TEMPLATES.find((t) => t.id === id);
    if (builtin) return builtin;
    return (this.data.promptTemplates || []).find((t) => t.id === id && t.userId === userId);
  }

  savePromptTemplate(template: PromptTemplateEntity): PromptTemplateEntity {
    if (!this.data.promptTemplates) this.data.promptTemplates = [];
    const idx = this.data.promptTemplates.findIndex((t) => t.id === template.id && t.userId === template.userId);
    if (idx >= 0) {
      this.data.promptTemplates[idx] = template;
    } else {
      this.data.promptTemplates.unshift(template);
    }
    this.persist();
    return template;
  }

  deletePromptTemplate(id: string, userId: string): boolean {
    if (!this.data.promptTemplates) return false;
    const initialLen = this.data.promptTemplates.length;
    this.data.promptTemplates = this.data.promptTemplates.filter((t) => !(t.id === id && t.userId === userId && !t.isBuiltin));
    const deleted = this.data.promptTemplates.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  // --- Workspace Secrets Vault ---
  getWorkspaceSecrets(workspaceId: string): EncryptedSecretRecord[] {
    return (this.data.workspaceSecrets || []).filter((s) => s.workspaceId === workspaceId);
  }

  getWorkspaceSecret(workspaceId: string, key: string): EncryptedSecretRecord | undefined {
    return (this.data.workspaceSecrets || []).find(
      (s) => s.workspaceId === workspaceId && s.key.toUpperCase() === key.toUpperCase()
    );
  }

  saveWorkspaceSecret(record: EncryptedSecretRecord): EncryptedSecretRecord {
    if (!this.data.workspaceSecrets) this.data.workspaceSecrets = [];
    const idx = this.data.workspaceSecrets.findIndex(
      (s) => s.workspaceId === record.workspaceId && s.key.toUpperCase() === record.key.toUpperCase()
    );
    if (idx >= 0) {
      this.data.workspaceSecrets[idx] = {
        ...this.data.workspaceSecrets[idx],
        ...record,
        updatedAt: new Date().toISOString(),
      };
      this.persist();
      return this.data.workspaceSecrets[idx];
    } else {
      this.data.workspaceSecrets.push(record);
      this.persist();
      return record;
    }
  }

  deleteWorkspaceSecret(workspaceId: string, key: string): boolean {
    if (!this.data.workspaceSecrets) return false;
    const initialLen = this.data.workspaceSecrets.length;
    this.data.workspaceSecrets = this.data.workspaceSecrets.filter(
      (s) => !(s.workspaceId === workspaceId && s.key.toUpperCase() === key.toUpperCase())
    );
    const deleted = this.data.workspaceSecrets.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  createCheckpoint(ckpt: WorkspaceCheckpoint): WorkspaceCheckpoint {
    this.data.checkpoints.unshift(ckpt);
    this.persist();
    return ckpt;
  }
}

export const db = new Database();
