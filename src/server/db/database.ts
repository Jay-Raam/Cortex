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
} from '../types';

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
    };
  }

  private ensureSeedData() {
    // If no users exist, create default developer user
    if (this.data.users.length === 0) {
      const devUser: User = {
        id: 'usr_dev_primary',
        email: 'developer@nexa.ai',
        name: 'Nexa Lead Architect',
        passwordHash: bcrypt.hashSync('nexa1234!', 10),
        role: 'admin',
        createdAt: new Date().toISOString(),
      };
      this.data.users.push(devUser);

      // Create default workspace
      const defaultWorkspace: Workspace = {
        id: 'ws_default_01',
        userId: devUser.id,
        name: 'General Engineering Workspace',
        description: 'Default agentic co-work environment for system design, artifacts, and multi-model workflows.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.data.workspaces.push(defaultWorkspace);

      // Create initial artifact
      const sampleArtifact: WorkspaceArtifact = {
        id: 'art_arch_01',
        workspaceId: defaultWorkspace.id,
        title: 'Nexa AI Architecture Spec',
        fileName: 'architecture.md',
        language: 'markdown',
        content: `# Nexa AI Architecture Specification\n\nNexa AI provides multi-model routing, persistent state, and an agentic Co-Work engine.\n\n- **Efficient Mode**: Sub-second latency models for quick queries\n- **Balanced Mode**: Well-rounded models for development & reasoning\n- **Powerful Mode**: Frontier reasoning models with deep reflection\n\nZero-Cost routing ensures users are never charged unless explicitly opting into premium tiers.`,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.data.artifacts.push(sampleArtifact);

      // Create initial conversation
      const welcomeConv: Conversation = {
        id: 'conv_welcome_01',
        userId: devUser.id,
        title: 'Welcome to Nexa AI Platform',
        modelId: 'gemini-3.8-flash',
        providerId: 'gemini',
        mode: 'balanced',
        isPinned: true,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.data.conversations.push(welcomeConv);

      this.data.messages.push({
        id: 'msg_welcome_01',
        conversationId: welcomeConv.id,
        role: 'assistant',
        content: `Welcome to **Nexa AI** — your next-generation multi-model AI chat & Co-Work platform.\n\nHere is what you can do:\n1. **Multi-Model Routing**: Switch seamlessly between **Efficient**, **Balanced**, and **Powerful** modes, or manually select your favorite model (Gemini, OpenRouter, Groq, NVIDIA NIM).\n2. **Free-First Policy**: Zero-cost models are prioritized with honest status monitoring.\n3. **Agentic Co-Work**: Open the **Co-Work** workspace to delegate multi-step software tasks with real tools, step planning, approval gates, and artifact generation.\n4. **Skills System**: Activate specialized personas like **Software Engineer**, **Code Reviewer**, or **Data Analyst**.\n\nHow can I help you build today?`,
        modelUsed: 'gemini-3.8-flash',
        providerUsed: 'gemini',
        createdAt: new Date().toISOString(),
      });

      // Default notifications
      this.data.notifications.push({
        id: 'notif_welcome',
        userId: devUser.id,
        title: 'Welcome to Nexa AI',
        message: 'Your multi-model routing gateway and agentic Co-Work workspace are active.',
        channel: 'in_app',
        type: 'system',
        read: false,
        createdAt: new Date().toISOString(),
      });

      this.persist();
    }

    // Ensure skills are present
    if (!this.data.skills || this.data.skills.length === 0) {
      this.data.skills = [...INITIAL_SKILLS];
      this.persist();
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

  createCheckpoint(ckpt: WorkspaceCheckpoint): WorkspaceCheckpoint {
    this.data.checkpoints.unshift(ckpt);
    this.persist();
    return ckpt;
  }
}

export const db = new Database();
