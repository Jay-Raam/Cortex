import fs from 'node:fs';
import path from 'node:path';
import { safeExecGit } from '../security/git-security';

export interface GitRoute {
  fromLane: number;
  toLane: number;
  type: 'direct' | 'branch' | 'merge';
}

export interface GitCommitNode {
  hash: string;
  shortHash: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  relativeDate: string;
  parents: string[];
  branches: string[];
  tags: string[];
  isHead: boolean;
  lane: number;
  color: string;
  routes: GitRoute[];
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  commitHash: string;
}

export interface GitTagInfo {
  name: string;
  commitHash: string;
}

export interface GitBranchGraph {
  isGit: boolean;
  workspaceDir: string;
  currentBranch: string | null;
  totalCommits: number;
  lanesCount: number;
  commits: GitCommitNode[];
  branches: GitBranchInfo[];
  tags: GitTagInfo[];
  asciiTree: string;
}

export const GIT_LANE_PALETTE = [
  '#38BDF8', // Sky 400
  '#A855F7', // Purple 500
  '#22C55E', // Green 500
  '#F97316', // Orange 500
  '#EC4899', // Pink 500
  '#EAB308', // Yellow 500
  '#06B6D4', // Cyan 500
  '#6366F1', // Indigo 500
  '#14B8A6', // Teal 500
  '#F43F5E', // Rose 500
];

/**
 * Parses Git ref names string (from %D) into structured branches, tags, and HEAD flag.
 */
export function parseRefDecorations(refStr: string): {
  branches: string[];
  tags: string[];
  isHead: boolean;
  headBranch?: string;
} {
  const branches: string[] = [];
  const tags: string[] = [];
  let isHead = false;
  let headBranch: string | undefined;

  if (!refStr || !refStr.trim()) {
    return { branches, tags, isHead };
  }

  const items = refStr.split(',').map((s) => s.trim()).filter(Boolean);
  for (const item of items) {
    if (item.startsWith('HEAD -> ')) {
      isHead = true;
      const branch = item.replace('HEAD -> ', '').trim();
      headBranch = branch;
      if (!branches.includes(branch)) {
        branches.push(branch);
      }
    } else if (item === 'HEAD') {
      isHead = true;
    } else if (item.startsWith('tag: ')) {
      const tag = item.replace('tag: ', '').trim();
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    } else if (item.startsWith('origin/HEAD') || item.includes('/HEAD')) {
      // Ignore symbolic remote HEAD
      continue;
    } else {
      if (!branches.includes(item)) {
        branches.push(item);
      }
    }
  }

  return { branches, tags, isHead, headBranch };
}

/**
 * Calculates topological lanes and connection routes for an ordered list of commits.
 */
export function computeTopologicalLanes(
  rawCommits: Array<{
    hash: string;
    shortHash: string;
    subject: string;
    authorName: string;
    authorEmail: string;
    authorDate: string;
    relativeDate: string;
    parents: string[];
    branches: string[];
    tags: string[];
    isHead: boolean;
  }>
): { commits: GitCommitNode[]; lanesCount: number } {
  let activeLanes: (string | null)[] = [];
  const commits: GitCommitNode[] = [];
  let maxLanesObserved = 1;

  for (const raw of rawCommits) {
    // 1. Assign this commit to a lane
    let laneIndex = activeLanes.indexOf(raw.hash);
    if (laneIndex === -1) {
      laneIndex = activeLanes.findIndex((l) => l === null);
      if (laneIndex === -1) {
        laneIndex = activeLanes.length;
        activeLanes.push(raw.hash);
      } else {
        activeLanes[laneIndex] = raw.hash;
      }
    }

    if (laneIndex + 1 > maxLanesObserved) {
      maxLanesObserved = laneIndex + 1;
    }

    const routes: GitRoute[] = [];
    const primaryParent = raw.parents[0];

    // 2. Route to primary parent
    if (!primaryParent) {
      // Initial root commit (no parents): lane is terminated
      activeLanes[laneIndex] = null;
    } else {
      const existingLane = activeLanes.indexOf(primaryParent);
      if (existingLane !== -1 && existingLane !== laneIndex) {
        routes.push({ fromLane: laneIndex, toLane: existingLane, type: 'merge' });
        activeLanes[laneIndex] = null;
      } else {
        activeLanes[laneIndex] = primaryParent;
        routes.push({ fromLane: laneIndex, toLane: laneIndex, type: 'direct' });
      }
    }

    // 3. Route to secondary parents (e.g. merge commits)
    for (let p = 1; p < raw.parents.length; p++) {
      const parentHash = raw.parents[p];
      const existingLane = activeLanes.indexOf(parentHash);
      if (existingLane !== -1) {
        routes.push({ fromLane: laneIndex, toLane: existingLane, type: 'merge' });
      } else {
        let newLane = activeLanes.findIndex((l) => l === null);
        if (newLane === -1) {
          newLane = activeLanes.length;
          activeLanes.push(parentHash);
        } else {
          activeLanes[newLane] = parentHash;
        }
        if (newLane + 1 > maxLanesObserved) {
          maxLanesObserved = newLane + 1;
        }
        routes.push({ fromLane: laneIndex, toLane: newLane, type: 'branch' });
      }
    }

    // 4. Prune trailing empty lanes
    while (activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
      activeLanes.pop();
    }

    commits.push({
      ...raw,
      lane: laneIndex,
      color: GIT_LANE_PALETTE[laneIndex % GIT_LANE_PALETTE.length],
      routes,
    });
  }

  return { commits, lanesCount: Math.max(1, maxLanesObserved) };
}

