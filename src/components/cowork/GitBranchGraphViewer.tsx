import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  GitMerge,
  Tag,
  Search,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  User as UserIcon,
  ChevronRight,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { Workspace } from '../../server/types';
import { fetchGitGraphApi } from '../../lib/api';

interface GitRoute {
  fromLane: number;
  toLane: number;
  type: 'direct' | 'branch' | 'merge';
}

interface GitCommitNode {
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

interface GitBranchGraph {
  isGit: boolean;
  workspaceDir: string;
  currentBranch: string | null;
  totalCommits: number;
  lanesCount: number;
  commits: GitCommitNode[];
  branches: { name: string; current: boolean; commitHash: string }[];
  tags: { name: string; commitHash: string }[];
  asciiTree: string;
}

interface GitBranchGraphViewerProps {
  workspace: Workspace | null;
}

export const GitBranchGraphViewer: React.FC<GitBranchGraphViewerProps> = ({ workspace }) => {
  const [graph, setGraph] = useState<GitBranchGraph | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [maxCount, setMaxCount] = useState<number>(50);
  const [selectedCommit, setSelectedCommit] = useState<GitCommitNode | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [viewAscii, setViewAscii] = useState<boolean>(false);

  const loadGraph = async () => {
    if (!workspace) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGitGraphApi(workspace.id, maxCount);
      setGraph(data);
      if (data?.commits?.length > 0 && !selectedCommit) {
        setSelectedCommit(data.commits[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Git branch graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, [workspace?.id, maxCount]);

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
        <GitBranch className="w-12 h-12 mb-3 stroke-[1.5] text-slate-300" />
        <p className="text-sm font-medium">Select a workspace to view Git branch topology</p>
      </div>
    );
  }

  if (loading && !graph) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-[#EA580C]" />
        <p className="text-sm font-medium text-slate-600">Analyzing Git branch graph & commit history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-sm font-semibold text-rose-700 mb-2">Error Loading Git Topology</p>
          <p className="text-xs text-rose-600 mb-4">{error}</p>
          <button
            onClick={loadGraph}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!graph?.isGit) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 max-w-md text-center">
          <GitBranch className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800 mb-1">Not a Git Repository</h4>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            This workspace folder is not currently tracked by Git. Initialize a Git repository with <code className="bg-amber-100 text-amber-800 px-1 py-0.5 rounded text-[11px]">git init</code> to unlock the visual branch topology graph.
          </p>
        </div>
      </div>
    );
  }

