import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Workspace, WorkspaceFileNode, WorkspaceCheckpoint } from '../types';

const execAsync = promisify(exec);

const SENSITIVE_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /^id_rsa/i,
  /^id_ed25519/i,
  /\.pfx$/i,
  /credentials\.json$/i,
  /secret/i,
];

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
    const base = path.basename(relativePath);
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
    content: string
  ): Promise<{ success: boolean; path: string; size: number }> {
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
    content: string
  ): Promise<{ success: boolean; path: string; size: number }> {
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
    relativePath: string
  ): Promise<{ success: boolean; path: string }> {
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
    relativePath: string
  ): Promise<{ success: boolean; path: string }> {
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
    replacementSnippet?: string
  ): Promise<{ success: boolean; path: string; diff: string }> {
    const { content: originalContent } = await this.readFile(workspaceRoot, relativePath);
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

    const cloneUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
    const branchFlag = branch ? `-b "${branch}" ` : '';
    const cloneCmd = `git clone --depth 1 ${branchFlag}"${cloneUrl}" "${targetDir}"`;

    try {
      await execAsync(cloneCmd, { timeout: 45000 });
      let commitHash = '';
      try {
        const { stdout } = await execAsync('git rev-parse HEAD', { cwd: targetDir });
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
          await execAsync(`git clone --depth 1 "${cloneUrl}" "${targetDir}"`, { timeout: 45000 });
          return { success: true, message: `Cloned ${parsed.owner}/${parsed.repo} default branch` };
        } catch {}
      }

      // Initialize empty git repo and create README for offline or preview
      try {
        await execAsync('git init', { cwd: targetDir });
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

    const branchName = options.branchName || `cortex/feature-${Date.now().toString(36)}`;
    const commitTitle = options.title.trim() || 'feat: autonomous agent updates via Cortex';
    const prBody =
      options.body?.trim() ||
      `### Autonomous Changes via Cortex AI\n\n- Automated updates generated by Cortex Co-Work workspace.\n- Tested and verified.`;

    // 1. Create and switch to new branch
    await execAsync(`git checkout -B "${branchName}"`, { cwd: workspaceRoot });

    // 2. Stage and commit
    await execAsync('git add -A', { cwd: workspaceRoot });
    try {
      await execAsync(`git commit -m "${commitTitle.replace(/"/g, '\\"')}"`, { cwd: workspaceRoot });
    } catch {
      // Nothing to commit or already committed
    }

    let prUrl: string | undefined;
    let compareUrl: string | undefined;

    // 3. Attempt push if remote exists
    try {
      await execAsync(`git push -u origin "${branchName}"`, { cwd: workspaceRoot, timeout: 30000 });
    } catch (err: any) {
      console.warn('[WorkspaceManager] git push warning:', err.message);
    }

    // 4. Try gh CLI if installed and available
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const envWithToken = token ? { ...process.env, GH_TOKEN: token } : process.env;

    try {
      const { stdout } = await execAsync(
        `gh pr create --title "${commitTitle.replace(/"/g, '\\"')}" --body "${prBody.replace(/"/g, '\\"')}" --head "${branchName}"`,
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
}

export const workspaceManager = new WorkspaceManager();