/**
 * Analyzes and constructs an interactive Git branch graph for any workspace directory.
 */
export async function getGitBranchGraph(
  workspaceDir: string,
  options: { maxCount?: number } = {}
): Promise<GitBranchGraph> {
  const resolvedDir = path.resolve(workspaceDir);
  const maxCount = Math.max(1, Math.min(options.maxCount || 50, 500));

  const fallbackEmpty: GitBranchGraph = {
    isGit: false,
    workspaceDir: resolvedDir,
    currentBranch: null,
    totalCommits: 0,
    lanesCount: 0,
    commits: [],
    branches: [],
    tags: [],
    asciiTree: 'Not a git repository.',
  };

  if (!fs.existsSync(resolvedDir)) {
    return fallbackEmpty;
  }

  // 1. Verify Git repository membership
  try {
    const isRepo = await safeExecGit(['rev-parse', '--is-inside-work-tree'], { cwd: resolvedDir });
    if (!isRepo.stdout || !isRepo.stdout.toLowerCase().includes('true')) {
      return fallbackEmpty;
    }

    // Must either have a local .git directory/file or be the designated repository root
    const hasDirectGit = fs.existsSync(path.join(resolvedDir, '.git'));
    if (!hasDirectGit) {
      const topLevelRes = await safeExecGit(['rev-parse', '--show-toplevel'], { cwd: resolvedDir });
      const topLevel = path.resolve(topLevelRes.stdout.trim());
      if (topLevel.toLowerCase() !== resolvedDir.toLowerCase()) {
        return fallbackEmpty;
      }
    }
  } catch {
    return fallbackEmpty;
  }

  // 2. Fetch current branch & list of all branches
  let currentBranch: string | null = null;
  const branches: GitBranchInfo[] = [];
  try {
    const branchRes = await safeExecGit(
      ['branch', '-a', '--format=%(refname:short)%09%(HEAD)%09%(objectname)'],
      { cwd: resolvedDir }
    );
    const lines = branchRes.stdout.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const [name, headStar, hash] = line.split('\t');
      if (!name || name.includes('/HEAD')) continue;
      const isCur = headStar?.trim() === '*';
      if (isCur) {
        currentBranch = name;
      }
      branches.push({
        name,
        current: isCur,
        commitHash: hash?.trim() || '',
      });
    }
  } catch {
    // Non-fatal if branch retrieval fails
  }

  // 3. Fetch tags
  const tags: GitTagInfo[] = [];
  try {
    const tagRes = await safeExecGit(['tag', '-l', '--format=%(refname:short)%09%(objectname)'], {
      cwd: resolvedDir,
    });
    const tagLines = tagRes.stdout.split('\n').filter((l) => l.trim().length > 0);
    for (const line of tagLines) {
      const [name, hash] = line.split('\t');
      if (name) {
        tags.push({ name: name.trim(), commitHash: hash?.trim() || '' });
      }
    }
  } catch {
    // Non-fatal
  }

  // 4. Fetch git graph ASCII tree
  let asciiTree = '';
  try {
    const graphRes = await safeExecGit(
      ['log', `-n`, String(maxCount), '--graph', '--oneline', '--decorate', '--color=never'],
      { cwd: resolvedDir }
    );
    asciiTree = graphRes.stdout.trim();
  } catch {
    asciiTree = 'No commits in repository.';
  }

  // 5. Fetch structured git log with Unit Separator delimiter
  const DELIMITER = '\x1f';
  let rawCommits: Array<{
    hash: string;
    shortHash: string;
    subject: string;
    authorName: string;
    authorEmail: string;
    authorDate: string;
    relativeDate: string;
    parents: string[];
    branches: string[];
    tags: string[];
    isHead: boolean;
  }> = [];

  try {
    const logRes = await safeExecGit(
      [
        'log',
        `-n`,
        String(maxCount),
        '--topo-order',
        `--format=%H${DELIMITER}%h${DELIMITER}%an${DELIMITER}%ae${DELIMITER}%aI${DELIMITER}%ar${DELIMITER}%P${DELIMITER}%D${DELIMITER}%s`,
      ],
      { cwd: resolvedDir }
    );

    const logLines = logRes.stdout.split('\n').filter((l) => l.trim().length > 0);
    for (const line of logLines) {
      const parts = line.split(DELIMITER);
      if (parts.length < 9) continue;

      const [
        hash,
        shortHash,
        authorName,
        authorEmail,
        authorDate,
        relativeDate,
        parentStr,
        refStr,
        subject,
      ] = parts;

      const parents = parentStr ? parentStr.trim().split(/\s+/).filter(Boolean) : [];
      const refDec = parseRefDecorations(refStr || '');

      if (!currentBranch && refDec.headBranch) {
        currentBranch = refDec.headBranch;
      }

      rawCommits.push({
        hash: hash.trim(),
        shortHash: shortHash.trim(),
        subject: subject.trim(),
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim(),
        authorDate: authorDate.trim(),
        relativeDate: relativeDate.trim(),
        parents,
        branches: refDec.branches,
        tags: refDec.tags,
        isHead: refDec.isHead,
      });
    }
  } catch {
    // If repository has no commits yet
    return {
      isGit: true,
      workspaceDir: resolvedDir,
      currentBranch,
      totalCommits: 0,
      lanesCount: 0,
      commits: [],
      branches,
      tags,
      asciiTree: asciiTree || 'No commits in repository.',
    };
  }

  // 6. Compute topological lanes and connection routes
  const { commits, lanesCount } = computeTopologicalLanes(rawCommits);

  return {
    isGit: true,
    workspaceDir: resolvedDir,
    currentBranch,
    totalCommits: commits.length,
    lanesCount,
    commits,
    branches,
    tags,
    asciiTree: asciiTree || 'No commits in repository.',
  };
}