  const filteredCommits = (graph?.commits || []).filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.hash.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q) ||
      c.authorName.toLowerCase().includes(q) ||
      c.branches.some((b) => b.toLowerCase().includes(q)) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const ROW_HEIGHT = 48;
  const LANE_WIDTH = 22;
  const LEFT_PADDING = 16;
  const svgWidth = Math.max((graph?.lanesCount || 1) * LANE_WIDTH + LEFT_PADDING * 2, 48);

  return (
    <div className="flex flex-col h-full bg-[#FAF8F5] select-none overflow-hidden font-sans text-slate-800">
      {/* Top Controls Toolbar */}
      <div className="border-b border-[#EBE7DF] bg-white px-4 py-2.5 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#EA580C] shrink-0">
            <GitBranch className="w-4 h-4" />
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-slate-900 truncate">Git Topology</span>
            {graph.currentBranch && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {graph.currentBranch}
              </span>
            )}
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              {graph.totalCommits} commits • {graph.lanesCount} lanes • {graph.branches.length} branches
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Search Filter */}
          <div className="relative w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter commits, branches..."
              className="w-full bg-[#FAF8F5] border border-[#E5E0D8] rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#EA580C] focus:bg-white transition-colors"
            />
          </div>

          {/* Max count dropdown */}
          <select
            value={maxCount}
            onChange={(e) => setMaxCount(parseInt(e.target.value, 10))}
            className="bg-white border border-[#E5E0D8] rounded-lg px-2 py-1 text-xs text-slate-600 font-medium cursor-pointer hover:border-slate-300 transition-colors"
          >
            <option value={25}>25 commits</option>
            <option value={50}>50 commits</option>
            <option value={100}>100 commits</option>
            <option value={200}>200 commits</option>
          </select>

          {/* Toggle ASCII Tree */}
          <button
            onClick={() => setViewAscii(!viewAscii)}
            title="Toggle ASCII terminal tree"
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              viewAscii
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-[#E5E0D8] text-slate-600 hover:border-slate-300'
            }`}
          >
            ASCII
          </button>

          {/* Refresh */}
          <button
            onClick={loadGraph}
            title="Refresh Git Graph"
            className="p-1.5 rounded-lg border border-[#E5E0D8] bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#EA580C]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area: Split List & Detail Drawer */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Commits & Topology List */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-white border-r border-[#EBE7DF]">
          {viewAscii ? (
            <div className="p-4 font-mono text-xs text-slate-800 whitespace-pre overflow-x-auto leading-relaxed bg-[#FAF8F5]">
              {graph.asciiTree}
            </div>
          ) : filteredCommits.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <Search className="w-8 h-8 mb-2 stroke-[1.5]" />
              <p className="text-xs">No commits matching &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            <div className="flex relative min-h-full">
              {/* Left Column: Topological SVG Lanes */}
              <div
                className="shrink-0 relative bg-slate-50/50 border-r border-slate-100"
                style={{ width: `${svgWidth}px` }}
              >
                <svg
                  width={svgWidth}
                  height={filteredCommits.length * ROW_HEIGHT}
                  className="absolute inset-0 pointer-events-none"
                >
                  {filteredCommits.map((c, index) => {
                    const cx = LEFT_PADDING + c.lane * LANE_WIDTH;
                    const cy = index * ROW_HEIGHT + ROW_HEIGHT / 2;

                    return (
                      <g key={`routes-${c.hash}-${index}`}>
                        {c.routes.map((route, rIdx) => {
                          const nextIdx = index + 1;
                          if (nextIdx >= filteredCommits.length) return null;
                          const fromX = LEFT_PADDING + route.fromLane * LANE_WIDTH;
                          const toX = LEFT_PADDING + route.toLane * LANE_WIDTH;
                          const fromY = cy;
                          const toY = nextIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                          const midY = (fromY + toY) / 2;

                          return (
                            <path
                              key={`route-${rIdx}-${route.fromLane}-${route.toLane}`}
                              d={`M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`}
                              fill="none"
                              stroke={c.color}
                              strokeWidth={2}
                              strokeOpacity={0.8}
                            />
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Draw Commit Nodes */}
                  {filteredCommits.map((c, index) => {
                    const cx = LEFT_PADDING + c.lane * LANE_WIDTH;
                    const cy = index * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const isSelected = selectedCommit?.hash === c.hash;
                    const isMerge = c.parents.length > 1;

                    return (
                      <g key={`node-${c.hash}-${index}`}>
                        {c.isHead && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={9}
                            fill="none"
                            stroke={c.color}
                            strokeWidth={1.5}
                            strokeDasharray="2 2"
                            className="animate-pulse"
                          />
                        )}
                        {isSelected && (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={8}
                            fill="none"
                            stroke="#0F172A"
                            strokeWidth={2}
                          />
                        )}
                        {isMerge ? (
                          <rect
                            x={cx - 5}
                            y={cy - 5}
                            width={10}
                            height={10}
                            transform={`rotate(45 ${cx} ${cy})`}
                            fill={c.color}
                            stroke="#FFFFFF"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={5.5}
                            fill={c.color}
                            stroke="#FFFFFF"
                            strokeWidth={1.5}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Right Column: Commit Row Data */}
              <div className="flex-1 min-w-0 divide-y divide-slate-100">
                {filteredCommits.map((c) => {
                  const isSelected = selectedCommit?.hash === c.hash;

                  return (
                    <div
                      key={c.hash}
                      onClick={() => setSelectedCommit(c)}
                      className={`h-[48px] px-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#FFF7ED] text-slate-900 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Short Hash Pill */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyHash(c.hash);
                          }}
                          title={`Copy commit ${c.hash}`}
                          className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 flex items-center gap-1 transition-colors"
                        >
                          {copiedHash === c.hash ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            c.shortHash
                          )}
                        </button>

                        {/* Branch Decorators */}
                        {c.branches.map((b) => (
                          <span
                            key={b}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 flex items-center gap-0.5 ${
                              b === graph.currentBranch
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-sky-100 text-sky-800 border border-sky-300'
                            }`}
                          >
                            <GitBranch className="w-2.5 h-2.5" />
                            {b}
                          </span>
                        ))}

                        {/* Tag Decorators */}
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-0.5"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {t}
                          </span>
                        ))}

                        {/* Commit Subject */}
                        <span className="text-xs truncate font-medium flex-1">
                          {c.subject}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-slate-400 text-[11px]">
                        <span className="hidden sm:inline truncate max-w-[120px]">
                          {c.authorName}
                        </span>
                        <span className="whitespace-nowrap font-mono">{c.relativeDate}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Selected Commit Detail Panel */}
        {selectedCommit && (
          <div className="w-full md:w-80 lg:w-96 bg-[#FAF8F5] border-t md:border-t-0 md:border-l border-[#EBE7DF] flex flex-col shrink-0 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#EBE7DF]">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedCommit.color }}
                />
                <span className="text-xs font-bold text-slate-900 font-mono">
                  {selectedCommit.shortHash}
                </span>
                {selectedCommit.isHead && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                    HEAD
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCopyHash(selectedCommit.hash)}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                {copiedHash === selectedCommit.hash ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy SHA</span>
                  </>
                )}
              </button>
            </div>

            {/* Commit Message */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Commit Message
              </label>
              <div className="text-xs font-semibold text-slate-900 bg-white p-3 rounded-xl border border-[#E5E0D8] leading-relaxed break-words shadow-2xs">
                {selectedCommit.subject}
              </div>
            </div>

            {/* Author & Timestamp */}
            <div className="bg-white p-3 rounded-xl border border-[#E5E0D8] space-y-2 text-xs shadow-2xs">
              <div className="flex items-center gap-2 text-slate-700">
                <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold">{selectedCommit.authorName}</span>
                <span className="text-[10px] text-slate-400 font-mono truncate">
                  &lt;{selectedCommit.authorEmail}&gt;
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono text-[11px]">{selectedCommit.authorDate}</span>
                <span className="text-slate-400 text-[10px]">({selectedCommit.relativeDate})</span>
              </div>
            </div>

            {/* Parents & Merges */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Parent Commits ({selectedCommit.parents.length})
              </label>
              {selectedCommit.parents.length === 0 ? (
                <div className="text-xs text-slate-400 italic">Initial root commit (no parents)</div>
              ) : (
                <div className="space-y-1">
                  {selectedCommit.parents.map((pHash) => (
                    <div
                      key={pHash}
                      onClick={() => {
                        const target = graph.commits.find((c) => c.hash === pHash);
                        if (target) setSelectedCommit(target);
                      }}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700 hover:border-slate-400 cursor-pointer transition-colors shadow-2xs"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <GitCommit className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{pHash.substring(0, 10)}...</span>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Branches & Tags on this commit */}
            {(selectedCommit.branches.length > 0 || selectedCommit.tags.length > 0) && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  References
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCommit.branches.map((b) => (
                    <span
                      key={b}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <GitBranch className="w-3 h-3" />
                      {b}
                    </span>
                  ))}
                  {selectedCommit.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Tag className="w-3 h-3" />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
