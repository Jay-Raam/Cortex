# Nexa AI Security & Privacy Specification

## 1. Zero Browser Storage Policy

Private conversational transcripts, system prompts, attachments, and model outputs are **never persisted in browser `localStorage`, `sessionStorage`, or `IndexedDB`**.

- **Server-Authoritative State**: Transcripts are streamed directly to memory and stored exclusively in the authenticated backend database.
- **Short-Lived Access Tokens**: In-memory access tokens with 2-hour expiration.
- **Rotating Refresh Tokens**: Cryptographically hashed in the database with reuse detection and instant session revocation.

## 2. Multi-Tenant Data Isolation

Every domain operation (GraphQL resolver, SSE streaming endpoint, Co-Work advancement, artifact read/write) enforces ownership verification:

```typescript
// Strict ownership assertion
const conversation = db.getConversationById(conversationId, user.id);
if (!conversation) {
  throw new Error('Unauthorized or conversation not found');
}
```

Cross-tenant data leakage is physically prevented at the service boundary.

## 3. Co-Work Tool Sandbox Controls

1. **Path Traversal Protection**: File operations reject absolute paths or traversal sequences (`../`). All reads and writes are scoped strictly to the authenticated workspace.
2. **Approval Gates**: Sensitive actions (e.g. creating/overwriting critical artifacts, executing commands, exporting data) transition the task state machine to `awaiting_approval`. Execution halts until the user explicitly approves.
3. **Secret Redaction**: Provider keys (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`) reside solely in backend server environments and are never sent to client bundles or logged in telemetry.
