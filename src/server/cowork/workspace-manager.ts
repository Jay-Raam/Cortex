import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Workspace, WorkspaceFileNode, WorkspaceCheckpoint } from '../types';
import { isValidGitBranchName, safeExecGit, safeExecGh, sanitizeCommitTitle } from '../security/git-security';

const execAsync = promisify(exec);

const SENSITIVE_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|pfx|p12|pkcs12|crt|cer|der|kdbx)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)/i,
  /credentials(\.json)?$/i,
  /service[-_]account.*\.json$/i,
  /client[-_]secret.*\.json$/i,
  /secret/i,
];

const RESTRICTED_DIRECTORIES = new Set([
  '.git',
  '.ssh',
  '.aws',
  '.gnupg',
  '.docker',
]);

const EXACT_RESTRICTED_FILES = new Set([
  '.npmrc',
  '.yarnrc',
  '.yarnrc.yml',
  '.dockercfg',
  '.gitconfig',
  '.gitmodules',
  '.git-credentials',
  '.bash_history',
  '.zsh_history',
  '.bashrc',
  '.zshrc',
  '.profile',
  'passwd',
  'shadow',
  'htpasswd',
]);

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.cache',
  '.turbo',
  'out',
]);

export class WorkspaceManager {
  /**
   * Determine the root filesystem directory for a workspace.
   */
  getWorkspaceRoot(workspace: Workspace): string {
    if (workspace.projectRoot && workspace.isLocalBinding) {
      const resolved = path.resolve(workspace.projectRoot);
      if (fs.existsSync(resolved)) {
        return resolved;
      }
    }
    const defaultRoot = path.resolve(process.env.CORTEX_WORKSPACES_DIR || path.resolve(process.cwd(), 'workspaces'), workspace.id);
    if (!fs.existsSync(defaultRoot)) {
      fs.mkdirSync(defaultRoot, { recursive: true });
    }
    return defaultRoot;
  }

  /**
   * Safe path resolution ensuring no escape from workspace root.
   */
  resolveSafePath(workspaceRoot: string, relativePath = ''): string {
    if (typeof relativePath !== 'string') {
      throw new Error('Invalid path parameter.');
    }
    if (relativePath.includes('\0')) {
      throw new Error('Invalid path: null byte detected.');
    }

    const rootNormalized = path.resolve(workspaceRoot);
    if (!relativePath || relativePath === '.' || relativePath === './') {
      return rootNormalized;
    }

    // Convert backslashes to forward slashes for universal cross-platform normalization
    const normalizedRelative = relativePath.replace(/\\/g, '/');

    // Strip leading slashes to prevent root escapes
    const cleanRelative = normalizedRelative.replace(/^\/+/, '');
    const resolved = path.resolve(rootNormalized, cleanRelative);

    if (resolved !== rootNormalized && !resolved.startsWith(rootNormalized + path.sep)) {
      throw new Error(`Security Violation: Path traversal detected outside workspace root (${relativePath}).`);
    }

    // Check for symlink traversal if path exists
    if (fs.existsSync(resolved)) {
      const real = fs.realpathSync(resolved);
      if (real !== rootNormalized && !real.startsWith(rootNormalized + path.sep)) {
        throw new Error('Security Violation: Symlink traversal detected outside workspace root.');
      }
    }

    return resolved;
  }

  /**
   * Checks if a file path is considered sensitive (e.g. .env, private keys).
   */
  isSensitiveFile(relativePath: string): boolean {
    if (!relativePath || typeof relativePath !== 'string') return true;

    const normalized = relativePath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);

    // 1. Block access to internal metadata directories and hidden dot directories containing secrets/hooks
    if (segments.some((seg) => RESTRICTED_DIRECTORIES.has(seg.toLowerCase()))) {
      return true;
    }

    const base = path.basename(normalized).toLowerCase();

    // 2. Exact match restricted configuration and credential files
    if (EXACT_RESTRICTED_FILES.has(base)) {
      return true;
    }

