import React, { useState } from 'react';
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
} from 'lucide-react';
import { CoworkCanvasProps } from './types';
import { UnifiedDiffViewer } from './UnifiedDiffViewer';
import { WorkspaceFileNode } from '../../server/types';

function pathBasename(p: string): string {
  const parts = p.split(/[\/\\]/);
  return parts[parts.length - 1] || p;
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
            <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
  const isAwaitingPlanApproval =
    (workspace?.permissionMode || 'approve_plan') === 'approve_plan' &&
    !selectedTask.isPlanApproved &&
    selectedTask.status !== 'completed' &&
    selectedTask.status !== 'cancelled';

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-white">
      {/* Mobile / Tablet Segmented Switcher (< lg) */}
      <div className="lg:hidden flex items-center justify-between border-b border-[#EBE7DF] bg-[#FAF8F5] px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-1">
          {onToggleTasks && (
            <button
              type="button"
              onClick={onToggleTasks}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 text-xs font-semibold mr-1"
            >
              Tasks
            </button>
          )}
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
              <span>Code & Diff</span>
            </button>
          </div>
        </div>

        {mobileTab === 'canvas' && selectedFilePath && (
          <span className="text-xs font-mono font-semibold text-slate-700 truncate max-w-[120px]">
            {pathBasename(selectedFilePath)}
          </span>
        )}
      </div>

      {/* Main Split Body: Left = Agent Timeline, Right = Code & Diff */}
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
                  Task Execution
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
                {completedStepsCount} of {totalStepsCount} steps
              </span>
            </div>
          </div>

          {/* Mode B: Plan Approval Banner */}
          {isAwaitingPlanApproval && (
            <div className="m-3 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5 shadow-2xs">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-amber-900">Execution Plan Review</h4>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Mode B is active. Review the agent&apos;s step-by-step plan below. Approve to begin executing code changes.
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
                  <span>Approve Plan</span>
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

          {/* Timeline Steps Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 no-scrollbar">
            {selectedTask.steps && selectedTask.steps.length > 0 ? (
              selectedTask.steps.map((step, idx) => {
                const isStepCompleted = step.status === 'completed';
                const isStepRunning = step.status === 'running';
                const isStepFailed = step.status === 'failed';

                return (
                  <div
                    key={step.id || idx}
                    className={`p-3 rounded-xl border transition-all ${
                      isStepCompleted
                        ? 'bg-white border-[#E5E0D8]'
                        : isStepRunning
                        ? 'bg-white border-[#EA580C] shadow-xs'
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
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono uppercase tracking-wider ${
                                step.operation === 'create'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : step.operation === 'edit'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : step.operation === 'delete'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {step.operation}
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-slate-800 leading-snug">{step.title}</h4>
                        {step.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{step.description}</p>
                        )}

                        {/* Clickable Target File / Code Artifact */}
                        {step.targetPath && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectFile(step.targetPath!);
                              setMobileTab('canvas');
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 hover:bg-[#FFF7ED] border border-slate-200 hover:border-[#FED7AA] text-[10px] font-mono text-slate-700 hover:text-[#EA580C] transition-colors cursor-pointer group"
                            title="Open in Code Editor"
                          >
                            <FileCode className="w-3 h-3 text-slate-400 group-hover:text-[#EA580C]" />
                            <span className="truncate max-w-[200px]">{step.targetPath}</span>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-400 group-hover:text-[#EA580C] ml-0.5" />
                          </button>
                        )}

                        {/* Observed Verification Output if present */}
                        {step.toolOutput && (
                          <div className="mt-2 p-1.5 bg-slate-50 rounded border border-slate-100 text-[10px] font-mono text-slate-600 line-clamp-2">
                            {typeof step.toolOutput === 'string'
                              ? step.toolOutput
                              : JSON.stringify(step.toolOutput)}
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
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold">Goal Completed Successfully</span>
                </div>
                {selectedTask.summary && (
                  <p className="text-[11px] text-emerald-800 leading-relaxed">{selectedTask.summary}</p>
                )}
              </div>
            )}
          </div>

          {/* Step Advance Button (when active) */}
          {selectedTask.status !== 'completed' && selectedTask.status !== 'cancelled' && (
            <div className="px-3 pt-2 pb-1 shrink-0">
              <button
                type="button"
                onClick={() => onAdvanceTask(selectedTask.id)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current text-emerald-400" />
                <span>Execute Next Step</span>
              </button>
            </div>
          )}

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
                placeholder="Instruct the agent on next action or test..."
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
        {/* RIGHT COLUMN: Code Editor, Unified Diff & Terminal        */}
        {/* ========================================================= */}
        <div
          className={`${
            mobileTab === 'canvas' ? 'flex' : 'hidden lg:flex'
          } flex-1 min-w-0 flex-col bg-white overflow-hidden`}
        >
          {/* Subheader Toolbar */}
          <div className="h-11 border-b border-[#EBE7DF] bg-[#FAF8F5] px-3 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-2 min-w-0">
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

              {selectedFilePath && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E5E0D8] text-xs font-mono text-slate-800 shadow-2xs shrink-0">
                  <FileCode className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span className="font-bold truncate max-w-[130px] sm:max-w-[200px]">{pathBasename(selectedFilePath)}</span>
                  {editedFileContent !== selectedFileContent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Unsaved changes" />
                  )}
                </div>
              )}

              {/* View Mode Pills */}
              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600 shrink-0">
                <button
                  type="button"
                  onClick={() => setRightViewMode('editor')}
                  className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                    rightViewMode === 'editor' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Editor
                </button>
                <button
                  type="button"
                  onClick={() => setRightViewMode('diff')}
                  className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                    rightViewMode === 'diff' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Unified Diff
                </button>
                <button
                  type="button"
                  onClick={() => setRightViewMode('artifacts')}
                  className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                    rightViewMode === 'artifacts' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Artifacts ({artifacts.length})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {rightViewMode === 'editor' && selectedFilePath && (
                <button
                  onClick={onSaveFile}
                  disabled={isSavingFile || editedFileContent === selectedFileContent}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span className="hidden sm:inline">{isSavingFile ? 'Saving...' : 'Save File'}</span>
                </button>
              )}

              {/* Terminal Toggle */}
              <button
                type="button"
                onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                  isTerminalOpen
                    ? 'bg-slate-900 text-emerald-400 border-slate-950 shadow-2xs'
                    : 'bg-white border-[#E5E0D8] text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-sans font-semibold hidden sm:inline">Terminal</span>
                {terminalOutput && (
                  <span
                    className={`ml-1 px-1 rounded text-[9px] font-bold ${
                      terminalOutput.exitCode === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {terminalOutput.exitCode}
                  </span>
                )}
                {isTerminalOpen ? <ChevronDown className="w-3 h-3 ml-0.5" /> : <ChevronUp className="w-3 h-3 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Sub-body: Explorer + Editor/Diff Canvas */}
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

            {/* Main Code Editor / Diff / Artifacts Container */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              {rightViewMode === 'editor' ? (
                selectedFilePath ? (
                  <div className="h-full flex flex-col">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono bg-slate-50/50 shrink-0">
                      <span className="font-semibold text-slate-700">{selectedFilePath}</span>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span>{editedFileContent.split('\n').length} lines</span>
                        <span>{editedFileContent.length} chars</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(editedFileContent)}
                          className="flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                          title="Copy file content"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={editedFileContent}
                      onChange={(e) => setEditedFileContent(e.target.value)}
                      className="flex-1 w-full p-4 font-mono text-[12.5px] leading-relaxed text-slate-800 bg-white focus:outline-none resize-none no-scrollbar select-text"
                      spellCheck={false}
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
                        Click any step with an edited file from the Execution Timeline or open Project Explorer to view and edit code.
                      </p>
                    </div>
                  </div>
                )
              ) : rightViewMode === 'diff' ? (
                <UnifiedDiffViewer gitStatus={gitStatus} onSelectFile={onSelectFile} />
              ) : (
                <div className="h-full overflow-y-auto p-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 mb-2">Workspace Artifacts ({artifacts.length})</h3>
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
                  <pre className="text-slate-200 whitespace-pre-wrap break-all leading-relaxed">
                    {terminalOutput.stdout || terminalOutput.stderr}
                  </pre>
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
    </div>
  );
};
