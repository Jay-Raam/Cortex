import { ModelInfo, Conversation, Message, Skill, Workspace, WorkspaceArtifact, AgentTask, NotificationItem, User } from '../server/types';

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

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to upload file');
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
