import { ModelInfo, Conversation, Message, Skill, Workspace, WorkspaceArtifact, AgentTask, NotificationItem, User, CustomModelEndpoint, PromptTemplateEntity } from '../server/types';

export async function loginUser(email: string, password: string): Promise<User> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to sign in');
  }
  return data.user;
}

export async function registerUser(email: string, name: string, password: string): Promise<User> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, name, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create account');
  }
  return data.user;
}

export async function checkAuth(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.authenticated ? data.user : null;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

export async function updateProfile(updates: { name?: string; avatar?: string | null }): Promise<User> {
  const res = await fetch('/api/auth/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update profile');
  }
  return data.user;
}

export async function renameConversationApi(id: string, title: string): Promise<Conversation> {
  const data = await fetchGraphQL<{ updateConversation: Conversation }>(
    `
    mutation RenameConversation($id: ID!, $title: String!) {
      updateConversation(id: $id, title: $title) {
        id
        title
        updatedAt
      }
    }
  `,
    { id, title }
  );
  return data.updateConversation;
}

export async function fetchGraphQL<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

export interface StreamEvent {
  type: 'started' | 'delta' | 'tool_call' | 'tool_result' | 'usage' | 'completed' | 'fallback_notice' | 'error';
  payload: any;
}

export function streamChat(
  params: {
    conversationId: string;
    content: string;
    modelId?: string;
    mode?: string;
    forceFree?: boolean;
    skillId?: string;
    attachments?: any[];
  },
  onEvent: (event: StreamEvent) => void,
  onError: (err: Error) => void
): () => void {
  const controller = new AbortController();

  fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(params),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server returned ${response.status}: ${text}`);
      }
      if (!response.body) throw new Error('No streaming body received');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const eventData: StreamEvent = JSON.parse(trimmed.slice(6));
              onEvent(eventData);
            } catch {
              // Ignore partial parse
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err);
      }
    });

  return () => {
    controller.abort();
  };
}

export async function uploadFile(file: File): Promise<{ id: string; name: string; size: number; mimeType: string; url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('nexa_auth_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Failed to upload file (${res.status})`);
  }
  return json.attachment;
}

export async function advanceTaskApi(taskId: string): Promise<AgentTask> {
  const token = localStorage.getItem('nexa_auth_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/cowork/tasks/${taskId}/advance`, {
    method: 'POST',
    headers,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to advance task');
  return json.task;
}

export async function approveStepApi(taskId: string, stepId?: string, approvalId?: string): Promise<AgentTask> {
  const token = localStorage.getItem('nexa_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/cowork/tasks/${taskId}/approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ stepId, approvalId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to approve step');
  return json.task;
}

export async function downloadWorkspaceZip(workspaceId: string, workspaceName = 'workspace'): Promise<void> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/cowork/workspaces/${workspaceId}/export-zip`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({ error: 'Export failed' }));
    throw new Error(json.error || `HTTP ${res.status}: Failed to export workspace ZIP`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (workspaceName || 'cortex-workspace')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'workspace';
  a.download = `${safeName}.zip`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

export async function importGitHubRepoApi(params: {
  repoUrl: string;
  branch?: string;
  name?: string;
  permissionMode?: string;
}): Promise<{ workspace: Workspace; cloneResult: any; stack: any }> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/cowork/workspaces/import-github', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to import GitHub repository');
  return json;
}

export async function createGitHubPrApi(
  workspaceId: string,
  params: { title: string; body?: string; branchName?: string }
): Promise<{ success: boolean; branchName: string; prUrl?: string; compareUrl?: string; message: string }> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/cowork/workspaces/${workspaceId}/create-github-pr`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to create GitHub Pull Request');
  return json;
}


export async function executeSwarmTaskApi(taskId: string): Promise<AgentTask> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api/cowork/tasks/' + taskId + '/swarm-execute', {
    method: 'POST',
    headers,
    credentials: 'include',
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Swarm execution failed');
  return json.task;
}

export interface UsageAnalyticsSummary {
  totalConversations: number;
  totalPrompts: number;
  totalCompletions: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  commercialBenchmarkCost: number;
  actualCostCharged: number;
  totalCostSaved: number;
  currency: string;
  zeroCostEfficiencyPercent: number;
  tokensByModel: Record<string, number>;
  tokensByProvider: Record<string, number>;
  throughputEstimateTokensSec: number;
}

export async function fetchUsageSummaryApi(): Promise<UsageAnalyticsSummary> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api/analytics/usage-summary', {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load usage summary');
  return json.summary;
}

export interface ArenaVotePayload {
  prompt: string;
  modelA: string;
  modelB: string;
  winner: 'model_a' | 'model_b' | 'tie' | 'both_bad';
  latencyMsA?: number;
  latencyMsB?: number;
}