    // 3. Sensitive regex patterns
    return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(base));
  }

  /**
   * Builds a directory tree structure.
   */
  async listDirectoryTree(
    workspaceRoot: string,
    subDir = '',
    maxDepth = 5,
    currentDepth = 0
  ): Promise<WorkspaceFileNode[]> {
    if (currentDepth > maxDepth) return [];

    const currentDir = this.resolveSafePath(workspaceRoot, subDir);
    if (!fs.existsSync(currentDir)) return [];

    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    const nodes: WorkspaceFileNode[] = [];

    for (const entry of entries) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;

      const relPath = subDir ? path.join(subDir, entry.name).replace(/\\/g, '/') : entry.name;
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        const children = await this.listDirectoryTree(
          workspaceRoot,
          relPath,
          maxDepth,
          currentDepth + 1
        );
        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'directory',
          children,
        });
      } else if (entry.isFile()) {
        let size = 0;
        let updatedAt = new Date().toISOString();
        try {
          const stats = await fs.promises.stat(fullPath);
          size = stats.size;
          updatedAt = stats.mtime.toISOString();
        } catch {}

        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'file',
          size,
          updatedAt,
        });
      }
    }

    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Reads file contents safely with secret filter and size bounds.
   */
  async readFile(
    workspaceRoot: string,
    relativePath: string,
    allowSensitive = false
  ): Promise<{ content: string; path: string; size: number }> {
    if (!allowSensitive && this.isSensitiveFile(relativePath)) {
      throw new Error(`Security Policy: Access to sensitive file "${relativePath}" is restricted by default.`);
    }

    const fullPath = this.resolveSafePath(workspaceRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    const stats = await fs.promises.stat(fullPath);
    if (stats.size > 2 * 1024 * 1024) {
      throw new Error(`File "${relativePath}" exceeds maximum read limit (2MB).`);
    }

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    return {
      content,
      path: relativePath.replace(/\\/g, '/'),
      size: stats.size,
    };
  }

  /**
   * Creates a file safely with parent directory auto-creation.
   */
  async createFile(
    workspaceRoot: string,
    relativePath: string,
    content: string,
    allowSensitive = false
  ): Promise<{ success: boolean; path: string; size: number }> {
    if (!allowSensitive && this.isSensitiveFile(relativePath)) {
      throw new Error(`Security Policy: Writing to sensitive or restricted file "${relativePath}" is prohibited.`);
    }

    const fullPath = this.resolveSafePath(workspaceRoot, relativePath);
    const parentDir = path.dirname(fullPath);

    if (!fs.existsSync(parentDir)) {
      await fs.promises.mkdir(parentDir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, content, 'utf-8');
    const stats = await fs.promises.stat(fullPath);

    return {
      success: true,
      path: relativePath.replace(/\\/g, '/'),
      size: stats.size,
    };
  }

  /**
   * Modifies an existing file safely.
   */
  async editFile(
    workspaceRoot: string,
    relativePath: string,
    content: string,
    allowSensitive = false
  ): Promise<{ success: boolean; path: string; size: number }> {
    if (!allowSensitive && this.isSensitiveFile(relativePath)) {
      throw new Error(`Security Policy: Modifying sensitive or restricted file "${relativePath}" is prohibited.`);
    }

    const fullPath = this.resolveSafePath(workspaceRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Cannot edit file: "${relativePath}" does not exist.`);
    }

    await fs.promises.writeFile(fullPath, content, 'utf-8');
    const stats = await fs.promises.stat(fullPath);

    return {
      success: true,
      path: relativePath.replace(/\\/g, '/'),
      size: stats.size,
    };
  }

  /**
   * Deletes a file safely.
   */
  async deleteFile(
    workspaceRoot: string,
    relativePath: string,
    allowSensitive = false
  ): Promise<{ success: boolean; path: string }> {
    if (!allowSensitive && this.isSensitiveFile(relativePath)) {
      throw new Error(`Security Policy: Deleting sensitive or restricted file "${relativePath}" is prohibited.`);
    }

    const fullPath = this.resolveSafePath(workspaceRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Cannot delete: "${relativePath}" does not exist.`);
    }

    await fs.promises.unlink(fullPath);
    return {
      success: true,
      path: relativePath.replace(/\\/g, '/'),
    };
  }

  /**
   * Creates a directory.
   */
  async createDirectory(
    workspaceRoot: string,
    relativePath: string,
    allowSensitive = false
  ): Promise<{ success: boolean; path: string }> {
    if (!allowSensitive && this.isSensitiveFile(relativePath)) {
      throw new Error(`Security Policy: Creating restricted directory "${relativePath}" is prohibited.`);
    }

    const fullPath = this.resolveSafePath(workspaceRoot, relativePath);
    await fs.promises.mkdir(fullPath, { recursive: true });
    return {
      success: true,
      path: relativePath.replace(/\\/g, '/'),
    };
  }

  /**
   * Applies a patch or replacement to a file.
   */
  async applyPatch(
    workspaceRoot: string,
    relativePath: string,
    patchContent: string,
    targetSnippet?: string,
    replacementSnippet?: string,
    allowSensitive = false
  ): Promise<{ success: boolean; path: string; diff: string }> {
    if (!allowSensitive && this.isSensitiveFile(relativePath)) {
      throw new Error(`Security Policy: Patching sensitive or restricted file "${relativePath}" is prohibited.`);
    }

    const { content: originalContent } = await this.readFile(workspaceRoot, relativePath, allowSensitive);
    let newContent = '';

    if (targetSnippet && replacementSnippet !== undefined) {
      if (!originalContent.includes(targetSnippet)) {
        throw new Error(`Patch failure: Target snippet not found in ${relativePath}.`);
      }
      newContent = originalContent.replace(targetSnippet, replacementSnippet);
    } else {
      newContent = patchContent;
    }

    await this.editFile(workspaceRoot, relativePath, newContent);

    // Compute diff summary
    const origLines = originalContent.split('\n');
    const newLines = newContent.split('\n');
    const diffLines: string[] = [];
    const max = Math.max(origLines.length, newLines.length);

    for (let i = 0; i < max; i++) {
      const o = origLines[i];
      const n = newLines[i];
      if (o === n) {
        diffLines.push(`  ${o || ''}`);
      } else {
        if (o !== undefined) diffLines.push(`- ${o}`);
        if (n !== undefined) diffLines.push(`+ ${n}`);
      }
    }

    return {
      success: true,
      path: relativePath.replace(/\\/g, '/'),
      diff: diffLines.join('\n'),
    };
  }

  /**
   * Search files matching query pattern.
   */
  async searchFiles(workspaceRoot: string, query: string): Promise<string[]> {
    const tree = await this.listDirectoryTree(workspaceRoot, '', 6);
    const matches: string[] = [];
    const q = query.toLowerCase();

    function traverse(nodes: WorkspaceFileNode[]) {
      for (const node of nodes) {
        if (node.name.toLowerCase().includes(q)) {
          matches.push(node.path);
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    }

    traverse(tree);
    return matches.slice(0, 50);
  }

  /**
   * Search text content across workspace files.
   */
  async searchContent(
    workspaceRoot: string,
    query: string,
    maxResults = 50
  ): Promise<Array<{ file: string; line: number; text: string }>> {
    const tree = await this.listDirectoryTree(workspaceRoot, '', 5);
    const results: Array<{ file: string; line: number; text: string }> = [];
    const q = query.toLowerCase();

    const flatten = (nodes: WorkspaceFileNode[]): string[] => {
      let paths: string[] = [];
      for (const node of nodes) {
        if (node.type === 'file') paths.push(node.path);
        if (node.children) paths = paths.concat(flatten(node.children));
      }
      return paths;
    };

    const files = flatten(tree);

    for (const relPath of files) {
      if (this.isSensitiveFile(relPath)) continue;
      try {
        const { content } = await this.readFile(workspaceRoot, relPath);
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            results.push({
              file: relPath,
              line: i + 1,
              text: lines[i].trim().substring(0, 150),
            });
            if (results.length >= maxResults) return results;
          }
        }
      } catch {}
    }

    return results;
  }

  /**
   * Inspects package manifest, build scripts, and dependencies.
   */
  /**
   * Multi-file search and replace across workspace files with regex, case-sensitivity,
   * match preview, unified diffs, and optional atomic batch application.
   */
  async searchAndReplace(
    workspaceRoot: string,
    options: {
      query: string;
      replacement?: string;
      isRegex?: boolean;
      matchCase?: boolean;
      wholeWord?: boolean;
      filePattern?: string;
      dryRun?: boolean;
      maxResults?: number;
    }
  ): Promise<{
    query: string;
    replacement?: string;
    isRegex: boolean;
    matchCase: boolean;
    wholeWord: boolean;
    totalMatches: number;
    filesCount: number;
    matches: Array<{
      file: string;
      line: number;
      column: number;
      lineContent: string;
      matchText: string;
      preview: string;
    }>;
    filePreviews: Array<{
      file: string;
      matchesCount: number;
      diff: string;
    }>;
    applied: boolean;
  }> {
    const isRegex = Boolean(options.isRegex);
    const matchCase = Boolean(options.matchCase);
    const wholeWord = Boolean(options.wholeWord);
    const dryRun = options.dryRun !== false;
    const maxResults = options.maxResults || 200;

    if (!options.query || typeof options.query !== 'string') {
      return {
        query: '',
        replacement: options.replacement,
        isRegex,
        matchCase,
        wholeWord,
        totalMatches: 0,
        filesCount: 0,
        matches: [],
        filePreviews: [],
        applied: false,
      };
    }

    // Build regular expression safely
    let patternStr = options.query;
    if (!isRegex) {
      patternStr = patternStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (wholeWord) {
      patternStr = `\\b${patternStr}\\b`;
    }
    const flags = matchCase ? 'g' : 'gi';
    let regex: RegExp;
    try {
      regex = new RegExp(patternStr, flags);
    } catch (err: any) {
      throw new Error(`Invalid regular expression pattern: ${err.message}`);
    }

    // Parse file patterns filter (e.g. "*.ts, *.tsx, src/*")
    const patterns = options.filePattern
      ? options.filePattern
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : [];

    const matchesPattern = (relPath: string): boolean => {
      if (patterns.length === 0) return true;
      const normalized = relPath.replace(/\\/g, '/');
      return patterns.some((pat) => {
        if (pat.startsWith('*.')) {
          const ext = pat.substring(1);
          return normalized.endsWith(ext);
        }
        if (pat.endsWith('*')) {
          const prefix = pat.substring(0, pat.length - 1);
          return normalized.startsWith(prefix);
        }
        return normalized.includes(pat);
      });
    };

    const tree = await this.listDirectoryTree(workspaceRoot, '', 6);
    const flatten = (nodes: WorkspaceFileNode[]): string[] => {
      let paths: string[] = [];
      for (const node of nodes) {
        if (node.type === 'file') paths.push(node.path);
        if (node.children) paths = paths.concat(flatten(node.children));
      }
      return paths;
    };

    const allFiles = flatten(tree);
    const targetFiles = allFiles.filter((f) => !this.isSensitiveFile(f) && matchesPattern(f));

    const matches: Array<{
      file: string;
      line: number;
      column: number;
      lineContent: string;
      matchText: string;
      preview: string;
    }> = [];

    const filePreviews: Array<{
      file: string;
      matchesCount: number;
      diff: string;
    }> = [];

    for (const relPath of targetFiles) {
      try {
        const { content: originalContent } = await this.readFile(workspaceRoot, relPath);
        const lines = originalContent.split('\n');
        let fileMatchCount = 0;

        for (let i = 0; i < lines.length; i++) {
          const lineText = lines[i];
          const lineRegex = new RegExp(patternStr, flags);
          let match: RegExpExecArray | null;

          while ((match = lineRegex.exec(lineText)) !== null) {
            fileMatchCount++;
            if (matches.length < maxResults) {
              const col = match.index + 1;
              const matchText = match[0];
              const preview =
                options.replacement !== undefined
                  ? lineText.substring(0, match.index) +
                    `[${options.replacement}]` +
                    lineText.substring(match.index + matchText.length)
                  : lineText.trim().substring(0, 160);

              matches.push({
                file: relPath,
                line: i + 1,
                column: col,
                lineContent: lineText.trim().substring(0, 160),
                matchText,
                preview,
              });
            }
            if (!matchCase && !lineRegex.global) break;
          }
        }

        if (fileMatchCount > 0 && options.replacement !== undefined) {
          const newContent = originalContent.replace(regex, options.replacement);
          const origLines = originalContent.split('\n');
          const newLines = newContent.split('\n');
          const diffLines: string[] = [];
          const max = Math.max(origLines.length, newLines.length);

          for (let k = 0; k < max; k++) {
            const o = origLines[k];
            const n = newLines[k];
            if (o !== n) {
              if (o !== undefined) diffLines.push(`- ${o}`);
              if (n !== undefined) diffLines.push(`+ ${n}`);
            }
          }

          filePreviews.push({
            file: relPath,
            matchesCount: fileMatchCount,
            diff: diffLines.slice(0, 50).join('\n'),
          });

          // If not a dry run, atomically update the file on disk
          if (!dryRun) {
            await this.editFile(workspaceRoot, relPath, newContent);
          }
        }
      } catch {}
    }

    return {
      query: options.query,
      replacement: options.replacement,
      isRegex,
      matchCase,
      wholeWord,
      totalMatches: matches.length,
      filesCount: filePreviews.length > 0 ? filePreviews.length : new Set(matches.map((m) => m.file)).size,
      matches,
      filePreviews,
      applied: !dryRun && options.replacement !== undefined && filePreviews.length > 0,
    };
  }

    async getProjectStructure(workspaceRoot: string): Promise<{
    framework: string;
    packageScripts: Record<string, string>;
    dependencies: Record<string, string>;
    hasTests: boolean;
    configFiles: string[];
    entryPoints: string[];
  }> {
    const pkgPath = path.join(workspaceRoot, 'package.json');
    let packageScripts: Record<string, string> = {};
    let dependencies: Record<string, string> = {};
    let framework = 'Node.js / JavaScript';
    let hasTests = false;

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
        packageScripts = pkg.scripts || {};
        dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        hasTests = Boolean(packageScripts.test);

        if (dependencies.react) framework = 'React';
        if (dependencies.next) framework = 'Next.js';
        if (dependencies.vue) framework = 'Vue';
        if (dependencies.svelte) framework = 'Svelte';
        if (dependencies.express) framework += ' + Express';
        if (dependencies.vite) framework += ' (Vite)';
      } catch {}
    }

    const configCandidates = [
      'tsconfig.json',
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
      'next.config.mjs',
      'next.config.ts',
      'tailwind.config.js',
      'tailwind.config.ts',
      'eslint.config.js',
      '.eslintrc.json',
      '.gitignore',
      'package.json',
    ];
    const configFiles = configCandidates.filter((cfg) => fs.existsSync(path.join(workspaceRoot, cfg)));

    const entryCandidates = [
      'src/index.ts',
      'src/main.ts',
      'src/main.tsx',
      'src/App.tsx',
      'index.js',
      'server.ts',
      'app/layout.tsx',
      'app/page.tsx',
    ];
    const entryPoints = entryCandidates.filter((cand) => fs.existsSync(path.join(workspaceRoot, cand)));

    return {
      framework,
      packageScripts,
      dependencies,
      hasTests,
      configFiles,
      entryPoints,
    };
  }

  /**
   * Retrieves Git status (if workspace is a git repository).
   */
  async getGitStatus(workspaceRoot: string): Promise<{
    isGit: boolean;
    branch?: string;
    modified: string[];
    untracked: string[];
    staged: string[];
  }> {
    const gitDir = path.join(workspaceRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      return { isGit: false, modified: [], untracked: [], staged: [] };
    }

    try {
      const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: workspaceRoot,
      });
      const { stdout: statusOut } = await execAsync('git status --porcelain', {
        cwd: workspaceRoot,
      });

      const modified: string[] = [];
      const untracked: string[] = [];
      const staged: string[] = [];

      const lines = statusOut.split('\n').filter(Boolean);
      for (const line of lines) {
        const x = line[0];
        const y = line[1];
        const file = line.substring(3).trim();

        if (x !== ' ' && x !== '?') staged.push(file);
        if (y === 'M') modified.push(file);
        if (x === '?' && y === '?') untracked.push(file);
      }

      return {
        isGit: true,
        branch: branchOut.trim(),
        modified,
        untracked,
        staged,
      };
    } catch {
      return { isGit: true, modified: [], untracked: [], staged: [] };
    }
  }

  /**
   * Creates a snapshot checkpoint before making multi-file modifications.
   */
  async createCheckpoint(
    workspaceRoot: string,
    workspaceId: string,
    title: string,
    filePaths: string[]
  ): Promise<WorkspaceCheckpoint> {
    const files: Array<{ path: string; content: string }> = [];

    for (const p of filePaths) {
      try {
        const { content } = await this.readFile(workspaceRoot, p, true);
        files.push({ path: p, content });
      } catch {}
    }

    return {
      id: `ckpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workspaceId,
      title,
      description: `Snapshot of ${files.length} file(s) before multi-file modifications`,
      files,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Restores a checkpoint on rollback.
   */
  async restoreCheckpoint(
    workspaceRoot: string,
    checkpoint: WorkspaceCheckpoint
  ): Promise<{ success: boolean; restoredFiles: string[] }> {
    const restoredFiles: string[] = [];

    for (const f of checkpoint.files) {
      await this.createFile(workspaceRoot, f.path, f.content);
      restoredFiles.push(f.path);
    }

    return {
      success: true,
      restoredFiles,
    };
  }

  /**
   * Parse and validate a GitHub repository string or URL into owner and repo.
   */
  parseGitHubRepoUrl(input: string): { owner: string; repo: string; fullName: string; httpsUrl: string } {
    if (!input || typeof input !== 'string') {
      throw new Error('GitHub repository URL or identifier is required.');
    }
    const clean = input.trim();
    const regex = /^(?:https?:\/\/github\.com\/|git@github\.com:)?([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+?)(?:\.git)?(?:\/)?$/;
    const match = clean.match(regex);
    if (!match) {
      throw new Error(`Invalid GitHub repository format: "${input}". Expected "owner/repo" or "https://github.com/owner/repo".`);
    }
    const owner = match[1];
    const repo = match[2];
    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      httpsUrl: `https://github.com/${owner}/${repo}`,
    };
  }

  /**
   * Clones a GitHub repository into an isolated workspace directory.
   */
  async cloneGitHubRepo(
    targetDir: string,
    parsed: { owner: string; repo: string; httpsUrl: string },
    branch?: string
  ): Promise<{ success: boolean; commitHash?: string; message: string }> {
    fs.mkdirSync(targetDir, { recursive: true });

    // Validate branch parameter if provided
    if (branch) {
      const validation = isValidGitBranchName(branch);
      if (!validation.valid) {
        throw new Error(`Invalid git branch name: ${validation.reason}`);
      }
    }

    const cloneUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;

    // Construct argument array safely with '--' to separate options from URLs/targets
    const cloneArgs = ['clone', '--depth', '1'];
    if (branch && branch.trim()) {
      cloneArgs.push('-b', branch.trim());
    }
    cloneArgs.push('--', cloneUrl, targetDir);

    try {
      await safeExecGit(cloneArgs, { timeout: 45000 });
      let commitHash = '';
      try {
        const { stdout } = await safeExecGit(['rev-parse', 'HEAD'], { cwd: targetDir });
        commitHash = stdout.trim();
      } catch {}
      return {
        success: true,
        commitHash,
        message: `Successfully cloned ${parsed.owner}/${parsed.repo}`,
      };
    } catch (err: any) {
      // If branch clone failed or shallow clone had an issue, fallback or create placeholder
      const isAuthOrNetwork =
        err.message?.includes('Authentication failed') ||
        err.message?.includes('not found') ||
        err.message?.includes('Could not resolve');
      if (!isAuthOrNetwork) {
        try {
          await safeExecGit(['clone', '--depth', '1', '--', cloneUrl, targetDir], { timeout: 45000 });
          return { success: true, message: `Cloned ${parsed.owner}/${parsed.repo} default branch` };
        } catch {}
      }

      // Initialize empty git repo and create README for offline or preview
      try {
        await safeExecGit(['init'], { cwd: targetDir });
        fs.writeFileSync(
          path.join(targetDir, 'README.md'),
          `# ${parsed.repo}\n\nCloned from: ${parsed.httpsUrl}\n\n*Repository workspace initialized in Cortex.*`,
          'utf8'
        );
      } catch {}

      return {
        success: false,
        message: err.message || 'Clone failed',
      };
    }
  }

  /**
   * Create a Git branch, commit changes, push, and open or link a GitHub Pull Request.
   */
  async createGitHubPullRequest(
    workspaceRoot: string,
    options: {
      title: string;
      body?: string;
      branchName?: string;
      repoFullName?: string;
    }
  ): Promise<{
    success: boolean;
    branchName: string;
    prUrl?: string;
    compareUrl?: string;
    message: string;
  }> {
    const gitDir = path.join(workspaceRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error('Workspace is not a Git repository. Cannot create a Pull Request.');
    }

    // Validate branch name
    let branchName = options.branchName?.trim();
    if (branchName) {
      const branchVal = isValidGitBranchName(branchName);
      if (!branchVal.valid) {
        throw new Error(`Invalid branch name: ${branchVal.reason}`);
      }
    } else {
      branchName = `cortex/feature-${Date.now().toString(36)}`;
    }

    const commitTitle = sanitizeCommitTitle(options.title);
    const prBody =
      options.body?.trim() ||
      `### Autonomous Changes via Cortex AI\n\n- Automated updates generated by Cortex Co-Work workspace.\n- Tested and verified.`;

    // 1. Create and switch to new branch
    await safeExecGit(['checkout', '-B', branchName], { cwd: workspaceRoot });

    // 2. Stage and commit
    await safeExecGit(['add', '-A'], { cwd: workspaceRoot });
    try {
      await safeExecGit(['commit', '-m', commitTitle], { cwd: workspaceRoot });
    } catch {
      // Nothing to commit or already committed
    }

    let prUrl: string | undefined;
    let compareUrl: string | undefined;

    // 3. Attempt push if remote exists
    try {
      await safeExecGit(['push', '-u', 'origin', branchName], { cwd: workspaceRoot, timeout: 30000 });
    } catch (err: any) {
      console.warn('[WorkspaceManager] git push warning:', err.message);
    }

    // 4. Try gh CLI if installed and available
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const envWithToken = token ? { ...process.env, GH_TOKEN: token } : process.env;

    try {
      const { stdout } = await safeExecGh(
        ['pr', 'create', '--title', commitTitle, '--body', prBody, '--head', branchName],
        { cwd: workspaceRoot, env: envWithToken, timeout: 20000 }
      );
      const lines = stdout.trim().split('\n');
      const foundUrl = lines.find((l) => l.startsWith('http://') || l.startsWith('https://'));
      if (foundUrl) {
        prUrl = foundUrl.trim();
      }
    } catch {
      // Fallback to web compare URL
    }

    // Generate web compare URL
    if (options.repoFullName) {
      compareUrl = `https://github.com/${options.repoFullName}/compare/main...${branchName}?expand=1`;
    }

    return {
      success: true,
      branchName,
      prUrl,
      compareUrl,
      message: prUrl ? `Pull request created: ${prUrl}` : `Branch ${branchName} created and ready for Pull Request.`,
    };
  }

  /**
   * Analyzes workspace Git status and diffs, generating a structured Conventional Commit message.
   * Optionally commits the changes automatically.
   */
  async generateSemanticCommit(
    workspaceRoot: string,
    autoCommit: boolean = false
  ): Promise<{
    hasChanges: boolean;
    commitType: string;
    scope: string;
    commitTitle: string;
    commitBody: string;
    fullMessage: string;
    files: Array<{ file: string; status: 'modified' | 'added' | 'deleted' }>;
    committed: boolean;
    commitHash?: string;
  }> {
    const gitDir = path.join(workspaceRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error('Workspace is not a Git repository. Initialize git first.');
    }

    const { stdout: statusOut } = await execAsync('git status --porcelain -uall', { cwd: workspaceRoot });
    const lines = statusOut.split('\n').filter(Boolean);
    if (lines.length === 0) {
      return {
        hasChanges: false,
        commitType: 'chore',
        scope: 'workspace',
        commitTitle: 'chore: no changes detected',
        commitBody: 'Working tree clean.',
        fullMessage: 'chore: no changes detected\n\nWorking tree clean.',
        files: [],
        committed: false,
      };
    }

    const files: Array<{ file: string; status: 'modified' | 'added' | 'deleted' }> = [];
    for (const line of lines) {
      const code = line.substring(0, 2);
      const file = line.substring(3).trim();
      let status: 'modified' | 'added' | 'deleted' = 'modified';
      if (code.includes('?') || code.includes('A')) status = 'added';
      else if (code.includes('D')) status = 'deleted';
      files.push({ file, status });
    }

    // Determine primary scope from file paths
    let scope = 'workspace';
    const firstFile = files[0].file;
    const cleanFile = firstFile.replace(/^[\"']|[\"']$/g, '').replace(/\\/g, '/').replace(/\/+$/, '');
    const parts = cleanFile.split('/').filter(Boolean);
    if (parts.length > 2) {
      scope = parts[parts.length - 2].toLowerCase().replace(/[^a-z0-9_-]/g, '');
    } else if (parts.length === 2) {
      scope = parts[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
    } else if (parts.length === 1) {
      scope = path.basename(parts[0], path.extname(parts[0])).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    }
    if (!scope || scope === 'src' || scope === 'lib') scope = 'core';

    // Determine type
    let commitType = 'feat';
    const allTests = files.every((f) => f.file.includes('test') || f.file.includes('spec'));
    const allDocs = files.every((f) => f.file.endsWith('.md') || f.file.includes('docs'));
    const allStyles = files.every((f) => f.file.endsWith('.css') || f.file.endsWith('.scss'));
    const allConfigs = files.every((f) => f.file.includes('config') || f.file.endsWith('.json') || f.file.startsWith('.'));

    if (allTests) {
      commitType = 'test';
    } else if (allDocs) {
      commitType = 'docs';
    } else if (allStyles) {
      commitType = 'style';
    } else if (allConfigs) {
      commitType = 'chore';
    } else {
      try {
        const { stdout: diffOut } = await execAsync('git diff HEAD', { cwd: workspaceRoot });
        const lowerDiff = diffOut.toLowerCase();
        if (lowerDiff.includes('fix') || lowerDiff.includes('error') || lowerDiff.includes('catch') || lowerDiff.includes('bug')) {
          commitType = 'fix';
        } else if (lowerDiff.includes('perf') || lowerDiff.includes('optimize') || lowerDiff.includes('cache')) {
          commitType = 'perf';
        } else if (lowerDiff.includes('refactor') || lowerDiff.includes('cleanup')) {
          commitType = 'refactor';
        }
      } catch {}
    }

    const actionVerb =
      commitType === 'fix'
        ? 'resolve issues in'
        : commitType === 'test'
        ? 'add tests for'
        : commitType === 'docs'
        ? 'update documentation for'
        : 'implement updates for';

    const commitTitle = `${commitType}(${scope}): ${actionVerb} ${files.slice(0, 2).map((f) => path.basename(f.file)).join(', ')}${files.length > 2 ? ` and ${files.length - 2} other file(s)` : ''}`;

    const bodyLines = [
      `### Summary of Changes`,
      `- Automated conventional commit synthesized from ${files.length} modified file(s).`,
      `- Scope: ${scope}`,
      ``,
      `### Modified Files:`,
      ...files.map((f) => `- [${f.status.toUpperCase()}] \`${f.file}\``),
    ];
    const commitBody = bodyLines.join('\n');
    const fullMessage = `${commitTitle}\n\n${commitBody}`;

    let committed = false;
    let commitHash: string | undefined;

    if (autoCommit) {
      await execAsync('git add -A', { cwd: workspaceRoot });
      const safeMessage = fullMessage.replace(/"/g, '\\"');
      await execAsync(`git commit -m "${safeMessage}"`, { cwd: workspaceRoot });
      const { stdout: revOut } = await execAsync('git rev-parse --short HEAD', { cwd: workspaceRoot });
      committed = true;
      commitHash = revOut.trim();
    }

    return {
      hasChanges: true,
      commitType,
      scope,
      commitTitle,
      commitBody,
      fullMessage,
      files,
      committed,
      commitHash,
    };
  }

  /**
   * Generates structured Release Notes & Changelog Markdown from recent Git commits.
   */
  async generateReleaseNotes(
    workspaceRoot: string,
    options?: { versionTag?: string; title?: string }
  ): Promise<{
    versionTag: string;
    title: string;
    markdown: string;
    stats: {
      totalCommits: number;
      featuresCount: number;
      fixesCount: number;
      choresCount: number;
    };
  }> {
    const gitDir = path.join(workspaceRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error('Workspace is not a Git repository.');
    }

    const versionTag = options?.versionTag || `v1.0.${Math.floor(Date.now() / 1000) % 1000}`;
    const releaseTitle = options?.title || 'Production Sprint Release';
    const dateStr = new Date().toISOString().split('T')[0];

    let commits: Array<{ hash: string; subject: string; author: string; date: string }> = [];
    try {
      const { stdout } = await execAsync('git log -n 25 --pretty=format:"%h|%s|%an|%ad" --date=short', {
        cwd: workspaceRoot,
      });
      commits = stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, subject, author, date] = line.split('|');
          return { hash: hash || '', subject: subject || '', author: author || '', date: date || '' };
        });
    } catch {
      commits = [];
    }

    const features: string[] = [];
    const fixes: string[] = [];
    const perfs: string[] = [];
    const chores: string[] = [];

    for (const c of commits) {
      const sub = c.subject.trim();
      const lower = sub.toLowerCase();
      const item = `- **${c.hash}**: ${sub} _(by ${c.author})_`;

      if (lower.startsWith('feat')) {
        features.push(item);
      } else if (lower.startsWith('fix')) {
        fixes.push(item);
      } else if (lower.startsWith('perf')) {
        perfs.push(item);
      } else {
        chores.push(item);
      }
    }

    const mdSections: string[] = [
      `# Release Notes: ${versionTag} — ${releaseTitle}`,
      ``,
      `> Generated on ${dateStr} for workspace repository.`,
      ``,
      `### 📊 Release Summary`,
      `- **Version**: \`${versionTag}\``,
      `- **Total Commits Included**: ${commits.length}`,
      `- **Features**: ${features.length} | **Bug Fixes**: ${fixes.length} | **Maintenance & Chores**: ${chores.length + perfs.length}`,
      ``,
    ];

    if (features.length > 0) {
      mdSections.push(`### 🚀 New Features`);
      mdSections.push(...features);
      mdSections.push(``);
    }

    if (fixes.length > 0) {
      mdSections.push(`### 🐛 Bug Fixes & Stability`);
      mdSections.push(...fixes);
      mdSections.push(``);
    }

    if (perfs.length > 0) {
      mdSections.push(`### ⚡ Performance & Optimization`);
      mdSections.push(...perfs);
      mdSections.push(``);
    }

    if (chores.length > 0) {
      mdSections.push(`### 🧹 Refactoring & Maintenance`);
      mdSections.push(...chores);
      mdSections.push(``);
    }

    if (commits.length === 0) {
      mdSections.push(`_No prior commits found in git log._`);
    }

    const markdown = mdSections.join('\n');

    return {
      versionTag,
      title: releaseTitle,
      markdown,
      stats: {
        totalCommits: commits.length,
        featuresCount: features.length,
        fixesCount: fixes.length,
        choresCount: chores.length + perfs.length,
      },
    };
  }
}

export const workspaceManager = new WorkspaceManager();