/**
 * Formats a GitBranchGraph into a clean Unicode CLI string with colors/symbols.
 */
export function formatGitGraphCli(graph: GitBranchGraph): string {
  if (!graph.isGit) {
    return 'Not a git repository.';
  }

  if (graph.commits.length === 0) {
    return 'No commits in repository.';
  }

  const lines: string[] = [];
  lines.push(`Git Branch Topology (${graph.totalCommits} commits, ${graph.branches.length} branches, ${graph.tags.length} tags)`);
  lines.push(`Workspace: ${graph.workspaceDir}`);
  lines.push(`Current Branch: ${graph.currentBranch || 'HEAD (detached)'}`);
  lines.push('─'.repeat(70));

  for (const c of graph.commits) {
    // Visual lane prefix
    const indent = '  '.repeat(c.lane);
    const symbol = c.parents.length > 1 ? '◆' : '●';
    const headMarker = c.isHead ? ' [HEAD]' : '';
    const branchPills = c.branches.length > 0 ? ` (${c.branches.join(', ')})` : '';
    const tagPills = c.tags.length > 0 ? ` [tags: ${c.tags.join(', ')}]` : '';

    lines.push(
      `${indent}${symbol} ${c.shortHash}${headMarker}${branchPills}${tagPills} ${c.subject} - ${c.authorName} (${c.relativeDate})`
    );
  }

  lines.push('─'.repeat(70));
  return lines.join('\n');
}
