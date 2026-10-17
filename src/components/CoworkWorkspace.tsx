import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCode,
  FileText,
  Copy,
  Download,
  Plus,
  RefreshCw,
  GitCommit,
  Check,
  ChevronRight,
  Layers,
  Terminal,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { AgentTask, Workspace, WorkspaceArtifact } from '../server/types';
import { fetchGraphQL, advanceTaskApi } from '../lib/api';

interface CoworkWorkspaceProps {
  workspace: Workspace | null;
  onRefreshWorkspace: () => void;
}

export const CoworkWorkspace: React.FC<CoworkWorkspaceProps> = ({
  workspace,
  onRefreshWorkspace,
}) => {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<WorkspaceArtifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<WorkspaceArtifact | null>(null);

  // New task form state
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [goal, setGoal] = useState('');
  const [title, setTitle] = useState('');
  const [constraints, setConstraints] = useState('');
  const [desiredOutput, setDesiredOutput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedArtId, setCopiedArtId] = useState<string | null>(null);

  // Sandboxed Code Execution Runner State
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [executionResult, setExecutionResult] = useState<{
    success: boolean;
    output?: {
      language: string;
      executionTimeMs: number;
      logs: Array<{ type: string; text: string; time: string }>;
      result?: string;
    };
    error?: string;
  } | null>(null);
  const [isExecutionDrawerOpen, setIsExecutionDrawerOpen] = useState(false);

  const isExecutableArtifact = (lang?: string) => {
    const l = (lang || '').toLowerCase();
    return ['javascript', 'js', 'typescript', 'ts', 'json', 'python', 'py', 'node'].includes(l);
  };

  const handleRunArtifactCode = async () => {
    if (!selectedArtifact || isRunningCode) return;
    setIsRunningCode(true);
    setIsExecutionDrawerOpen(true);
    try {
      const res = await fetch('/api/cowork/run-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: selectedArtifact.content,
          language: selectedArtifact.language || 'javascript',
          workspaceId: workspace?.id || 'default',
        }),
      });
      const data = await res.json();
      setExecutionResult(data);
    } catch (err: any) {
      setExecutionResult({
        success: false,
        error: err.message || 'Execution failed due to network or server error.',
      });
    } finally {
      setIsRunningCode(false);
    }
  };

  // Load tasks & artifacts
  const loadWorkspaceData = async () => {
    if (!workspace) return;
    try {
      const data = await fetchGraphQL(`
        query GetWorkspaceData($wsId: ID!) {
          agentTasks(workspaceId: $wsId) {
            id
            title
            goal
            constraints
            desiredOutput
            status
            modelId
            summary
            error
            currentStepIndex
            steps {
              id
              title
              description
              status
              tool
              requiresApproval
              isApproved
              output
            }
          }
          artifacts(workspaceId: $wsId) {
            id
            title
            fileName
            language
            content
            version
            createdAt
            updatedAt
          }
        }
      `, { wsId: workspace.id });

      if (data) {
        if (data.agentTasks) {
          setTasks(data.agentTasks);
          if (data.agentTasks.length > 0 && !selectedTaskId) {
            setSelectedTaskId(data.agentTasks[0].id);
          }
        }
        if (data.artifacts) {
          setArtifacts(data.artifacts);
          if (data.artifacts.length > 0 && !selectedArtifact) {
            setSelectedArtifact(data.artifacts[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load workspace data', err);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [workspace]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !title.trim() || !goal.trim()) return;

    setIsSubmitting(true);
    try {
      const data = await fetchGraphQL(`
        mutation CreateTask(
          $workspaceId: ID!
          $title: String!
          $goal: String!
          $constraints: String
          $desiredOutput: String
        ) {
          createAgentTask(
            workspaceId: $workspaceId
            title: $title
            goal: $goal
            constraints: $constraints
            desiredOutput: $desiredOutput
          ) {
            id
            title
            status
          }
        }
      `, {
        workspaceId: workspace.id,
        title,
        goal,
        constraints: constraints || null,
        desiredOutput: desiredOutput || null,
      });

      if (data?.createAgentTask) {
        setTitle('');
        setGoal('');
        setConstraints('');
        setDesiredOutput('');
        setIsCreatingTask(false);
        await loadWorkspaceData();
        setSelectedTaskId(data.createAgentTask.id);
      }
    } catch (err: any) {
      alert(`Failed to create task: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvanceTask = async (taskId: string) => {
    try {
      await advanceTaskApi(taskId);
      await loadWorkspaceData();
    } catch (err: any) {
      alert(`Failed to execute step: ${err.message}`);
    }
  };

  const handleApproveStep = async (taskId: string, stepId: string) => {
    try {
      await fetchGraphQL(`
        mutation Approve($taskId: ID!, $stepId: ID!) {
          approveAgentTaskStep(taskId: $taskId, stepId: $stepId) {
            id
            status
          }
        }
      `, { taskId, stepId });
      await loadWorkspaceData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  const copyArtifactContent = (art: WorkspaceArtifact) => {
    navigator.clipboard.writeText(art.content);
    setCopiedArtId(art.id);
    setTimeout(() => setCopiedArtId(null), 2000);
  };

  const downloadArtifact = (art: WorkspaceArtifact) => {
    const blob = new Blob([art.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = art.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-white font-sans">
      {/* Left Column: Task list & Planning State Machine */}
      <div className="w-full md:w-1/2 border-r border-[#E5E7EB] flex flex-col h-full overflow-hidden bg-white">
        {/* Workspace Toolbar */}
        <div className="p-4 border-b border-[#F0F2F4] bg-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#FFF9F3] border border-[#FFE8D6] flex items-center justify-center text-[#FF6B00]">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">{workspace?.name || 'Co-Work Workspace'}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Autonomous task decomposition, approval gates &amp; artifacts</p>
          </div>

          <button
            onClick={() => setIsCreatingTask(!isCreatingTask)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#FF6B00] hover:bg-[#E86000] rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        </div>

        {/* Task Creation Form (collapsible) */}
        {isCreatingTask && (
          <form onSubmit={handleCreateTask} className="p-4 bg-[#FFF9F3] border-b border-[#FFE8D6] space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Task Title</label>
              <input
                type="text"
                placeholder="e.g. Implement Distributed Rate Limiter"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Objective &amp; Goal</label>
              <textarea
                rows={2}
                placeholder="Describe the objective, problem statement, or code to engineer..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#FF6B00]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Constraints</label>
                <input
                  type="text"
                  placeholder="e.g. Strict TypeScript, Zero deps"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Desired Output</label>
                <input
                  type="text"
                  placeholder="e.g. 1 Artifact, tested"
                  value={desiredOutput}
                  onChange={(e) => setDesiredOutput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingTask(false)}
                className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1 text-xs font-semibold text-white bg-[#FF6B00] hover:bg-[#E86000] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Planning...' : 'Generate Plan'}
              </button>
            </div>
          </form>
        )}

        {/* Tasks Horizontal Switcher */}
        <div className="px-4 py-2 bg-slate-50 border-b border-[#F0F2F4] flex items-center gap-2 overflow-x-auto no-scrollbar">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => setSelectedTaskId(task.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedTaskId === task.id
                  ? 'bg-white text-slate-900 border border-[#E5E7EB] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${task.status === 'completed' ? 'bg-emerald-500' : task.status === 'running' ? 'bg-[#FF6B00]' : 'bg-slate-300'}`} />
              <span>{task.title}</span>
              <span className="text-[10px] font-mono text-slate-400">({task.status})</span>
            </button>
          ))}
          {tasks.length === 0 && (
            <span className="text-xs text-slate-400 py-1">No tasks in this workspace yet.</span>
          )}
        </div>

        {/* Selected Task Execution Timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {selectedTask ? (
            <div className="space-y-4">
              {/* Task Header Card */}
              <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedTask.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{selectedTask.goal}</p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      selectedTask.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : selectedTask.status === 'running'
                        ? 'bg-orange-50 text-[#FF6B00] border border-orange-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {selectedTask.status}
                  </span>
                </div>

                {selectedTask.constraints && (
                  <div className="mt-3 text-[11px] text-slate-500">
                    <strong className="text-slate-700">Constraints:</strong> {selectedTask.constraints}
                  </div>
                )}
              </div>

              {/* Steps Progress Header & Advance Button */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Execution Plan ({selectedTask.steps.length} Steps)
                </div>

                {selectedTask.status !== 'completed' && (
                  <button
                    onClick={() => handleAdvanceTask(selectedTask.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#FF6B00] hover:bg-[#E86000] rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Advance Step</span>
                  </button>
                )}
              </div>

              {/* Execution Steps */}
              <div className="space-y-2.5">
                {selectedTask.steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      step.status === 'completed'
                        ? 'bg-slate-50/70 border-slate-200'
                        : step.status === 'running'
                        ? 'bg-[#FFF9F3] border-[#FFE8D6] shadow-2xs'
                        : 'bg-white border-[#E5E7EB]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {step.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : step.status === 'running' ? (
                          <RefreshCw className="w-4 h-4 text-[#FF6B00] animate-spin" />
                        ) : (
                          <Clock className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900">
                            {idx + 1}. {step.title}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400 capitalize">
                            {step.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {step.description}
                        </p>

                        {step.tool && (
                          <div className="mt-2 text-[10px] text-slate-500 font-mono">
                            Tool: <span className="text-[#FF6B00]">{step.tool}</span>
                          </div>
                        )}

                        {/* Approval Gate */}
                        {step.requiresApproval && !step.isApproved && step.status === 'running' && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-amber-900">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Approval required before running destructive tool</span>
                            </div>
                            <button
                              onClick={() => handleApproveStep(selectedTask.id, step.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-xs text-slate-400">
              Select or create a Co-Work task above.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Artifacts Explorer & Preview */}
      <div className="w-full md:w-1/2 flex flex-col h-full overflow-hidden bg-slate-50">
        {/* Artifacts Header */}
        <div className="p-4 border-b border-[#F0F2F4] bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#FFF9F3] border border-[#FFE8D6] flex items-center justify-center text-[#FF6B00]">
              <FileCode className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Workspace Artifacts ({artifacts.length})
            </h3>
          </div>

          {selectedArtifact && (
            <div className="flex items-center gap-2">
              {isExecutableArtifact(selectedArtifact.language) && (
                <button
                  onClick={handleRunArtifactCode}
                  disabled={isRunningCode}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Execute code in sandboxed runner"
                >
                  {isRunningCode ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                  <span>{isRunningCode ? 'Running...' : 'Run Code'}</span>
                </button>
              )}
              <button
                onClick={() => copyArtifactContent(selectedArtifact)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Copy artifact content"
              >
                {copiedArtId === selectedArtifact.id ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-500" />
                )}
                <span>{copiedArtId === selectedArtifact.id ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => downloadArtifact(selectedArtifact)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Download artifact file"
              >
                <Download className="w-3 h-3 text-slate-500" />
                <span>Export</span>
              </button>
            </div>
          )}
        </div>

        {/* Artifact File Tabs */}
        <div className="px-4 py-2 border-b border-[#F0F2F4] bg-slate-50 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {artifacts.map((art) => (
            <button
              key={art.id}
              onClick={() => setSelectedArtifact(art)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedArtifact?.id === art.id
                  ? 'bg-white text-slate-900 border border-[#E5E7EB] shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3 h-3 text-[#FF6B00]" />
              <span>{art.fileName}</span>
              <span className="text-[10px] text-slate-400">v{art.version}</span>
            </button>
          ))}
          {artifacts.length === 0 && (
            <span className="text-xs text-slate-400 px-2 py-1">No artifacts created yet.</span>
          )}
        </div>

        {/* Artifact Content Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {selectedArtifact ? (
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 text-xs text-slate-500">
                <span className="font-bold text-slate-900 text-sm">{selectedArtifact.title}</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Format: {selectedArtifact.language}
                </span>
              </div>
              <pre className="text-xs font-mono text-slate-800 leading-relaxed whitespace-pre-wrap p-4 bg-slate-50 rounded-xl border border-slate-200">
                <code>{selectedArtifact.content}</code>
              </pre>

              {/* Execution Drawer Panel */}
              {isExecutionDrawerOpen && (
                <div className="mt-6 rounded-xl border border-slate-800 bg-[#16161E] text-slate-200 overflow-hidden shadow-lg">
                  {/* Console Header Bar */}
                  <div className="px-4 py-2.5 bg-[#1F1F2E] border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold font-mono tracking-wide text-slate-200">
                        Execution Console
                      </span>
                      {executionResult && (
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${
                            executionResult.success
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {executionResult.success ? 'Success' : 'Failed'}
                        </span>
                      )}
                      {executionResult?.output?.executionTimeMs !== undefined && (
                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          {executionResult.output.executionTimeMs}ms
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRunArtifactCode}
                        disabled={isRunningCode}
                        className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                        title="Re-run code"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRunningCode ? 'animate-spin' : ''}`} />
                        <span>Rerun</span>
                      </button>
                      <button
                        onClick={() => setExecutionResult(null)}
                        className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                        title="Clear console logs"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                      <button
                        onClick={() => setIsExecutionDrawerOpen(false)}
                        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Close console"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Console Output Body */}
                  <div className="p-4 font-mono text-xs max-h-72 overflow-y-auto space-y-1.5 no-scrollbar">
                    {isRunningCode && (
                      <div className="flex items-center gap-2 text-slate-400 py-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span>Executing sandboxed code...</span>
                      </div>
                    )}

                    {executionResult?.output?.logs && executionResult.output.logs.length > 0 ? (
                      executionResult.output.logs.map((log, lIdx) => (
                        <div
                          key={lIdx}
                          className={`flex items-start gap-2 ${
                            log.type === 'error'
                              ? 'text-rose-400'
                              : log.type === 'warn'
                              ? 'text-amber-300'
                              : log.type === 'info'
                              ? 'text-sky-300'
                              : 'text-emerald-300'
                          }`}
                        >
                          <span className="text-[10px] text-slate-500 shrink-0 select-none">
                            {new Date(log.time).toLocaleTimeString()}
                          </span>
                          <span className="text-slate-400 select-none">❯</span>
                          <span className="whitespace-pre-wrap break-all">{log.text}</span>
                        </div>
                      ))
                    ) : (
                      !isRunningCode && !executionResult?.error && (
                        <div className="text-slate-500 italic py-1">
                          No stdout output logged.
                        </div>
                      )
                    )}

                    {/* Return Value display */}
                    {executionResult?.output?.result && (
                      <div className="mt-3 pt-2 border-t border-slate-800 text-cyan-300">
                        <span className="text-slate-500 select-none text-[10px] uppercase font-bold block mb-1">
                          Return Value
                        </span>
                        <pre className="whitespace-pre-wrap break-all bg-slate-900/80 p-2.5 rounded border border-slate-800 text-xs">
                          {executionResult.output.result}
                        </pre>
                      </div>
                    )}

                    {/* Fatal Error display */}
                    {executionResult?.error && (
                      <div className="mt-2 p-2.5 rounded bg-rose-950/60 border border-rose-900 text-rose-300 text-xs">
                        <span className="font-bold block mb-0.5">Execution Error:</span>
                        <span className="font-mono">{executionResult.error}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-24 text-center text-xs text-slate-400">
              Select an artifact above to inspect its code or documentation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
