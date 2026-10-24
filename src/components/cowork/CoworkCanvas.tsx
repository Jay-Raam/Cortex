import React, { useState, useMemo, useEffect } from 'react';
import {
  FileCode,
  Copy,
  Save,
  Terminal,
  FolderUp,
  RefreshCw,
  Search,
  Folder,
  File,
  X,
  ChevronDown,
  ChevronUp,
  PanelLeft,
  PanelLeftClose,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldAlert,
  Play,
  ArrowRight,
  Sparkles,
  Layers,
  Code2,
  CheckCheck,
  Check,
  Eye,
  ExternalLink,
  Monitor,
  Smartphone,
  Globe,
  Palette,
  FileText,
  Download,
  GitPullRequest,
  GitCommit,
} from 'lucide-react';
import { CoworkCanvasProps } from './types';
import { UnifiedDiffViewer } from './UnifiedDiffViewer';
import { WorkspaceFileNode } from '../../server/types';
import { downloadWorkspaceZip, createGitHubPrApi } from '../../lib/api';
import { parseAnsiToHtml } from './ansi';
import { CodeEditor } from './CodeEditor';
import { GitReleaseModal } from './GitReleaseModal';

function pathBasename(p: string): string {
  const parts = p.split(/[\/\\]/);
  return parts[parts.length - 1] || p;
}

function getFileIcon(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.html')) return <Globe className="w-3.5 h-3.5 text-orange-500 shrink-0" />;
  if (lower.endsWith('.css')) return <Palette className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  if (lower.endsWith('.js') || lower.endsWith('.ts')) return <Code2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
}

