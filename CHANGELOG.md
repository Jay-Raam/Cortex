# Changelog

All notable changes to Cortex AI are documented in this file.
The project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2026-10-28

### Milestone Summary
- **Sprint 5 ("Real-Time Streaming, Collaboration & Autonomous Automation") Complete**: 5 major developer and security capabilities merged through the strict PR pipeline.
- **44 Total Merged Pull Requests** across core features, security hardening, enterprise tools, and real-time streaming engines.
- **55 Automated Test Suites** with **239 passing tests** maintaining a 100% test pass rate.
- Real-time terminal streaming, visual Git branch graph, encrypted secrets vault, multi-cursor pair programming, and autonomous webhook CI/CD engine.

---

### 🚀 Sprint 5 Features & Developer Tools (PRs #92 - #100)

- **Real-Time WebSocket Terminal & Command Streaming Engine** ([#92](https://github.com/Jay-Raam/Cortex/pull/92)):
  - Low-latency bi-directional WebSocket terminal server (`terminalWebSocketManager`) mounted on `/api/ws/terminal/:workspaceId`.
  - Real-time stdout/stderr chunk streaming, interactive SIGINT/SIGTERM process termination, and automatic session cleanup.
  - Interactive terminal component (`CoworkTerminal.tsx`) with ANSI color parsing, keyboard history navigation, and live execution telemetry.
  - Multi-tenant JWT authentication and strict IDOR boundary verification on WebSocket upgrade.

- **Interactive Visual Git Branch Graph & Merge Visualizer** ([#94](https://github.com/Jay-Raam/Cortex/pull/94)):
  - Visual DAG branch graph engine (`git-graph.ts`) computing topological commit lanes, merge junctions, and ref decorations (HEAD, tags, remote tracking branches).
  - High-contrast 10-color harmonic palette with interactive commit inspection and parent commit linking.
  - REST endpoint `GET /api/cowork/workspaces/:id/git/graph` and headless CLI command `cortex graph [--workspace <dir>] [--max <n>] [--json]`.
  - Frontend visualizer component (`GitBranchGraphViewer.tsx`) integrated directly into Co-Work right canvas.

- **Workspace Secrets Vault & Encrypted Environment Manager** ([#96](https://github.com/Jay-Raam/Cortex/pull/96)):
  - Authenticated AES-256-GCM encryption (`secrets-vault.ts`) with master key derivation via `scrypt`, unique 12-byte IVs, 16-byte authentication tags, and 16-byte cryptographic salts.
  - Fail-closed tamper detection rejecting modified ciphertexts and corrupted authentication tags.
  - POSIX environment variable validation, value masking (`••••••••`), and bulk `.env` file import parser.
  - REST endpoints `GET /api/cowork/workspaces/:id/secrets`, `POST /api/cowork/workspaces/:id/secrets`, `DELETE /api/cowork/workspaces/:id/secrets/:key`, and `POST /api/cowork/workspaces/:id/secrets/import-env`.
  - CLI commands `cortex secret set|list|delete|import` and secure runtime injection into `ExecutionRunner` without leaking secrets to disk or logs.
  - Workspace Secrets Modal (`WorkspaceSecretsModal.tsx`) in Co-Work workspace header.

- **Live Collaborative Multi-Cursor Pair-Programming** ([#98](https://github.com/Jay-Raam/Cortex/pull/98)):
  - Real-time collaborative workspace hub (`collab-ws.ts`) mounted on `/api/ws/collab/:workspaceId`.
  - Synchronized cursor tracking (`{ line, column, selection }`), active file viewport, and 8-color peer palette.
  - Cryptographic shareable invite token generation with room isolation and automatic peer cleanup on disconnect.
  - REST endpoints `GET /collab/session`, `POST /collab/invite`, and `GET /collab/peers`.
  - CLI command `cortex collab [--invite] [--peers] [--workspace <id>] [--json]`.
  - Frontend UI `CollabInviteModal.tsx` and live peer indicator badges in `CoworkWorkspace.tsx`.

- **Autonomous Webhook & CI/CD Pipeline Automation Engine** ([#100](https://github.com/Jay-Raam/Cortex/pull/100)):
  - Autonomous event routing and verification engine (`webhook-engine.ts`) with constant-time HMAC signature verification (`crypto.timingSafeEqual`) for GitHub (`X-Hub-Signature-256`) and GitLab (`X-Gitlab-Token`).
  - Automated PR code review dispatching on `pull_request` (`opened`, `synchronize`) triggering `prReviewer.evaluateDiff()`.
  - Automated issue triage on `issues` (`opened`, `labeled`) and commit tracking on `push`.
  - REST ingress endpoints `POST /api/webhooks/github`, `POST /api/webhooks/gitlab`, `GET /api/webhooks/deliveries`, and `POST /api/webhooks/simulate`.
  - Headless CLI command `cortex webhook list [--limit <n>] [--json]` and `cortex webhook simulate [--event <e>] [--json]`.

---

## [1.3.0] - 2026-10-27

### Milestone Summary
- **Sprint 4 ("Enterprise Intelligence & Autonomous Developer Tools") Complete**: 5 enterprise developer capabilities merged through the PR pipeline.
- **38 Total Merged Pull Requests** across core features, security remediations, and enterprise tooling.
- **50 Automated Test Suites** with **214 passing tests** maintaining a 100% test pass rate.
- Headless terminal CLI, BM25 codebase RAG, automated PR security auditor, full-stack scaffolding, and multi-format compliance reporting.

---

### 🚀 Sprint 4 Features & Developer Tools (PRs #80 - #88)

- **Headless Cortex CLI & Terminal Workspace Agent** ([#80](https://github.com/Jay-Raam/Cortex/pull/80)):
  - Executable `bin/cortex.cjs` providing direct terminal access to Cortex AI without launching the GUI.
  - Streaming conversational chat (`cortex chat`), autonomous workspace agent execution (`cortex cowork`), model catalog inspection, and system status telemetry (`cortex status`).
  - Supports `--json` flags for CI/CD automation, permission flags (`-p A|B|C`), and headless multi-agent swarm loops.

- **Semantic Codebase Indexing & Vector Search (Workspace RAG)** ([#82](https://github.com/Jay-Raam/Cortex/pull/82)):
  - AST-aware lexical-semantic code indexer (`codebaseIndexer`) using BM25 ranking algorithm, function/class symbol boosting, and disk mtime caching.
  - REST endpoints `POST /api/cowork/workspaces/:id/index` and `POST /api/cowork/workspaces/:id/semantic-search`.
  - Terminal CLI integration via `cortex search <query> [--workspace <path>]` returning ranked code snippets with confidence scores and line numbers.

- **Automated AI Pull Request Reviewer & Security Auditing Agent** ([#84](https://github.com/Jay-Raam/Cortex/pull/84)):
  - Static code quality and OWASP/CWE security auditing engine (`prReviewer`) analyzing unified Git working tree and branch diffs.
  - Detects critical vulnerabilities including OS Command Injection (CWE-78), Cross-Site Scripting (CWE-79), Hardcoded Credentials & Tokens (CWE-798), Dynamic Code Evaluation (CWE-94), Path Traversal (CWE-22), and ReDoS (CWE-1333).
  - REST endpoint `POST /api/cowork/workspaces/:id/review-diff` and CLI command `cortex review [--base <branch>]`.

- **Full-Stack Project Template Scaffolding Engine** ([#86](https://github.com/Jay-Raam/Cortex/pull/86)):
  - 1-click full-stack starter template scaffolding engine (`scaffoldEngine`) with strict path traversal boundary verification.
  - 5 production boilerplates: React 19 + Vite 6 + Tailwind CSS, Python FastAPI + Pydantic v2, Express 5 + TypeScript + Zod, Go 1.23 Gin, and Rust Axum + Tokio.
  - Frontend Template Selector tab integrated into `CreateProjectModal.tsx` and terminal command `cortex new <template> [--name <name>]`.

- **Multi-Format Workspace Audit & Execution Report Generator** ([#88](https://github.com/Jay-Raam/Cortex/pull/88)):
  - Comprehensive telemetry compiler (`workspaceReportGenerator`) summarizing workspace metadata, task execution histories, file counts, and OWASP audit results.
  - Triple-format rendering engine: GitHub-flavored Markdown (`.md`), responsive standalone HTML (`.html`) with XSS sanitization, and structured JSON (`.json` schema v1.0).
  - REST endpoint `GET /api/cowork/workspaces/:id/export-report` and CLI command `cortex report [--format <fmt>] [--output <file>]`.

---

## [1.2.0] - 2026-10-25

### Milestone Summary
- **32 Pull Requests Merged** through an automated, isolated branch CI/CD pipeline.
- **20 Security Vulnerabilities Remediated** spanning RCE, XSS, CORS, SSRF, IDOR, ReDoS, Command Injections, and Electron sandboxing.
- **45 Automated Test Suites** with **188 passing tests** and 100% test pass rate.
- Full TypeScript zero-error compliance and sub-second Vite production bundling.

---

### 🛡️ Security Vulnerabilities Remediated (20/20)

| # | Vulnerability & Remediation | CWE | PR |
| :---: | :--- | :---: | :---: |
| **1** | **Electron IPC RCE Hardening**: Restricted IPC execution to allowlisted binaries and exact argument passing; eliminated raw shell interpolation | CWE-78 / CWE-94 | [#38](https://github.com/Jay-Raam/Cortex/pull/38) |
| **2** | **Chat Markdown Stored XSS Mitigation**: Implemented strict HTML sanitization schema using `rehype-sanitize`, neutralizing `<script>`, `<iframe>`, and event handlers | CWE-79 | [#40](https://github.com/Jay-Raam/Cortex/pull/40) |
| **3** | **CORS Strict Origin Whitelisting**: Removed dynamic wildcard origin reflection with credentials; enforced loopback and explicit origin validation | CWE-942 | [#42](https://github.com/Jay-Raam/Cortex/pull/42) |
| **4** | **Unauthenticated Upload & Quota Protection**: Bound upload endpoints behind JWT authentication, MIME/extension whitelisting, and per-user storage quotas | CWE-306 / CWE-770 | [#44](https://github.com/Jay-Raam/Cortex/pull/44) |
| **5** | **Workspace Bind Directory Restriction**: Blocked host root directories (`C:\`, `/`) and sensitive OS folders from workspace binding with canonical path validation | CWE-22 / CWE-552 | [#46](https://github.com/Jay-Raam/Cortex/pull/46) |
| **6** | **Git Clone Command & Argument Injection**: Sanitized branch names (`isValidGitBranchName`) and replaced shell invocation with direct `execFile` array arguments | CWE-78 / CWE-88 | [#48](https://github.com/Jay-Raam/Cortex/pull/48) |
| **7** | **Git PR Creation Command Injection**: Replaced shell strings with safe `execFile` array passing (`safeExecGh`) using `gh pr create` | CWE-78 | [#50](https://github.com/Jay-Raam/Cortex/pull/50) |
| **8** | **SSRF Defense on Custom Endpoints**: Implemented DNS resolution and blocked private, loopback, link-local, and cloud metadata IP ranges (`169.254.169.254`) | CWE-918 | [#52](https://github.com/Jay-Raam/Cortex/pull/52) |
| **9** | **IDOR & Quota Hijacking in Custom Model Routing**: Enforced multi-tenant ownership checks on custom LLM endpoints during routing and streaming | CWE-639 / CWE-284 | [#54](https://github.com/Jay-Raam/Cortex/pull/54) |
| **10** | **Cryptographically Secure PRNG**: Replaced `Math.random` with `crypto.randomBytes(32)` for refresh tokens and session IDs | CWE-338 | [#56](https://github.com/Jay-Raam/Cortex/pull/56) |
| **11** | **Elimination of Hardcoded Default Admin**: Removed static `developer@nexa.ai` credentials; enforced explicit admin provisioning | CWE-798 | [#58](https://github.com/Jay-Raam/Cortex/pull/58) |
| **12** | **Standard HTTP Security Headers**: Integrated Helmet for CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and Referrer-Policy | CWE-693 / CWE-1021 | [#60](https://github.com/Jay-Raam/Cortex/pull/60) |
| **13** | **Sensitive File Disclosure Mitigation**: Blocked workspace read/write access to secrets (`.env`, `id_rsa`, `.pem`, `.git`, `.key`) | CWE-200 / CWE-538 | [#62](https://github.com/Jay-Raam/Cortex/pull/62) |
| **14** | **ReDoS Defense in Search & Replace**: Added regex complexity validator (`validateSafeRegex`) and zero-width match guards | CWE-1333 / CWE-835 | [#64](https://github.com/Jay-Raam/Cortex/pull/64) |
| **15** | **Registration Input Validation & Password Policy**: Enforced 8-128 char password constraints and RFC 5322 email syntax validation across REST and GraphQL | CWE-521 / CWE-20 | [#66](https://github.com/Jay-Raam/Cortex/pull/66) |
| **16** | **Environment Secret Leakage Defense**: Replaced blacklist with strict system allowlist and recursive regex secret scrubbing in Co-Work execution runner | CWE-200 / CWE-214 | [#68](https://github.com/Jay-Raam/Cortex/pull/68) |
| **17** | **Terminal Execution Timeout & Resource Bounds**: Clamped terminal execution timeouts (100ms min, 30s default, 120s max), bounded command lengths, and integrated abort signals | CWE-400 / CWE-770 | [#70](https://github.com/Jay-Raam/Cortex/pull/70) |
| **18** | **Authentication Endpoint Rate Limiting**: Added sliding-window in-memory rate limiting with `RateLimit-*` and `Retry-After` headers against credential stuffing | CWE-307 / CWE-799 | [#72](https://github.com/Jay-Raam/Cortex/pull/72) |
| **19** | **Git Semantic Commit Command Injection**: Replaced all shell `execAsync` git commands with safe array arguments (`safeExecGit`) | CWE-78 | [#74](https://github.com/Jay-Raam/Cortex/pull/74) |
| **20** | **Electron Navigation Guards & Chrome Site Isolation**: Re-enabled Chromium Site Isolation and intercepted in-window `will-navigate`/`will-redirect` events | CWE-693 | [#76](https://github.com/Jay-Raam/Cortex/pull/76) |

---

### 🚀 Major Features & Platform Capabilities (PRs #14 - #36)

- **Direct GitHub Repository Import & 1-Click PR Generator** ([#14](https://github.com/Jay-Raam/Cortex/pull/14)): Clone public/private GitHub repos directly into Co-Work workspaces, execute tasks autonomously, and create GitHub PRs with 1 click.
- **Multi-Agent Collaborative "Swarm" Workflow** ([#16](https://github.com/Jay-Raam/Cortex/pull/16)): Coordinated multi-agent execution with specialized personas (Architect, Coder, Reviewer, Tester) collaborating on complex multi-step tasks.
- **Monaco Code Editor with Multi-Tab Editing** ([#18](https://github.com/Jay-Raam/Cortex/pull/18)): Embedded VS Code-grade Monaco editor featuring syntax highlighting, multi-tab navigation, line numbers, and inline diff viewing.
- **Real-Time Hands-Free Voice Conversation Mode** ([#20](https://github.com/Jay-Raam/Cortex/pull/20)): Speech-to-text input with Web Audio API waveform visualizer and text-to-speech synthesized streaming responses.
- **AI Token Usage & Cost Analytics Dashboard** ([#22](https://github.com/Jay-Raam/Cortex/pull/22)): Real-time telemetry tracking prompt/completion tokens, pricing breakdowns, and cost savings across models.
- **Dual Model Arena & Blind Comparison View** ([#24](https://github.com/Jay-Raam/Cortex/pull/24)): Side-by-side simultaneous prompt execution across two AI models with blind vote scoring and latency comparison.
- **Interactive Architecture Diagram Visualizer** ([#26](https://github.com/Jay-Raam/Cortex/pull/26)): Mermaid diagram parser and interactive SVG renderer with zoom, pan, and direct SVG/PNG export.
- **Custom OpenAI-Compatible Endpoint Manager** ([#28](https://github.com/Jay-Raam/Cortex/pull/28)): Connect custom local or cloud LLM endpoints (Ollama, vLLM, LM Studio, LocalAI) with zero-cost routing and latency telemetry.
- **System Prompt Template Library & Persona Hub** ([#30](https://github.com/Jay-Raam/Cortex/pull/30)): Curated prompt library with customizable personas, variable substitutions, and multi-tenant persistence.
- **Automated Semantic Git Commit Generator** ([#32](https://github.com/Jay-Raam/Cortex/pull/32)): AI-driven diff analysis that synthesizes conventional semantic commit messages (`feat:`, `fix:`, `refactor:`) and automatically commits changes.
- **Authentication Security Hardening** ([#35](https://github.com/Jay-Raam/Cortex/pull/35)): Secret fail-closed policy, dev secret fallback elimination, and secure JWT token signing.
- **Multi-File Search & Replace** ([#36](https://github.com/Jay-Raam/Cortex/pull/36)): Workspace-wide multi-file search and replace supporting regular expressions, whole-word matching, case sensitivity, and live match previews.

---

### 🧪 Test Automation & Quality Assurance
- **Total Test Suites**: 45
- **Total Unit & Integration Tests**: 188
- **Pass Rate**: 100% (0 failing, 0 skipped)
- **CI / Pipeline Guardrails**: Automatic regression testing on every pull request.
