import React, { useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Play,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Clock,
  Download,
  Terminal,
  Copy,
  Check,
  Users,
  Sparkles,
} from 'lucide-react';
import { CoworkSidecarProps } from './types';
import { downloadWorkspaceZip } from '../../lib/api';
import { parseAnsiToHtml } from './ansi';

export const CoworkSidecar: React.FC<CoworkSidecarProps> = ({
  workspace,
  selectedTask,
  artifacts,
  projectStack,
  gitStatus,
  contextPreference,
  contextBudget,
  isSidecarOpen,
  onCloseSidecar,
  onAdvanceTask,
  onApprovePlan,
  onRejectPlan,
  onSelectFile,
  onChangeContextPreference,
  onUpdatePermissionMode,
  terminalOutput,
  isExecutingCommand,
  onExecuteTerminal,
  onRunSwarm,
}) => {
  const [isSwarmOpen, setIsSwarmOpen] = useState(true);
  const [isSwarmRunning, setIsSwarmRunning] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(true);
  const [isArtifactsOpen, setIsArtifactsOpen] = useState(true);
  const [isContextOpen, setIsContextOpen] = useState(true);
  const [isTerminalCardOpen, setIsTerminalCardOpen] = useState(true);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleExportZip = async () => {
    if (!workspace?.id || isExportingZip) return;
    setIsExportingZip(true);
    try {
      await downloadWorkspaceZip(workspace.id, workspace.name);
    } catch (err: any) {
      console.error('Failed to export workspace zip:', err);
      alert('Failed to export workspace ZIP: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <>
      {isSidecarOpen && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-2xs z-30 2xl:hidden"
          onClick={onCloseSidecar}
        />
      )}
      <div
        className={`${
          isSidecarOpen
            ? 'fixed inset-y-0 right-0 z-40 2xl:static flex'
            : 'hidden 2xl:flex'
        } w-72 xl:w-80 border-l border-[#EBE7DF] bg-[#FAF8F5] flex-col shrink-0 overflow-y-auto p-3 space-y-3 no-scrollbar shadow-xl 2xl:shadow-none animate-in slide-in-from-right duration-200`}
      >
        <div className="flex items-center justify-between pb-1 2xl:hidden border-b border-slate-100">
          <span className="text-xs font-bold text-slate-700">Sidecar & Progress</span>
          <button
            type="button"
            onClick={onCloseSidecar}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
            title="Close sidecar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card: Agent Swarm Team */}
        <div className="bg-white rounded-xl border border-[#EBE7DF] shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsSwarmOpen(!isSwarmOpen)}
            className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#EA580C]">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-800">Swarm Team</h4>
                  <span className="text-[9px] bg-orange-100 text-[#EA580C] font-extrabold px-1.5 py-0.2 rounded-full">
                    3 AI Agents
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">Architect · Developer · QA Reviewer</p>
              </div>
            </div>
            {isSwarmOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {isSwarmOpen && (
            <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center">
                  <span className="text-sm block">🏛️</span>
                  <div className="text-[10px] font-bold text-slate-800 truncate">Dr. Aris</div>
                  <div className="text-[8px] text-slate-400 font-mono">Architect</div>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center">
                  <span className="text-sm block">💻</span>
                  <div className="text-[10px] font-bold text-slate-800 truncate">Devon</div>
                  <div className="text-[8px] text-slate-400 font-mono">Senior Dev</div>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-center">
                  <span className="text-sm block">🛡️</span>
                  <div className="text-[10px] font-bold text-slate-800 truncate">Serena</div>
                  <div className="text-[8px] text-slate-400 font-mono">QA Auditor</div>
                </div>
              </div>

              {selectedTask?.swarmEvents && selectedTask.swarmEvents.length > 0 ? (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  {selectedTask.swarmEvents.map((ev) => (
                    <div key={ev.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs">{ev.avatarIcon || '🤖'}</span>
                          <span className="text-[10px] font-bold text-slate-800 truncate">{ev.agentName}</span>
                        </div>
                        <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                          Done
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 leading-relaxed font-sans">{ev.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-1">
                  {selectedTask && selectedTask.status !== 'completed' && onRunSwarm && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedTask || isSwarmRunning) return;
                        setIsSwarmRunning(true);
                        try {
                          await onRunSwarm(selectedTask.id);
                        } finally {
                          setIsSwarmRunning(false);
                        }
                      }}
                      disabled={isSwarmRunning}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      {isSwarmRunning ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Swarm Executing...</span>
                        </>
                      ) : (
                        <>
                          <Users className="w-3.5 h-3.5 text-orange-400" />
                          <span>Deploy Swarm Team (3 Agents)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card 1: Progress */}
        <div className="bg-white rounded-xl border border-[#EBE7DF] shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsProgressOpen(!isProgressOpen)}
            className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div>
              <h4 className="text-xs font-bold text-slate-800">Progress</h4>
              <p className="text-[10px] text-slate-500">Steps will show as the task unfolds.</p>
            </div>
            {isProgressOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {isProgressOpen && (
            <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-slate-100">
              {selectedTask ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">
                      {selectedTask.title}
                    </span>
                    {selectedTask.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => onAdvanceTask(selectedTask.id)}
                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Advance</span>
                      </button>
                    )}
                  </div>

                  {/* Mode B: Plan Approval Callout */}
                  {(workspace?.permissionMode || 'approve_plan') === 'approve_plan' &&
                    !selectedTask.isPlanApproved &&
                    selectedTask.status !== 'completed' &&
                    selectedTask.status !== 'cancelled' && (
                      <div className="p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs space-y-2">
                        <div className="flex items-center gap-1 font-bold text-amber-950 text-[11px]">
                          <ShieldAlert className="w-3.5 h-3.5 text-[#D97706]" />
                          <span>Plan Review Required</span>
                        </div>
                        {selectedTask.plannedFiles && selectedTask.plannedFiles.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {selectedTask.plannedFiles.map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => onSelectFile(f)}
                                className="px-1.5 py-0.5 bg-white text-amber-900 border border-amber-300 rounded text-[9px] font-mono font-semibold"
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => onApprovePlan(selectedTask.id)}
                            className="px-2.5 py-1 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded text-[10px]"
                          >
                            Approve Plan
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectPlan(selectedTask.id)}
                            className="px-2.5 py-1 text-amber-900 hover:bg-amber-100 rounded text-[10px]"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Steps list */}
                  <div className="space-y-2">
                    {selectedTask.steps.map((step, idx) => (
                      <div key={step.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-800 truncate">
                            {idx + 1}. {step.title}
                          </span>
                          {step.status === 'completed' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : step.status === 'running' ? (
                            <RefreshCw className="w-3 h-3 text-[#EA580C] animate-spin shrink-0" />
                          ) : (
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                        </div>
                        {step.targetPath && (
                          <button
                            type="button"
                            onClick={() => onSelectFile(step.targetPath!)}
                            className="text-[9px] font-mono text-[#EA580C] bg-orange-50/60 px-1 py-0.2 rounded hover:underline block truncate"
                          >
                            {step.targetPath}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-slate-400 italic py-2">
                  No active steps. Start a task to unfold progress.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card 2: Artifacts */}
        <div className="bg-white rounded-xl border border-[#EBE7DF] shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsArtifactsOpen(!isArtifactsOpen)}
            className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div>
              <h4 className="text-xs font-bold text-slate-800">Artifacts</h4>
              <p className="text-[10px] text-slate-500">Outputs created during the task land here.</p>
            </div>
            {isArtifactsOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {isArtifactsOpen && (
            <div className="px-3.5 pb-3.5 pt-1 space-y-1.5 border-t border-slate-100">
              {artifacts.map((art) => (
                <div key={art.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] flex items-center justify-between">
                  <span className="font-semibold text-slate-800 truncate">{art.title}</span>
                  <span className="font-mono text-[9px] text-slate-400">v{art.version}</span>
                </div>
              ))}
              {artifacts.length === 0 && (
                <div className="text-[11px] text-slate-400 italic py-2">
                  No outputs created yet.
                </div>
              )}
              {workspace?.id && (
                <button
                  type="button"
                  onClick={handleExportZip}
                  disabled={isExportingZip}
                  className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-orange-50/70 hover:bg-orange-100/80 border border-orange-200 text-[#EA580C] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Download all workspace files and deliverables as a ZIP archive"
                >
                  <Download className={`w-3.5 h-3.5 ${isExportingZip ? 'animate-bounce' : ''}`} />
                  <span>{isExportingZip ? 'Exporting ZIP...' : 'Download Project (.zip)'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Card 3: Context */}
        <div className="bg-white rounded-xl border border-[#EBE7DF] shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsContextOpen(!isContextOpen)}
            className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div>
              <h4 className="text-xs font-bold text-slate-800">Context</h4>
              <p className="text-[10px] text-slate-500">Track the tools and files in use as Cortex works.</p>
            </div>
            {isContextOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {isContextOpen && (
            <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-slate-100 text-xs">
              {/* Context Window Selector inside Context Card */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Context Window
                </label>
                <select
                  value={contextPreference}
                  onChange={(e) => onChangeContextPreference(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 cursor-pointer focus:outline-none"
                >
                  <option value="auto">Auto (1M Tokens)</option>
                  <option value="32k">32K Tokens</option>
                  <option value="64k">64K Tokens</option>
                  <option value="128k">128K Tokens</option>
                  <option value="200k">200K Tokens</option>
                  <option value="500k">500K Tokens</option>
                  <option value="1m">1M Tokens</option>
                </select>
                {contextBudget && (
                  <div className="text-[10px] text-slate-500 font-mono mt-1 flex justify-between">
                    <span>Utilization: {contextBudget.utilizationPercent}%</span>
                    <span>Rem: {(contextBudget.remainingTokens / 1024).toFixed(0)}K</span>
                  </div>
                )}
              </div>

              {/* Permission Mode Selector inside Context Card */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Permission Policy
                </label>
                <select
                  value={workspace?.permissionMode || 'approve_plan'}
                  onChange={(e) => onUpdatePermissionMode(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 cursor-pointer focus:outline-none"
                >
                  <option value="approve_plan">Mode B: Approve Plan (Default)</option>
                  <option value="ask_every_change">Mode A: Ask Every Change</option>
                  <option value="session_edit">Mode C: Session Edit</option>
                </select>
              </div>

              {/* Tech Stack & Git info */}
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-mono space-y-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Root:</span>
                  <span className="truncate max-w-[140px] font-bold">{workspace?.name}</span>
                </div>
                {projectStack && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Stack:</span>
                    <span className="text-[#EA580C] font-semibold">{projectStack.framework}</span>
                  </div>
                )}
                {gitStatus?.isGit && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Git:</span>
                    <span className="font-semibold">{gitStatus.branch || 'main'}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Card 4: Terminal & Execution Stream */}
        <div className="bg-white rounded-xl border border-[#EBE7DF] shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsTerminalCardOpen(!isTerminalCardOpen)}
            className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-600" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">Terminal Stream</h4>
                <p className="text-[10px] text-slate-500">Live stdout/stderr & execution</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isExecutingCommand && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Running
                </span>
              )}
              {isTerminalCardOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>

          {isTerminalCardOpen && (
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-100">
              <div className="rounded-lg bg-[#16161E] border border-slate-800 p-2.5 text-[10px] font-mono text-slate-200 max-h-56 overflow-y-auto">
                {terminalOutput ? (
                  <div
                    className="whitespace-pre-wrap break-all leading-relaxed font-mono"
                    dangerouslySetInnerHTML={{
                      __html: parseAnsiToHtml(terminalOutput.stdout || terminalOutput.stderr || 'Command completed with 0 exit code.'),
                    }}
                  />
                ) : (
                  <div className="text-slate-500 italic py-2">
                    No active command logs. Execute tests or build tasks to inspect live output stream.
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
                {terminalOutput && (
                  <div className="text-[10px] font-mono flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${terminalOutput.exitCode === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="text-slate-500">Exit: {terminalOutput.exitCode}</span>
                    <span className="text-slate-400">({terminalOutput.durationMs}ms)</span>
                  </div>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  {onExecuteTerminal && (
                    <button
                      type="button"
                      onClick={() => onExecuteTerminal('npm test')}
                      disabled={isExecutingCommand}
                      className="px-2 py-0.5 text-[9px] font-mono text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer transition-colors"
                    >
                      test
                    </button>
                  )}
                  {terminalOutput && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(terminalOutput.stdout || terminalOutput.stderr || '');
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {isCopied ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