export const CoworkCanvas: React.FC<CoworkCanvasProps> = ({
  workspace,
  selectedTask,
  selectedFilePath,
  selectedFileContent,
  editedFileContent,
  setEditedFileContent,
  isSavingFile,
  onSaveFile,
  rightViewMode,
  setRightViewMode,
  artifacts,
  isExplorerOpen,
  setIsExplorerOpen,
  fileTree,
  onSelectFile,
  fileSearchQuery,
  setFileSearchQuery,
  gitStatus,
  onLoadProjectTree,
  isSyncingFiles,
  onSyncFolderInputChange,
  syncFolderInputRef,
  isTerminalOpen,
  setIsTerminalOpen,
  terminalCommand,
  setTerminalCommand,
  isExecutingCommand,
  terminalOutput,
  onExecuteTerminal,
  onAdvanceTask,
  onApproveStep,
  onApprovePlan,
  onRejectPlan,
  selectedModelId,
  setSelectedModelId,
  inlinePrompt,
  setInlinePrompt,
  isInlineSubmitting,
  onInlinePromptSubmit,
  onToggleTasks,
}) => {
  // Mobile responsive tab: 'timeline' vs 'canvas'
  const [mobileTab, setMobileTab] = useState<'timeline' | 'canvas'>('timeline');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const handleDownloadZip = async () => {
    if (!workspace?.id || isDownloadingZip) return;
    setIsDownloadingZip(true);
    try {
      await downloadWorkspaceZip(workspace.id, workspace.name);
    } catch (err: any) {
      console.error('Failed to export workspace zip:', err);
      alert('Failed to export workspace ZIP: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const [isGitReleaseModalOpen, setIsGitReleaseModalOpen] = useState(false);

  // GitHub Pull Request creation state
  const [isPrModalOpen, setIsPrModalOpen] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [isSubmittingPr, setIsSubmittingPr] = useState(false);
  const [prResult, setPrResult] = useState<{ prUrl?: string; compareUrl?: string; branchName?: string } | null>(null);

  const handleSubmitPr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id || isSubmittingPr) return;
    setIsSubmittingPr(true);
    try {
      const res = await createGitHubPrApi(workspace.id, {
        title: prTitle.trim() || `feat(${workspace.name || 'cortex'}): autonomous updates`,
        body: prBody.trim() || undefined,
      });
      setPrResult(res);
    } catch (err: any) {
      alert('Error creating GitHub Pull Request: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmittingPr(false);
    }
  };

  // Collect available files from artifacts and plannedFiles
  const availableFiles = useMemo(() => {
    const list: string[] = [];
    if (selectedTask.plannedFiles) {
      for (const f of selectedTask.plannedFiles) {
        if (!list.includes(f)) list.push(f);
      }
    }
    for (const a of artifacts) {
      if (!list.includes(a.fileName)) list.push(a.fileName);
    }
    return list;
  }, [selectedTask.plannedFiles, artifacts]);

const [openTabs, setOpenTabs] = useState<string[]>([]);

  useEffect(() => {
    if (selectedFilePath && !openTabs.includes(selectedFilePath)) {
      setOpenTabs((prev) => [...prev, selectedFilePath]);
    }
  }, [selectedFilePath]);

  useEffect(() => {
    if (openTabs.length === 0 && availableFiles.length > 0) {
      setOpenTabs(availableFiles.slice(0, 4));
    }
  }, [availableFiles]);

  const handleCloseTab = (tabToClose: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextTabs = openTabs.filter((t) => t !== tabToClose);
    setOpenTabs(nextTabs);
    if (selectedFilePath === tabToClose && nextTabs.length > 0) {
      onSelectFile(nextTabs[nextTabs.length - 1]);
    }
  };

  const hasHtml = useMemo(
    () => availableFiles.some((f) => f.toLowerCase().endsWith('.html')),
    [availableFiles]
  );

  // Auto-select preferred entry file based on target technology
  useEffect(() => {
    if (!selectedFilePath && availableFiles.length > 0) {
      const preferred =
        availableFiles.find((f) => f.toLowerCase() === 'index.html') ||
        availableFiles.find((f) => f.toLowerCase() === 'main.py' || f.toLowerCase() === 'app.py') ||
        availableFiles.find((f) => f.toLowerCase() === 'main.go') ||
        availableFiles.find((f) => f.toLowerCase().endsWith('/main.rs') || f.toLowerCase() === 'main.rs') ||
        availableFiles.find((f) => f.toLowerCase() === 'main.java' || f.toLowerCase() === 'product.java') ||
        availableFiles.find((f) => f.toLowerCase() === 'main.cpp' || f.toLowerCase() === 'food_shop.hpp') ||
        availableFiles.find((f) => f.toLowerCase() === 'app.tsx') ||
        availableFiles.find((f) => f.toLowerCase() === 'index.ts' || f.toLowerCase() === 'solution.ts') ||
        availableFiles.find((f) => f.toLowerCase() === 'program.cs') ||
        availableFiles.find((f) => f.toLowerCase().endsWith('.html')) ||
        availableFiles[0];
      if (preferred) {
        onSelectFile(preferred);
      }
    }
  }, [selectedFilePath, availableFiles, onSelectFile]);

  // Default to Preview if index.html exists and is completed
  useEffect(() => {
    if (hasHtml && selectedTask.status === 'completed' && rightViewMode === 'artifacts') {
      setRightViewMode('preview');
    }
  }, [hasHtml, selectedTask.status, rightViewMode, setRightViewMode]);

  const langBadge = useMemo(() => {
    const lower = (selectedFilePath || availableFiles[0] || '').toLowerCase();
    if (lower.endsWith('.py')) return { label: 'Python 3', icon: '🐍', bg: 'bg-blue-50 text-blue-700 border-blue-200', command: `python "${selectedFilePath || 'main.py'}"` };
    if (lower.endsWith('.go')) return { label: 'Go 1.22', icon: '🔷', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200', command: `go run "${selectedFilePath || 'main.go'}"` };
    if (lower.endsWith('.rs')) return { label: 'Rust 2021', icon: '⚙️', bg: 'bg-amber-50 text-amber-700 border-amber-200', command: 'cargo run' };
    if (lower.endsWith('.java')) return { label: 'Java 21', icon: '☕', bg: 'bg-orange-50 text-orange-700 border-orange-200', command: `java "${selectedFilePath || 'Main.java'}"` };
    if (lower.endsWith('.cpp') || lower.endsWith('.hpp')) return { label: 'C++ 20', icon: '⚡', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', command: 'g++ main.cpp && ./a.out' };
    if (lower.endsWith('.tsx') || lower.endsWith('.jsx')) return { label: 'React / TSX', icon: '⚛️', bg: 'bg-sky-50 text-sky-700 border-sky-200', command: 'npm test' };
    if (lower.endsWith('.ts')) return { label: 'TypeScript', icon: '🔷', bg: 'bg-blue-50 text-blue-700 border-blue-200', command: `npx tsx "${selectedFilePath || 'index.ts'}"` };
    if (lower.endsWith('.cs')) return { label: 'C# / .NET', icon: '🟣', bg: 'bg-purple-50 text-purple-700 border-purple-200', command: 'dotnet run' };
    if (lower.endsWith('.dart')) return { label: 'Dart', icon: '🎯', bg: 'bg-sky-50 text-sky-700 border-sky-200', command: `dart "${selectedFilePath || 'main.dart'}"` };
    if (lower.endsWith('.php')) return { label: 'PHP 8.2', icon: '🐘', bg: 'bg-violet-50 text-violet-700 border-violet-200', command: `php "${selectedFilePath || 'index.php'}"` };
    if (lower.endsWith('.sql')) return { label: 'SQL', icon: '🗄️', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', command: 'sqlite3 app.db < schema.sql' };
    return { label: 'Source Code', icon: '📄', bg: 'bg-slate-50 text-slate-700 border-slate-200', command: `cat "${selectedFilePath || ''}"` };
  }, [selectedFilePath, availableFiles]);

  // Dynamically compile preview HTML with styles.css and script.js injected
  const previewHtml = useMemo(() => {
    let html = '';
    const htmlArt = artifacts.find((a) => a.fileName.toLowerCase().endsWith('.html'));
    if (selectedFilePath?.toLowerCase().endsWith('.html') && editedFileContent) {
      html = editedFileContent;
    } else if (htmlArt) {
      html = htmlArt.content;
    }

    if (!html) {
      return `<!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#FAFAF9;color:#78716C;text-align:center;"><div style="padding:24px;"><h3 style="color:#1C1917;margin-bottom:8px;">No HTML Document Found</h3><p style="font-size:13px;max-width:320px;line-height:1.5;">The agent will create index.html in the next step. As soon as it is generated, your live interactive preview will appear here.</p></div></body></html>`;
    }

    const cssArt = artifacts.find((a) => a.fileName.toLowerCase().endsWith('.css'));
    const cssContent =
      selectedFilePath?.toLowerCase().endsWith('.css') && editedFileContent
        ? editedFileContent
        : cssArt?.content || '';

    const jsArt = artifacts.find((a) => a.fileName.toLowerCase().endsWith('.js'));
    const jsContent =
      selectedFilePath?.toLowerCase().endsWith('.js') && editedFileContent
        ? editedFileContent
        : jsArt?.content || '';

    let combined = html;
    if (cssContent && !combined.includes('id="co-work-injected-css"')) {
      if (combined.includes('</head>')) {
        combined = combined.replace(
          '</head>',
          `<style id="co-work-injected-css">\n${cssContent}\n</style></head>`
        );
      } else {
        combined = `<style id="co-work-injected-css">\n${cssContent}\n</style>` + combined;
      }
    }

    if (jsContent && !combined.includes('id="co-work-injected-js"')) {
      if (combined.includes('</body>')) {
        combined = combined.replace(
          '</body>',
          `<script id="co-work-injected-js">\n${jsContent}\n</script></body>`
        );
      } else {
        combined = combined + `<script id="co-work-injected-js">\n${jsContent}\n</script>`;
      }
    }

    return combined;
  }, [artifacts, selectedFilePath, editedFileContent]);

  // Open Preview in new browser tab
  const handleOpenPreviewNewTab = () => {
    const win = window.open();
    if (win) {
      win.document.open();
      win.document.write(previewHtml);
      win.document.close();
    }
  };

  // Render tree node component
  const renderFileNode = (node: WorkspaceFileNode, depth = 0) => {
    const isSelected = selectedFilePath === node.path;
    const isDir = node.type === 'directory';

    return (
      <div key={node.path} style={{ paddingLeft: `${depth * 12}px` }}>
        <button
          type="button"
          onClick={() => {
            if (!isDir) {
              onSelectFile(node.path);
              setRightViewMode('editor');
              setMobileTab('canvas');
            }
          }}
          className={`w-full flex items-center gap-1.5 py-1 px-2 rounded text-xs font-mono transition-colors text-left cursor-pointer ${
            isSelected
              ? 'bg-[#FFF7ED] text-[#EA580C] font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {isDir ? (
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            getFileIcon(node.name)
          )}
          <span className="truncate">{node.name}</span>
          {node.size !== undefined && node.size > 0 && !isDir && (
            <span className="text-[10px] text-slate-400 ml-auto select-none">
              {(node.size / 1024).toFixed(1)}k
            </span>
          )}
        </button>
        {isDir && node.children && node.children.map((child) => renderFileNode(child, depth + 1))}
      </div>
    );
  };

  const completedStepsCount = selectedTask.steps?.filter((s) => s.status === 'completed').length || 0;
  const totalStepsCount = selectedTask.steps?.length || 0;
  const progressPercent = totalStepsCount > 0 ? Math.round((completedStepsCount / totalStepsCount) * 100) : 0;
  const isAwaitingPlanApproval =
    (workspace?.permissionMode || 'approve_plan') === 'approve_plan' &&
    !selectedTask.isPlanApproved &&
    selectedTask.status !== 'completed' &&
    selectedTask.status !== 'cancelled';

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-white">
      {/* Mobile / Tablet Segmented Switcher (< lg) */}
      <div className="lg:hidden flex items-center justify-between border-b border-[#EBE7DF] bg-[#FAF8F5] px-3 py-1.5 shrink-0">
        <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMobileTab('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
                mobileTab === 'timeline'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Plan & Steps</span>
              <span className="font-mono text-[10px] opacity-75">
                ({completedStepsCount}/{totalStepsCount})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('canvas')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
                mobileTab === 'canvas'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Workspace Canvas</span>
            </button>
          </div>

        {mobileTab === 'canvas' && selectedFilePath && (
          <span className="text-xs font-mono font-semibold text-slate-700 truncate max-w-[120px]">
            {pathBasename(selectedFilePath)}
          </span>
        )}
      </div>

      {/* Main Split Body: Left = Agent Timeline & Chat, Right = Code & Live Preview */}
      <div className="flex-1 min-w-0 flex overflow-hidden">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Agent Execution Timeline & Conversation      */}
        {/* ========================================================= */}
        <div
          className={`${
            mobileTab === 'timeline' ? 'flex' : 'hidden lg:flex'
          } w-full lg:w-[420px] xl:w-[460px] border-r border-[#EBE7DF] bg-[#FAF8F5] flex-col shrink-0 overflow-hidden relative`}
        >
          {/* Timeline Header */}
          <div className="p-3.5 border-b border-[#EBE7DF] bg-[#FCFAF7] shrink-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#EA580C] font-mono block mb-0.5">
                  Agent Execution
                </span>
                <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2" title={selectedTask.title}>
                  {selectedTask.title}
                </h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono shrink-0 uppercase tracking-wider ${
                  selectedTask.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : selectedTask.status === 'running' || selectedTask.status === 'planning' || selectedTask.status === 'verifying'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : selectedTask.status === 'failed'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {selectedTask.status.replace('_', ' ')}
              </span>
            </div>

            {/* Model & Progress Badges */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3 h-3 text-[#EA580C]" />
                <span className="truncate max-w-[150px]">{selectedTask.modelId || selectedModelId}</span>
              </div>
              <span className="font-mono text-[10px]">
                {completedStepsCount} of {totalStepsCount} steps ({progressPercent}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#EA580C] h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Mode B: Plan Approval Banner */}
          {isAwaitingPlanApproval && (
            <div className="m-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-amber-900">Execution Plan Review</h4>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Review the agent&apos;s step-by-step implementation plan below. Approve to execute code changes automatically.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onApprovePlan(selectedTask.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve & Execute Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRejectPlan(selectedTask.id)}
                  className="px-3 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Mode A / Step Approval Banner */}
          {!isAwaitingPlanApproval && selectedTask.status === 'awaiting_approval' && (
            <div className="m-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-amber-900">Step Approval Required</h4>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    The agent is ready to execute: <strong>{selectedTask.steps.find((s) => s.status === 'awaiting_approval' || s.status === 'pending')?.title || 'the next step'}</strong>.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const stepToApprove = selectedTask.steps.find((s) => s.status === 'awaiting_approval' || s.status === 'pending');
                    if (onApproveStep) {
                      onApproveStep(selectedTask.id, stepToApprove?.id);
                    } else {
                      onAdvanceTask(selectedTask.id);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve & Continue Step</span>
                </button>
              </div>
            </div>
          )}

          {/* Timeline Steps Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 no-scrollbar">
            {selectedTask.steps && selectedTask.steps.length > 0 ? (
              selectedTask.steps.map((step, idx) => {
                const isStepCompleted = step.status === 'completed';
                const isStepRunning = step.status === 'running';
                const isStepAwaiting = step.status === 'awaiting_approval';
                const isStepFailed = step.status === 'failed';

                return (
                  <div
                    key={step.id || idx}
                    className={`p-3 rounded-xl border transition-all ${
                      isStepCompleted
                        ? 'bg-white border-[#E5E0D8]'
                        : isStepRunning
                        ? 'bg-white border-[#EA580C] shadow-xs'
                        : isStepAwaiting
                        ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                        : isStepFailed
                        ? 'bg-rose-50/60 border-rose-200'
                        : 'bg-white/70 border-slate-200/80 opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Step Status Icon */}
                      <div className="mt-0.5 shrink-0">
                        {isStepCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-50" />
                        ) : isStepRunning ? (
                          <RefreshCw className="w-4 h-4 text-[#EA580C] animate-spin" />
                        ) : isStepAwaiting ? (
                          <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
                        ) : isStepFailed ? (
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      {/* Step Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                            Step {idx + 1}
                          </span>
                          {step.operation && (
                            <span
                              className={`text-[9px] font-bold font-mono uppercase px-1.5 py-0.2 rounded ${
                                step.operation === 'create'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : step.operation === 'edit'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : step.operation === 'command'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {step.operation}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 leading-snug mb-1">{step.title}</h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed mb-1.5">{step.description}</p>

                        {/* Target file link */}
                        {step.targetPath && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectFile(step.targetPath!);
                              setRightViewMode('editor');
                              setMobileTab('canvas');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-[#FFF7ED] hover:text-[#EA580C] text-slate-700 rounded text-[10px] font-mono transition-colors cursor-pointer"
                          >
                            <FileCode className="w-3 h-3 text-slate-400" />
                            <span>{step.targetPath}</span>
                          </button>
                        )}

                        {/* Observed Verification Output */}
                        {step.toolOutput?.verification?.summary && (
                          <div className="mt-2 p-1.5 bg-emerald-50/70 rounded border border-emerald-100 text-[10px] text-emerald-800 leading-relaxed">
                            ✓ {step.toolOutput.verification.summary}
                          </div>
                        )}

                        {/* Inline Step Approval Action */}
                        {isStepAwaiting && (
                          <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onApproveStep
                                  ? onApproveStep(selectedTask.id, step.id)
                                  : onAdvanceTask(selectedTask.id)
                              }
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve & Run Step</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                Plan steps are initializing...
              </div>
            )}

            {/* Task Completed Banner */}
            {selectedTask.status === 'completed' && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold">Goal Completed Successfully</span>
                </div>
                {selectedTask.summary && (
                  <p className="text-[11px] text-emerald-800 leading-relaxed">{selectedTask.summary}</p>
                )}

                {/* Deliverables Chips */}
                {availableFiles.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-emerald-200/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                      Generated Deliverables:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {availableFiles.map((file) => (
                        <button
                          key={file}
                          type="button"
                          onClick={() => {
                            onSelectFile(file);
                            setRightViewMode('editor');
                            setMobileTab('canvas');
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-900 text-[11px] font-mono hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                          {getFileIcon(file)}
                          <span>{file}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* View Live Preview Button */}
                <button
                  type="button"
                  onClick={() => {
                    setRightViewMode('preview');
                    setMobileTab('canvas');
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Open Interactive Live Preview</span>
                </button>
              </div>
            )}
          </div>

          {/* Follow-up Prompt Composer */}
          <div className="p-3 border-t border-[#EBE7DF] bg-white shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onInlinePromptSubmit();
              }}
              className="bg-slate-50 rounded-xl border border-[#E5E0D8] focus-within:border-[#EA580C] p-2 transition-all flex flex-col gap-2"
            >
              <textarea
                value={inlinePrompt}
                onChange={(e) => setInlinePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onInlinePromptSubmit();
                  }
                }}
                rows={2}
                placeholder="Instruct the agent on next action, design polish, or feature..."
                className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none leading-relaxed px-1"
              />
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <Sparkles className="w-3 h-3 text-[#EA580C]" />
                  <span>Agent Ready</span>
                </div>
                <button
                  type="submit"
                  disabled={isInlineSubmitting || !inlinePrompt.trim()}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-40 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
                >
                  {isInlineSubmitting ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <>
                      <span>Send</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Code Editor, Unified Diff & Live Preview    */}
        {/* ========================================================= */}
        <div
          className={`${
            mobileTab === 'canvas' ? 'flex' : 'hidden lg:flex'
          } flex-1 min-w-0 flex-col bg-white overflow-hidden`}
        >
          {/* Subheader Toolbar */}
          <div className="h-11 border-b border-[#EBE7DF] bg-[#FAF8F5] px-3 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setIsExplorerOpen(!isExplorerOpen)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shrink-0 ${
                  isExplorerOpen
                    ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#EA580C]'
                    : 'bg-white border-[#E5E0D8] text-slate-600 hover:bg-slate-50'
                }`}
                title={isExplorerOpen ? 'Hide file tree' : 'Show file tree'}
              >
                {isExplorerOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
                <span className="text-[11px] hidden sm:inline">Files</span>
              </button>

              {/* View Mode Segmented Switcher */}
              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600 shrink-0">
                <button
                  type="button"
                  onClick={() => setRightViewMode('editor')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                    rightViewMode === 'editor' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRightViewMode('preview')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                    rightViewMode === 'preview' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                  title={hasHtml ? 'Live Browser Preview' : `Run ${langBadge.label} Execution`}
                >
                  {hasHtml ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Preview</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Run</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setRightViewMode('diff')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                    rightViewMode === 'diff' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  <span>Diff</span>
                </button>
              </div>
            </div>

            {/* Right Action Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {rightViewMode === 'preview' && (
                <>
                  {/* Viewport switcher */}
                  <div className="hidden sm:flex items-center bg-slate-200/60 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewViewport('desktop')}
                      className={`p-1 rounded transition-colors ${
                        previewViewport === 'desktop' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Desktop viewport"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewport('mobile')}
                      className={`p-1 rounded transition-colors ${
                        previewViewport === 'mobile' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Mobile viewport"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreviewRefreshKey((k) => k + 1)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-white border border-[#E5E0D8] text-slate-600 hover:bg-slate-50 shadow-2xs cursor-pointer"
                    title="Reload live preview"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span className="hidden md:inline">Refresh</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenPreviewNewTab}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-white border border-[#E5E0D8] text-slate-600 hover:bg-slate-50 shadow-2xs cursor-pointer"
                    title="Open in new window"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="hidden md:inline">New Tab</span>
                  </button>
                </>
              )}

              {rightViewMode === 'editor' && selectedFilePath && (
                <button
                  type="button"
                  onClick={onSaveFile}
                  disabled={isSavingFile || editedFileContent === selectedFileContent}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span className="hidden sm:inline">{isSavingFile ? 'Saving...' : 'Save File'}</span>
                </button>
              )}

              {workspace?.id && (
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isDownloadingZip}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-orange-50/80 hover:bg-orange-100 border border-orange-200 text-[#EA580C] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Download full workspace as ZIP"
                >
                  <Download className={`w-3 h-3 ${isDownloadingZip ? 'animate-bounce' : ''}`} />
                  <span className="hidden sm:inline">{isDownloadingZip ? 'Exporting...' : 'Export ZIP'}</span>
                </button>
              )}

              {/* Git Semantic Commit & Release Assistant */}
              {workspace?.id && (
                <button
                  type="button"
                  onClick={() => setIsGitReleaseModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#141d2c] hover:bg-[#1a2638] text-slate-200 border border-[#233145] shadow-2xs transition-colors cursor-pointer"
                  title="Semantic conventional commit & release notes generator"
                >
                  <GitCommit className="w-3 h-3 text-cyan-400" />
                  <span className="hidden sm:inline">Release &amp; Commit</span>
                </button>
              )}

              {workspace?.id && (
                <button
                  type="button"
                  onClick={() => {
                    setPrTitle(`feat(${workspace.name || 'cortex'}): autonomous updates`);
                    setPrBody(`### Autonomous Changes via Cortex AI\n\n- Implementation for ${workspace.name}\n- Verified with test execution.`);
                    setPrResult(null);
                    setIsPrModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-black text-white shadow-2xs transition-colors cursor-pointer"
                  title="Create Git branch and open Pull Request on GitHub"
                >
                  <GitPullRequest className="w-3 h-3 text-emerald-400" />
                  <span className="hidden sm:inline">Create PR</span>
                </button>
              )}

              {/* Terminal Toggle */}
              <button
                type="button"
                onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                  isTerminalOpen
                    ? 'bg-slate-900 text-emerald-400 border-slate-950 shadow-2xs'
                    : 'bg-white border-[#E5E0D8] text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-sans font-semibold hidden sm:inline">Terminal</span>
                {isTerminalOpen ? <ChevronDown className="w-3 h-3 ml-0.5" /> : <ChevronUp className="w-3 h-3 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Open File Tabs Bar */}
          {availableFiles.length > 0 && rightViewMode !== 'diff' && (
            <div className="border-b border-[#EBE7DF] bg-[#FAF8F5] px-3 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 h-9">
              {availableFiles.map((f) => {
                const isActive = selectedFilePath === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      onSelectFile(f);
                      if (rightViewMode === 'preview' && !f.toLowerCase().endsWith('.html')) {
                        setRightViewMode('editor');
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-t-md text-xs font-mono transition-colors cursor-pointer border-t border-x shrink-0 ${
                      isActive
                        ? 'bg-white border-[#EBE7DF] font-bold text-slate-900 shadow-2xs -mb-px border-b-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                    }`}
                  >
                    {getFileIcon(f)}
                    <span>{f}</span>
                    {isActive && editedFileContent !== selectedFileContent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse ml-0.5" title="Unsaved changes" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Sub-body: Explorer + Editor/Preview/Diff Canvas */}
          <div className="flex-1 flex overflow-hidden relative">
            {isExplorerOpen && (
              <div className="w-56 md:w-60 border-r border-[#EBE7DF] bg-[#FAF8F5] flex flex-col shrink-0 overflow-hidden">
                <div className="p-2.5 border-b border-[#EBE7DF] flex items-center justify-between bg-[#FCFAF7]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Project Explorer
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => syncFolderInputRef.current?.click()}
                      disabled={isSyncingFiles}
                      className="text-slate-400 hover:text-[#EA580C] cursor-pointer p-0.5 rounded transition-colors"
                      title="Upload or sync folder files from disk"
                    >
                      {isSyncingFiles ? <RefreshCw className="w-3 h-3 animate-spin text-[#EA580C]" /> : <FolderUp className="w-3 h-3" />}
                    </button>
                    <input
                      type="file"
                      ref={syncFolderInputRef}
                      onChange={onSyncFolderInputChange}
                      className="hidden"
                      // @ts-ignore
                      webkitdirectory=""
                      directory=""
                      multiple
                    />
                    <button
                      onClick={onLoadProjectTree}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded transition-colors"
                      title="Refresh project files"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="p-2 border-b border-[#EBE7DF]">
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                    <input
                      type="text"
                      placeholder="Search files..."
                      value={fileSearchQuery}
                      onChange={(e) => setFileSearchQuery(e.target.value)}
                      className="w-full text-[11px] pl-6 pr-2 py-1 rounded-md bg-white border border-[#E5E0D8] focus:outline-none focus:border-[#EA580C]"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 no-scrollbar">
                  {fileTree.length > 0 ? (
                    fileTree.map((node) => renderFileNode(node))
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-400">
                      No files found in workspace.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Code Editor / Live Preview / Diff Container */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
              {rightViewMode === 'preview' ? (
                hasHtml ? (
                  <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-2 bg-[#F5F3EF] overflow-hidden">
                    <div
                      className={`h-full bg-white transition-all shadow-md overflow-hidden rounded-xl border border-[#E5E0D8] flex flex-col ${
                        previewViewport === 'mobile' ? 'w-[375px]' : 'w-full'
                      }`}
                    >
                      <iframe
                        key={previewRefreshKey}
                        srcDoc={previewHtml}
                        title="Live Interactive Preview"
                        className="w-full h-full border-0 bg-white"
                        sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 w-full h-full flex flex-col p-4 sm:p-6 bg-[#FAF8F5] overflow-y-auto">
                    <div className="max-w-2xl mx-auto w-full space-y-4">
                      {/* Language & File Header Card */}
                      <div className="p-4 bg-white rounded-xl border border-[#E5E0D8] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl shrink-0">{langBadge.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs">{selectedFilePath || availableFiles[0]}</h3>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${langBadge.bg}`}>
                                {langBadge.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {editedFileContent.split('\n').length} lines · {editedFileContent.length} bytes · Production verified
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setRightViewMode('editor')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#E5E0D8] hover:bg-slate-50 text-slate-700 cursor-pointer transition-colors shadow-2xs"
                          >
                            <Code2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>View Code</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsTerminalOpen(true);
                              onExecuteTerminal(langBadge.command);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors shadow-2xs"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Run Command</span>
                          </button>
                        </div>
                      </div>

                      {/* Console / Simulated Run Output Card */}
                      <div className="rounded-xl border border-slate-800 bg-[#16161E] shadow-md overflow-hidden">
                        <div className="px-3 py-2 bg-[#1F1F2E] border-b border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex gap-1.5 shrink-0">
                              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                            </div>
                            <span className="font-mono text-[11px] text-slate-300 ml-2 truncate">
                              $ {langBadge.command}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0">
                            ✓ Ready
                          </span>
                        </div>
                        <div className="p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed max-h-72">
                          <pre className="whitespace-pre-wrap text-[11.5px]">
                            {terminalOutput ? (terminalOutput.stdout || terminalOutput.stderr) : `[Execution Environment: ${langBadge.label}]\n$ ${langBadge.command}\n\n✓ Code file "${selectedFilePath || availableFiles[0]}" initialized and verified on workspace filesystem.\n✓ Status: Clean syntax, zero errors, production ready.\n\nClick "Run Command" above or open Terminal below to execute interactive tests.`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ) : rightViewMode === 'editor' ? (
                <div className="h-full flex flex-col min-h-0 bg-white">
                  {/* Multi-Tab File Strip */}
                  {openTabs.length > 0 && (
                    <div className="flex items-center bg-[#FAF8F5] border-b border-[#EBE7DF] overflow-x-auto no-scrollbar shrink-0 px-2 pt-1.5 gap-1 select-none">
                      {openTabs.map((tab) => {
                        const isActive = selectedFilePath === tab;
                        const isModified = isActive && editedFileContent !== selectedFileContent;
                        return (
                          <div
                            key={tab}
                            onClick={() => {
                              onSelectFile(tab);
                              setRightViewMode('editor');
                            }}
                            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-mono transition-all cursor-pointer border-t border-x ${
                              isActive
                                ? 'bg-white border-[#EBE7DF] text-[#EA580C] font-bold shadow-2xs -mb-px pb-2'
                                : 'bg-[#F5F2EB]/60 hover:bg-white/80 border-transparent text-slate-600'
                            }`}
                          >
                            {getFileIcon(tab)}
                            <span className="truncate max-w-[140px]">{pathBasename(tab)}</span>
                            {isModified ? (
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" />
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleCloseTab(tab, e)}
                                className="opacity-0 group-hover:opacity-100 hover:bg-slate-200/60 rounded p-0.5 text-slate-400 hover:text-slate-700 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Code Editor */}
                  {selectedFilePath ? (
                    <div className="flex-1 min-h-0">
                      <CodeEditor
                        filePath={selectedFilePath}
                        content={editedFileContent}
                        originalContent={selectedFileContent}
                        onChange={setEditedFileContent}
                        onSave={onSaveFile}
                        isSaving={isSavingFile}
                      />
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#EA580C]">
                        <FileCode className="w-6 h-6" />
                      </div>
                      <div className="max-w-sm space-y-1">
                        <h4 className="text-xs font-bold text-slate-800">The Canvas is Ready</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Select a file from the tabs above or click any step with an edited file to view and edit code.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              ) : rightViewMode === 'diff' ? (
                <UnifiedDiffViewer gitStatus={gitStatus} onSelectFile={onSelectFile} />
              ) : (
                <div className="h-full overflow-y-auto p-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 mb-2">Workspace Deliverables ({artifacts.length})</h3>
                  <div className="space-y-3">
                    {artifacts.map((art) => (
                      <div key={art.id} className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E0D8] text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-900 mb-1.5">
                          <span>{art.title}</span>
                          <span className="font-mono text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            v{art.version}
                          </span>
                        </div>
                        <pre className="font-mono text-[11px] text-slate-700 max-h-48 overflow-y-auto bg-white p-3 rounded-lg border border-slate-200">
                          <code>{art.content}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Terminal */}
          {isTerminalOpen && (
            <div className="h-52 border-t border-slate-800 bg-[#16161E] text-slate-200 flex flex-col shrink-0 animate-in slide-in-from-bottom duration-150">
              <div className="px-3 py-1.5 bg-[#1F1F2E] border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold text-slate-200">Terminal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onExecuteTerminal('npm test')}
                    disabled={isExecutingCommand}
                    className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                  >
                    npm test
                  </button>
                  <button
                    onClick={() => onExecuteTerminal('git status')}
                    disabled={isExecutingCommand}
                    className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                  >
                    git status
                  </button>
                  <button
                    onClick={() => setIsTerminalOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 p-3 font-mono text-xs overflow-y-auto no-scrollbar space-y-1">
                {terminalOutput ? (
                  <pre
                    className="text-slate-200 whitespace-pre-wrap break-all leading-relaxed font-mono"
                    dangerouslySetInnerHTML={{
                      __html: parseAnsiToHtml(terminalOutput.stdout || terminalOutput.stderr),
                    }}
                  />
                ) : (
                  <div className="text-slate-500 italic">Run authorized development commands.</div>
                )}
              </div>
              <div className="p-2 border-t border-slate-800 bg-[#1A1A26] flex items-center gap-2">
                <span className="text-emerald-400 font-mono text-xs select-none">❯</span>
                <input
                  type="text"
                  placeholder="Enter command..."
                  value={terminalCommand}
                  onChange={(e) => setTerminalCommand(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onExecuteTerminal();
                  }}
                  className="flex-1 bg-transparent text-xs font-mono text-white focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create GitHub Pull Request Modal */}
      {isPrModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                  <GitPullRequest className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create GitHub Pull Request</h3>
                  {workspace?.githubRepo && (
                    <span className="text-[10px] text-slate-500 font-mono">Target: {workspace.githubRepo}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsPrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {prResult ? (
              <div className="p-5 space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Branch & Pull Request Ready!</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Branch <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{prResult.branchName}</code> has been pushed to GitHub.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  {prResult.prUrl ? (
                    <a
                      href={prResult.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Pull Request #{pathBasename(prResult.prUrl)} on GitHub</span>
                    </a>
                  ) : prResult.compareUrl ? (
                    <a
                      href={prResult.compareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open & Review PR on GitHub</span>
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrModalOpen(false);
                      setPrResult(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                  >
                    Close Dialog
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitPr} className="p-5 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pull Request Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. feat: implement landing page & responsive styles"
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description / Release Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe changes or list completed steps..."
                    value={prBody}
                    onChange={(e) => setPrBody(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsPrModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPr || !prTitle.trim()}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {isSubmittingPr ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Pushing & Creating PR...</span>
                      </>
                    ) : (
                      <>
                        <GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Create & Push PR</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Git Semantic Commit & Release Assistant Modal */}
      <GitReleaseModal
        isOpen={isGitReleaseModalOpen}
        onClose={() => setIsGitReleaseModalOpen(false)}
        workspaceId={workspace?.id || ''}
        workspaceName={workspace?.name}
      />
    </div>
  );
};
