import React, { useState, useEffect } from 'react';
import {
  X,
  GitCommit,
  Tag,
  Sparkles,
  FileText,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ArrowRight,
  Download,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import {
  generateSemanticCommitApi,
  generateReleaseNotesApi,
  SemanticCommitResult,
  ReleaseNotesResult,
} from '../../lib/api';

interface GitReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName?: string;
}

export const GitReleaseModal: React.FC<GitReleaseModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
}) => {
  const [activeTab, setActiveTab] = useState<'commit' | 'release'>('commit');

  // Semantic Commit State
  const [isAnalyzingCommit, setIsAnalyzingCommit] = useState(false);
  const [commitResult, setCommitResult] = useState<SemanticCommitResult | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccessHash, setCommitSuccessHash] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [copiedCommitCmd, setCopiedCommitCmd] = useState(false);

  // Release Notes State
  const [versionTag, setVersionTag] = useState('v1.1.0');
  const [releaseTitle, setReleaseTitle] = useState('Production Sprint Release');
  const [isGeneratingRelease, setIsGeneratingRelease] = useState(false);
  const [releaseResult, setReleaseResult] = useState<ReleaseNotesResult | null>(null);
  const [copiedChangelog, setCopiedChangelog] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  // Auto-analyze diffs when opening modal
  useEffect(() => {
    if (!isOpen || !workspaceId) return;
    setCommitSuccessHash(null);
    setCommitError(null);
    handleAnalyzeCommit();
  }, [isOpen, workspaceId]);

  const handleAnalyzeCommit = async () => {
    setIsAnalyzingCommit(true);
    setCommitError(null);
    try {
      const res = await generateSemanticCommitApi(workspaceId, false);
      setCommitResult(res);
      setCustomTitle(res.commitTitle);
      setCustomBody(res.commitBody);
    } catch (err: any) {
      setCommitError(err.message || 'Failed to inspect Git workspace status');
    } finally {
      setIsAnalyzingCommit(false);
    }
  };

  const handlePerformCommit = async () => {
    if (!customTitle.trim()) return;
    setIsCommitting(true);
    setCommitError(null);
    try {
      const res = await generateSemanticCommitApi(workspaceId, true);
      if (res.committed && res.commitHash) {
        setCommitSuccessHash(res.commitHash);
        // Refresh status
        setTimeout(() => handleAnalyzeCommit(), 1500);
      }
    } catch (err: any) {
      setCommitError(err.message || 'Failed to commit changes');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCopyCommitCmd = () => {
    const fullMsg = `${customTitle}\n\n${customBody}`;
    const cmd = `git commit -m "${fullMsg.replace(/"/g, '\\"')}"`;
    navigator.clipboard.writeText(cmd);
    setCopiedCommitCmd(true);
    setTimeout(() => setCopiedCommitCmd(false), 2000);
  };

  const handleGenerateReleaseNotes = async () => {
    setIsGeneratingRelease(true);
    setReleaseError(null);
    try {
      const res = await generateReleaseNotesApi(workspaceId, {
        versionTag: versionTag.trim(),
        title: releaseTitle.trim(),
      });
      setReleaseResult(res);
    } catch (err: any) {
      setReleaseError(err.message || 'Failed to generate release notes');
    } finally {
      setIsGeneratingRelease(false);
    }
  };

  const handleCopyChangelog = () => {
    if (!releaseResult?.markdown) return;
    navigator.clipboard.writeText(releaseResult.markdown);
    setCopiedChangelog(true);
    setTimeout(() => setCopiedChangelog(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0b0f17] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2436] bg-[#0d131f]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Git Release &amp; Semantic Commit Assistant
                </h2>
                {workspaceName && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#182435] border border-[#24354c] text-slate-300">
                    {workspaceName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated Conventional Commits, diff inspection, and structured release notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-[#111823] border border-[#1e293b]">
              <button
                onClick={() => setActiveTab('commit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'commit'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span>Semantic Commit</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('release');
                  if (!releaseResult) handleGenerateReleaseNotes();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'release'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Release Notes</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-[#192435] rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab 1: Semantic Commit */}
        {activeTab === 'commit' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
            {commitSuccessHash && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Successfully committed changes! Commit SHA: <strong className="font-mono">{commitSuccessHash}</strong>
                  </span>
                </div>
              </div>
            )}

            {commitError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{commitError}</span>
              </div>
            )}

            {/* Changed Files Overview */}
            <div className="p-4 rounded-xl bg-[#0f1624] border border-[#1e293b] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  Working Tree Modifications
                </span>
                <button
                  onClick={handleAnalyzeCommit}
                  disabled={isAnalyzingCommit}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isAnalyzingCommit ? 'animate-spin' : ''}`} />
                  <span>Refresh Diffs</span>
                </button>
              </div>

              {isAnalyzingCommit ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  <Sparkles className="w-5 h-5 text-emerald-400 animate-spin mx-auto mb-1" />
                  Analyzing git status &amp; diff hunks...
                </div>
              ) : commitResult?.files && commitResult.files.length > 0 ? (
                <div className="max-h-36 overflow-y-auto space-y-1.5 no-scrollbar pr-1">
                  {commitResult.files.map((f) => (
                    <div
                      key={f.file}
                      className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-[#141d2c] border border-[#1e293b] text-xs font-mono"
                    >
                      <span className="text-slate-300 truncate">{f.file}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          f.status === 'added'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : f.status === 'deleted'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {f.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">
                  No unstaged or modified files detected in this workspace.
                </p>
              )}
            </div>

            {/* Synthesized Conventional Commit Message */}
            <div className="space-y-3 bg-[#0d131f] p-4 rounded-xl border border-[#1e293b]">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Conventional Commit Title</span>
                  {commitResult?.commitType && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                      type: {commitResult.commitType}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. feat(workspace): implement semantic release assistant"
                  className="w-full px-3.5 py-2 bg-[#121927] border border-[#1e293b] rounded-lg text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Commit Body &amp; Scope Summary</label>
                <textarea
                  rows={5}
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#121927] border border-[#1e293b] rounded-lg text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 leading-relaxed"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyCommitCmd}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#141d2c] hover:bg-[#1a2638] border border-[#1e293b] text-xs font-medium text-slate-300 transition-colors"
              >
                {copiedCommitCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCommitCmd ? 'Copied Command!' : 'Copy `git commit` Command'}</span>
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePerformCommit}
                  disabled={isCommitting || !commitResult?.hasChanges || !customTitle.trim()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <GitCommit className="w-4 h-4" />
                  <span>{isCommitting ? 'Committing...' : 'Commit Changes (Atomic)'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Release Notes & Changelog */}
        {activeTab === 'release' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
            {releaseError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{releaseError}</span>
              </div>
            )}

            {/* Config inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-[#0d131f] p-4 rounded-xl border border-[#1e293b]">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Version Tag</label>
                <input
                  type="text"
                  value={versionTag}
                  onChange={(e) => setVersionTag(e.target.value)}
                  placeholder="e.g. v1.2.0"
                  className="w-full px-3.5 py-2 bg-[#121927] border border-[#1e293b] rounded-lg text-xs font-mono text-white focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Release Title</label>
                <input
                  type="text"
                  value={releaseTitle}
                  onChange={(e) => setReleaseTitle(e.target.value)}
                  placeholder="e.g. Sprint 3 Feature Rollout"
                  className="w-full px-3.5 py-2 bg-[#121927] border border-[#1e293b] rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/60"
                />
              </div>
            </div>

            {/* Telemetry Stats Bar */}
            {releaseResult?.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#0f1624] border border-[#1e293b] text-center">
                  <div className="text-base font-bold text-white">{releaseResult.stats.totalCommits}</div>
                  <div className="text-[10px] text-slate-400">Total Commits</div>
                </div>
                <div className="p-3 rounded-xl bg-[#0f1624] border border-[#1e293b] text-center">
                  <div className="text-base font-bold text-emerald-400">{releaseResult.stats.featuresCount}</div>
                  <div className="text-[10px] text-slate-400">Features</div>
                </div>
                <div className="p-3 rounded-xl bg-[#0f1624] border border-[#1e293b] text-center">
                  <div className="text-base font-bold text-amber-400">{releaseResult.stats.fixesCount}</div>
                  <div className="text-[10px] text-slate-400">Bug Fixes</div>
                </div>
                <div className="p-3 rounded-xl bg-[#0f1624] border border-[#1e293b] text-center">
                  <div className="text-base font-bold text-cyan-400">{releaseResult.stats.choresCount}</div>
                  <div className="text-[10px] text-slate-400">Chores &amp; Refactors</div>
                </div>
              </div>
            )}

            {/* Release Notes Markdown Area */}
            <div className="space-y-1.5 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  Generated Release Notes (Markdown)
                </span>
                <button
                  onClick={handleGenerateReleaseNotes}
                  disabled={isGeneratingRelease}
                  className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isGeneratingRelease ? 'animate-spin' : ''}`} />
                  <span>Regenerate</span>
                </button>
              </div>

              {isGeneratingRelease ? (
                <div className="p-10 rounded-xl bg-[#0b0e14] border border-[#1e293b] text-center text-xs text-slate-500">
                  <Sparkles className="w-6 h-6 text-emerald-400 animate-spin mx-auto mb-2" />
                  Generating Release Notes from Git commits...
                </div>
              ) : (
                <textarea
                  rows={8}
                  readOnly
                  value={releaseResult?.markdown || ''}
                  className="w-full p-3.5 bg-[#0b0e14] border border-[#1e293b] rounded-xl text-xs font-mono text-slate-300 leading-relaxed focus:outline-none"
                />
              )}
            </div>

            {/* Release Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCopyChangelog}
                disabled={!releaseResult?.markdown}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#141d2c] hover:bg-[#1a2638] border border-[#1e293b] text-xs font-medium text-slate-300 transition-colors disabled:opacity-50"
              >
                {copiedChangelog ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedChangelog ? 'Copied Markdown!' : 'Copy Markdown'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