export async function submitArenaVoteApi(voteData: ArenaVotePayload): Promise<any> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api/arena/vote', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(voteData),
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to submit arena vote');
  return json.vote;
}

export async function fetchArenaVotesApi(): Promise<any[]> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api/arena/votes', {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch arena votes');
  return json.votes;
}

export async function fetchCustomEndpointsApi(): Promise<CustomModelEndpoint[]> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api/providers/custom-endpoints', {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch custom endpoints');
  return json.endpoints;
}

export async function saveCustomEndpointApi(endpoint: Partial<CustomModelEndpoint>): Promise<CustomModelEndpoint> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api/providers/custom-endpoints', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(endpoint),
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to save custom endpoint');
  return json.endpoint;
}

export async function deleteCustomEndpointApi(id: string): Promise<void> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(`/api/providers/custom-endpoints/${id}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to delete custom endpoint');
}

export async function pingCustomEndpointApi(id: string): Promise<{ success: boolean; healthStatus: string; latencyMs: number; error?: string }> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(`/api/providers/custom-endpoints/${id}/ping`, {
    method: 'POST',
    headers,
    credentials: 'include',
  });

  const json = await res.json();
  return json;
}

export async function fetchPromptTemplatesApi(): Promise<PromptTemplateEntity[]> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api/prompts/templates', {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch prompt templates');
  return json;
}

export async function savePromptTemplateApi(template: Partial<PromptTemplateEntity>): Promise<PromptTemplateEntity> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api/prompts/templates', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(template),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to save prompt template');
  return json;
}

export async function deletePromptTemplateApi(id: string): Promise<void> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(`/api/prompts/templates/${id}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to delete prompt template');
}

export interface SemanticCommitResult {
  hasChanges: boolean;
  commitType: string;
  scope: string;
  commitTitle: string;
  commitBody: string;
  fullMessage: string;
  files: Array<{ file: string; status: 'modified' | 'added' | 'deleted' }>;
  committed: boolean;
  commitHash?: string;
}

export interface ReleaseNotesResult {
  versionTag: string;
  title: string;
  markdown: string;
  stats: {
    totalCommits: number;
    featuresCount: number;
    fixesCount: number;
    choresCount: number;
  };
}

export async function generateSemanticCommitApi(
  workspaceId: string,
  autoCommit: boolean = false
): Promise<SemanticCommitResult> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(`/api/cowork/workspaces/${workspaceId}/git/semantic-commit`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ autoCommit }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to generate semantic commit');
  return json;
}

export async function generateReleaseNotesApi(
  workspaceId: string,
  options?: { versionTag?: string; title?: string }
): Promise<ReleaseNotesResult> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(`/api/cowork/workspaces/${workspaceId}/git/release-notes`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(options || {}),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to generate release notes');
  return json;
}

export interface SearchReplaceOptions {
  query: string;
  replacement?: string;
  isRegex?: boolean;
  matchCase?: boolean;
  wholeWord?: boolean;
  filePattern?: string;
  dryRun?: boolean;
  maxResults?: number;
}

export interface SearchMatch {
  file: string;
  line: number;
  column: number;
  lineContent: string;
  matchText: string;
  preview: string;
}

export interface FileReplacePreview {
  file: string;
  matchesCount: number;
  diff: string;
}

export interface SearchReplaceResult {
  query: string;
  replacement?: string;
  isRegex: boolean;
  matchCase: boolean;
  wholeWord: boolean;
  totalMatches: number;
  filesCount: number;
  matches: SearchMatch[];
  filePreviews: FileReplacePreview[];
  applied: boolean;
}

export async function searchAndReplaceApi(
  workspaceId: string,
  options: SearchReplaceOptions
): Promise<SearchReplaceResult> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(`/api/cowork/workspaces/${workspaceId}/search-replace`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(options),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Search and replace failed');
  return json;
}

export async function getScaffoldTemplatesApi(): Promise<any[]> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api/cowork/templates', { headers, credentials: 'include' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch templates');
  return json.templates || [];
}

export async function scaffoldWorkspaceTemplateApi(
  templateId: string,
  name?: string,
  description?: string
): Promise<any> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch('/api/cowork/workspaces/scaffold', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ templateId, name, description }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to scaffold project template');
  return json;
}


export async function fetchGitGraphApi(
  workspaceId: string,
  maxCount: number = 50
): Promise<any> {
  const token = localStorage.getItem('nexa_auth_token') || localStorage.getItem('cortex_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(`/api/cowork/workspaces/${encodeURIComponent(workspaceId)}/git/graph?maxCount=${maxCount}`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch Git branch graph');
  return json.graph;
}
