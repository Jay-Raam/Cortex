import { createSchema } from 'graphql-yoga';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { modelCatalog } from '../providers/catalog';
import { generateTokens } from '../auth/auth';
import { coworkEngine } from '../cowork/engine';
import { User, Conversation, Message, Workspace, WorkspaceArtifact, AgentTask } from '../types';

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type User {
      id: ID!
      email: String!
      name: String!
      role: String!
      createdAt: String!
    }

    type AuthPayload {
      token: String!
      refreshToken: String!
      user: User!
    }

    type ModelCapabilities {
      streaming: Boolean!
      vision: Boolean!
      toolCalling: Boolean!
      reasoning: Boolean!
    }

    type ModelInfo {
      id: ID!
      providerId: String!
      displayName: String!
      description: String!
      mode: String!
      isFree: Boolean!
      pricingDescription: String!
      contextWindow: Int!
      capabilities: ModelCapabilities!
      availability: String!
      lastChecked: String!
      latencyMs: Int!
    }

    type Attachment {
      id: ID!
      name: String!
      size: Int!
      mimeType: String!
      url: String!
      createdAt: String!
    }

    type Message {
      id: ID!
      conversationId: ID!
      role: String!
      content: String!
      attachments: [Attachment!]
      modelUsed: String
      providerUsed: String
      isError: Boolean
      createdAt: String!
    }

    type Conversation {
      id: ID!
      title: String!
      modelId: String!
      providerId: String!
      mode: String!
      skillId: String
      isPinned: Boolean!
      isArchived: Boolean!
      createdAt: String!
      updatedAt: String!
      messages: [Message!]!
    }

    type Skill {
      id: ID!
      name: String!
      description: String!
      category: String!
      version: String!
      instructions: String!
      allowedTools: [String!]!
      icon: String!
      isSystem: Boolean!
      isEnabled: Boolean!
    }

    type WorkspaceArtifact {
      id: ID!
      workspaceId: ID!
      title: String!
      fileName: String!
      language: String!
      content: String!
      version: Int!
      createdAt: String!
      updatedAt: String!
    }

    type Workspace {
      id: ID!
      name: String!
      description: String!
      createdAt: String!
      updatedAt: String!
      artifacts: [WorkspaceArtifact!]!
    }

    type AgentTaskStep {
      id: ID!
      title: String!
      description: String!
      status: String!
      tool: String
      requiresApproval: Boolean
      isApproved: Boolean
      createdAt: String!
      completedAt: String
    }

    type AgentTask {
      id: ID!
      workspaceId: ID!
      title: String!
      goal: String!
      constraints: String
      desiredOutput: String
      status: String!
      modelId: String!
      skillId: String
      steps: [AgentTaskStep!]!
      artifactIds: [String!]!
      summary: String
      error: String
      createdAt: String!
      updatedAt: String!
    }

    type NotificationItem {
      id: ID!
      title: String!
      message: String!
      channel: String!
      type: String!
      read: Boolean!
      createdAt: String!
    }

    type NotificationPreferences {
      userId: ID!
      emailEnabled: Boolean!
      pushEnabled: Boolean!
      whatsappEnabled: Boolean!
      quietHoursStart: String
      quietHoursEnd: String
    }

    type Query {
      me: User
      models: [ModelInfo!]!
      conversations(search: String, limit: Int): [Conversation!]!
      conversation(id: ID!): Conversation
      skills: [Skill!]!
      skill(id: ID!): Skill
      workspaces: [Workspace!]!
      workspace(id: ID!): Workspace
      artifacts(workspaceId: ID!): [WorkspaceArtifact!]!
      artifact(id: ID!): WorkspaceArtifact
      agentTasks(workspaceId: ID!): [AgentTask!]!
      agentTask(id: ID!): AgentTask
      notifications: [NotificationItem!]!
      notificationPreferences: NotificationPreferences!
    }

    type Mutation {
      register(email: String!, name: String!, password: String!): AuthPayload!
      login(email: String!, password: String!): AuthPayload!
      createConversation(title: String!, modelId: String!, mode: String, skillId: String): Conversation!
      updateConversation(id: ID!, title: String, isPinned: Boolean, isArchived: Boolean): Conversation!
      deleteConversation(id: ID!): Boolean!
      createMessage(conversationId: ID!, content: String!, role: String!): Message!
      createWorkspace(name: String!, description: String!): Workspace!
      createArtifact(workspaceId: ID!, title: String!, fileName: String!, language: String!, content: String!): WorkspaceArtifact!
      updateArtifact(id: ID!, content: String!): WorkspaceArtifact!
      createAgentTask(workspaceId: ID!, title: String!, goal: String!, constraints: String, desiredOutput: String, modelId: String, skillId: String): AgentTask!
      advanceAgentTask(taskId: ID!): AgentTask!
      approveAgentTaskStep(taskId: ID!, stepId: ID!): AgentTask!
      cancelAgentTask(taskId: ID!): AgentTask!
      markNotificationRead(id: ID!): Boolean!
      markAllNotificationsRead: Boolean!
      updateNotificationPreferences(emailEnabled: Boolean, pushEnabled: Boolean, whatsappEnabled: Boolean): NotificationPreferences!
    }
  `,
  resolvers: {
    Query: {
      me: (_: any, __: any, context: { user: User }) => {
        return context.user || null;
      },
      models: () => {
        return modelCatalog.getModels();
      },
      conversations: (_: any, args: { search?: string; limit?: number }, context: { user: User }) => {
        if (!context.user) return [];
        return db.getConversations(context.user.id, args.search, args.limit);
      },
      conversation: (_: any, args: { id: string }, context: { user: User }) => {
        if (!context.user) return null;
        return db.getConversationById(args.id, context.user.id) || null;
      },
      skills: () => {
        return db.getSkills();
      },
      skill: (_: any, args: { id: string }) => {
        return db.getSkillById(args.id) || null;
      },
      workspaces: (_: any, __: any, context: { user: User }) => {
        if (!context.user) return [];
        return db.getWorkspaces(context.user.id);
      },
      workspace: (_: any, args: { id: string }, context: { user: User }) => {
        if (!context.user) return null;
        return db.getWorkspaceById(args.id, context.user.id) || null;
      },
      artifacts: (_: any, args: { workspaceId: string }, context: { user: User }) => {
        if (!context.user) return [];
        return db.getArtifacts(args.workspaceId, context.user.id);
      },
      artifact: (_: any, args: { id: string }, context: { user: User }) => {
        if (!context.user) return null;
        return db.getArtifactById(args.id, context.user.id) || null;
      },
      agentTasks: (_: any, args: { workspaceId: string }, context: { user: User }) => {
        if (!context.user) return [];
        return db.getTasks(args.workspaceId, context.user.id);
      },
      agentTask: (_: any, args: { id: string }, context: { user: User }) => {
        if (!context.user) return null;
        return db.getTaskById(args.id, context.user.id) || null;
      },
      notifications: (_: any, __: any, context: { user: User }) => {
        if (!context.user) return [];
        return db.getNotifications(context.user.id);
      },
      notificationPreferences: (_: any, __: any, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        return db.getPreferences(context.user.id);
      },
    },
    Conversation: {
      messages: (parent: Conversation, _: any, context: { user: User }) => {
        if (!context.user) return [];
        return db.getMessages(parent.id, context.user.id);
      },
    },
    Workspace: {
      artifacts: (parent: Workspace, _: any, context: { user: User }) => {
        if (!context.user) return [];
        return db.getArtifacts(parent.id, context.user.id);
      },
    },
    Mutation: {
      register: (_: any, args: { email: string; name: string; password: string }) => {
        const existing = db.getUserByEmail(args.email);
        if (existing) {
          throw new Error('An account with this email already exists.');
        }

        const newUser: User = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          email: args.email,
          name: args.name,
          passwordHash: bcrypt.hashSync(args.password, 10),
          role: 'user',
          createdAt: new Date().toISOString(),
        };

        db.createUser(newUser);

        // Create default workspace for new user
        db.createWorkspace({
          id: `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId: newUser.id,
          name: 'Primary Workspace',
          description: 'Default personal workspace for tasks, documents, and code artifacts.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        const { accessToken, refreshToken } = generateTokens(newUser);
        return { token: accessToken, refreshToken, user: newUser };
      },

      login: (_: any, args: { email: string; password: string }) => {
        const user = db.getUserByEmail(args.email);
        if (!user || !bcrypt.compareSync(args.password, user.passwordHash)) {
          throw new Error('Invalid email or password.');
        }

        const { accessToken, refreshToken } = generateTokens(user);
        return { token: accessToken, refreshToken, user };
      },

      createConversation: (_: any, args: { title: string; modelId: string; mode?: string; skillId?: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        const model = modelCatalog.getModelById(args.modelId) || modelCatalog.getModels()[0];
        const newConv: Conversation = {
          id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId: context.user.id,
          title: args.title || 'New Conversation',
          modelId: model.id,
          providerId: model.providerId,
          mode: (args.mode as any) || model.mode,
          skillId: args.skillId,
          isPinned: false,
          isArchived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return db.createConversation(newConv);
      },

      updateConversation: (_: any, args: { id: string; title?: string; isPinned?: boolean; isArchived?: boolean }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        const updated = db.updateConversation(args.id, context.user.id, {
          title: args.title,
          isPinned: args.isPinned,
          isArchived: args.isArchived,
        });
        if (!updated) throw new Error('Conversation not found or access denied');
        return updated;
      },

      deleteConversation: (_: any, args: { id: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        return db.deleteConversation(args.id, context.user.id);
      },

      createMessage: (_: any, args: { conversationId: string; content: string; role: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        const newMsg: Message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          conversationId: args.conversationId,
          role: args.role as any,
          content: args.content,
          createdAt: new Date().toISOString(),
        };
        return db.addMessage(newMsg, context.user.id);
      },

      createWorkspace: (_: any, args: { name: string; description: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        const ws: Workspace = {
          id: `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          userId: context.user.id,
          name: args.name,
          description: args.description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return db.createWorkspace(ws);
      },

      createArtifact: (_: any, args: { workspaceId: string; title: string; fileName: string; language: string; content: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        const art: WorkspaceArtifact = {
          id: `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          workspaceId: args.workspaceId,
          title: args.title,
          fileName: args.fileName,
          language: args.language,
          content: args.content,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return db.createArtifact(art, context.user.id);
      },

      updateArtifact: (_: any, args: { id: string; content: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        const updated = db.updateArtifact(args.id, args.content, context.user.id);
        if (!updated) throw new Error('Artifact not found or access denied');
        return updated;
      },

      createAgentTask: async (_: any, args: { workspaceId: string; title: string; goal: string; constraints?: string; desiredOutput?: string; modelId?: string; skillId?: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');

        const task: AgentTask = {
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          workspaceId: args.workspaceId,
          userId: context.user.id,
          title: args.title,
          goal: args.goal,
          constraints: args.constraints,
          desiredOutput: args.desiredOutput,
          status: 'planning',
          modelId: args.modelId || 'gemini-3.8-flash',
          skillId: args.skillId,
          steps: [],
          artifactIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const created = db.createTask(task);
        // Generate plan steps
        const steps = await coworkEngine.planTask(created, context.user.id);
        db.updateTask(created.id, context.user.id, {
          steps,
          status: steps.some((s) => s.status === 'running') ? 'running' : 'planning',
        });

        return db.getTaskById(created.id, context.user.id)!;
      },

      advanceAgentTask: async (_: any, args: { taskId: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        return coworkEngine.advanceTask(args.taskId, context.user.id);
      },

      approveAgentTaskStep: async (_: any, args: { taskId: string; stepId: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        const task = db.getTaskById(args.taskId, context.user.id);
        if (!task) throw new Error('Task not found');

        const step = task.steps.find((s) => s.id === args.stepId);
        if (step) {
          step.isApproved = true;
          step.status = 'running';
        }
        db.updateTask(task.id, context.user.id, { status: 'running', steps: task.steps });
        return coworkEngine.advanceTask(task.id, context.user.id);
      },

      cancelAgentTask: (_: any, args: { taskId: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        const updated = db.updateTask(args.taskId, context.user.id, {
          status: 'cancelled',
          summary: 'Task was cancelled by user.',
        });
        if (!updated) throw new Error('Task not found');
        return updated;
      },

      markNotificationRead: (_: any, args: { id: string }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        return db.markNotificationRead(args.id, context.user.id);
      },

      markAllNotificationsRead: (_: any, __: any, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        db.markAllNotificationsRead(context.user.id);
        return true;
      },

      updateNotificationPreferences: (_: any, args: { emailEnabled?: boolean; pushEnabled?: boolean; whatsappEnabled?: boolean }, context: { user: User }) => {
        if (!context.user) throw new Error('Unauthorized');
        return db.updatePreferences(context.user.id, args);
      },
    },
  },
});
