import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Replace,
  Sparkles,
  FileText,
  Check,
  AlertCircle,
  FileCode,
  ArrowRight,
  Filter,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import {
  searchAndReplaceApi,
  SearchReplaceResult,
  SearchMatch,
  FileReplacePreview,
} from '../../lib/api';

interface SearchReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName?: string;
  onFileSelect?: (filePath: string) => void;
}

export const SearchReplaceModal: React.FC<SearchReplaceModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
  onFileSelect,
}) => {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [filePattern, setFilePattern] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<SearchReplaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Expanded file accordions
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});

  // Reset state when opening
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccessMessage(null);
  }, [isOpen]);

  const handleSearch = async (dryRun = true) => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await searchAndReplaceApi(workspaceId, {
        query,
        replacement: replacement !== '' ? replacement : undefined,
        isRegex,
        matchCase,
        wholeWord,
        filePattern: filePattern.trim() || undefined,
        dryRun,
      });

      setResult(res);

      // Auto-expand all files
      const newExpanded: Record<string, boolean> = {};
      res.matches.forEach((m) => {
        newExpanded[m.file] = true;
      });
      res.filePreviews.forEach((p) => {
        newExpanded[p.file] = true;
      });
      setExpandedFiles(newExpanded);

      if (!dryRun && res.applied) {
        setSuccessMessage(
          `Successfully replaced ${res.totalMatches} match(es) across ${res.filesCount} file(s)!`
        );
      }
    } catch (err: any) {
      setError(err.message || 'Search and replace failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyReplaceAll = async () => {
    if (!result || result.totalMatches === 0) return;
    if (
      !confirm(
        `Are you sure you want to replace ${result.totalMatches} match(es) across ${result.filesCount} file(s)? This will modify files on disk.`
      )
    ) {
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      await handleSearch(false);
    } finally {
      setIsApplying(false);
    }
  };

  // Group matches by file
  const matchesByFile = useMemo(() => {
    if (!result?.matches) return {};
    const map: Record<string, SearchMatch[]> = {};
    for (const m of result.matches) {
      if (!map[m.file]) map[m.file] = [];
      map[m.file].push(m);
    }
    return map;
  }, [result]);

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [file]: !prev[file],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0b0f17] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2436] bg-[#0d131f]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Multi-File Search &amp; Replace
                </h2>
                {workspaceName && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#182435] border border-[#24354c] text-slate-300">
                    {workspaceName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-project regular expressions, match highlights, diff inspection, and atomic replacements
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#192435] rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Replace Form Controls */}
        <div className="p-5 border-b border-[#1a2436] bg-[#0d1421] space-y-3">
          {/* Row 1: Search Query + Modifier Toggles */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch(true);
                }}
                placeholder="Search across project (e.g. verifyJwt, /api/v1/.*)..."
                className="w-full pl-9 pr-24 py-2 bg-[#121927] border border-[#1e293b] rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
              />

              {/* Toggles inside Search Box */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMatchCase(!matchCase)}
                  title="Match Case (Case Sensitive)"
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold font-mono transition-colors ${
                    matchCase
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Aa
                </button>
                <button
                  type="button"
                  onClick={() => setWholeWord(!wholeWord)}
                  title="Match Whole Word"
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold font-mono transition-colors ${
                    wholeWord
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  \b
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegex(!isRegex)}
                  title="Use Regular Expression"
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold font-mono transition-colors ${
                    isRegex
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  .*
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSearch(true)}
              disabled={isLoading || !query.trim()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-all shadow-md shadow-cyan-600/20 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Find Matches</span>
            </button>
          </div>

          {/* Row 2: Replacement Input + File Pattern Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Replace className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch(true);
                }}
                placeholder="Replace with (supports $1, $2 capture groups)..."
                className="w-full pl-9 pr-3 py-2 bg-[#121927] border border-[#1e293b] rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="relative">
              <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filePattern}
                onChange={(e) => setFilePattern(e.target.value)}
                placeholder="files to include (e.g. *.ts, *.tsx, src/*)..."
                className="w-full pl-9 pr-3 py-2 bg-[#121927] border border-[#1e293b] rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
              />
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Results Metadata Bar */}
        {result && (
          <div className="px-6 py-2.5 bg-[#0e1624] border-b border-[#1a2436] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">
                {result.totalMatches} match{result.totalMatches === 1 ? '' : 'es'}
              </span>
              <span className="text-slate-400">across</span>
              <span className="font-semibold text-white">
                {result.filesCount} file{result.filesCount === 1 ? '' : 's'}
              </span>
            </div>

            {replacement !== '' && result.totalMatches > 0 && (
              <button
                type="button"
                onClick={handleApplyReplaceAll}
                disabled={isApplying}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                <Replace className="w-3.5 h-3.5" />
                <span>{isApplying ? 'Applying...' : `Replace All in ${result.filesCount} File(s)`}</span>
              </button>
            )}
          </div>
        )}

        {/* Matches & Diffs Tree */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500">
              <Sparkles className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
              <p className="text-xs">Searching codebase...</p>
            </div>
          ) : !result ? (
            <div className="py-16 text-center text-slate-500 border border-dashed border-[#1e293b] rounded-2xl">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-400">Search and Replace Across Workspace</p>
              <p className="text-xs text-slate-500 mt-1">
                Enter a term above and click <strong>Find Matches</strong> to inspect results with live diffs.
              </p>
            </div>
          ) : result.totalMatches === 0 ? (
            <div className="py-16 text-center text-slate-500 border border-dashed border-[#1e293b] rounded-2xl">
              <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-400">No matches found for &quot;{result.query}&quot;</p>
              <p className="text-xs text-slate-500 mt-1">Check your search query, regex syntax, or file filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(matchesByFile).map(([filePath, matches]) => {
                const isExpanded = expandedFiles[filePath] !== false;
                const preview = result.filePreviews.find((p) => p.file === filePath);

                return (
                  <div
                    key={filePath}
                    className="rounded-xl bg-[#0e1522] border border-[#1e293b] overflow-hidden"
                  >
                    {/* File Header */}
                    <div
                      onClick={() => toggleFile(filePath)}
                      className="flex items-center justify-between px-4 py-2.5 bg-[#121a29] hover:bg-[#162133] transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="text-xs font-mono font-medium text-white truncate">
                          {filePath}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                          {matches.length} match{matches.length === 1 ? '' : 'es'}
                        </span>
                        {onFileSelect && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onFileSelect(filePath);
                              onClose();
                            }}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#1f2b40] transition-colors"
                            title="Open in Editor"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* File Matches & Diff Preview */}
                    {isExpanded && (
                      <div className="p-3 space-y-2 border-t border-[#1a2436]">
                        {/* Inline Unified Diff snippet if replacement was tested */}
                        {preview?.diff && (
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              Replacement Diff Preview:
                            </span>
                            <pre className="p-2.5 rounded-lg bg-[#070a10] border border-[#1e293b] text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre leading-relaxed">
                              {preview.diff.split('\n').map((line, idx) => {
                                const isAdd = line.startsWith('+');
                                const isDel = line.startsWith('-');
                                return (
                                  <div
                                    key={idx}
                                    className={`${
                                      isAdd
                                        ? 'bg-emerald-500/15 text-emerald-300'
                                        : isDel
                                        ? 'bg-red-500/15 text-red-300'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {line}
                                  </div>
                                );
                              })}
                            </pre>
                          </div>
                        )}

                        {/* Matches List */}
                        <div className="space-y-1">
                          {matches.map((m, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg bg-[#080d16] border border-[#172233] text-xs font-mono hover:border-cyan-500/40 transition-colors"
                            >
                              <span className="text-cyan-400 text-[11px] font-bold shrink-0 pt-0.5">
                                L{m.line}:{m.column}
                              </span>
                              <span className="text-slate-300 break-all leading-relaxed">
                                {m.preview}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1a2436] bg-[#0d131f] flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Tip: Press <code className="bg-[#141d2c] px-1 py-0.5 rounded text-cyan-400">Ctrl+Shift+F</code> to open anytime
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
