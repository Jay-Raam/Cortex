import { Conversation, Message } from '../server/types';

/**
 * Exports a conversation thread to standard GitHub-flavored Markdown.
 */
export function exportConversationToMarkdown(
  conversation: Conversation,
  messages: Message[]
): void {
  const dateStr = new Date(conversation.createdAt).toLocaleDateString();
  let md = `# ${conversation.title || 'Cortex AI Conversation'}\n\n`;
  md += `> **Model**: ${conversation.modelId} (${conversation.providerId})\n`;
  md += `> **Date**: ${dateStr}\n`;
  md += `> **Mode**: ${conversation.mode}\n\n`;
  md += `---\n\n`;

  for (const msg of messages) {
    const roleName = msg.role === 'assistant' ? 'Cortex Assistant' : 'User';
    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    md += `### ${roleName} *(${time})*\n\n`;
    md += `${msg.content}\n\n`;
    if (msg.attachments && msg.attachments.length > 0) {
      md += `*Attachments: ${msg.attachments.map((a) => a.name).join(', ')}*\n\n`;
    }
    md += `---\n\n`;
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeTitle = (conversation.title || 'conversation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  a.href = url;
  a.download = `cortex-${safeTitle}-${Date.now()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports a conversation thread to structured JSON.
 */
export function exportConversationToJson(
  conversation: Conversation,
  messages: Message[]
): void {
  const data = {
    platform: 'Cortex AI',
    exportedAt: new Date().toISOString(),
    conversation,
    messages,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeTitle = (conversation.title || 'conversation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  a.href = url;
  a.download = `cortex-${safeTitle}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
