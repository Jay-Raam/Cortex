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
  ShieldAlert,
  GitCommit,
  Check,
  ChevronRight,
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
            createdAt
            steps {
              id
              title
              description
              status
              tool
              requiresApproval
              isApproved
              completedAt
            }
            artifactIds
          }
          artifacts(workspaceId: $wsId) {
            id
            workspaceId
            title
            fileName
            language
            content
            version
            updatedAt
          }
        }
      `, { wsId: workspace.id });

      setTasks(data.agentTasks || []);
      setArtifacts(data.artifacts || []);

      if (data.agentTasks && data.agentTasks.length > 0 && !selectedTaskId) {
        setSelectedTaskId(data.agentTasks[0].id);
      }
      if (data.artifacts && data.artifacts.length > 0 && !selectedArtifact) {
        setSelectedArtifact(data.artifacts[0]);
      }
    } catch (err) {
      console.error('Failed to load Co-Work workspace data:', err);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [workspace?.id]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !goal.trim() || !title.trim()) return;

    setIsSubmitting(true);
    try {
      const data = await fetchGraphQL(`
        mutation CreateTask($wsId: ID!, $title: String!, $goal: String!, $constraints: String, $desiredOutput: String) {
          createAgentTask(workspaceId: $wsId, title: $title, goal: $goal, constraints: $constraints, desiredOutput: $desiredOutput) {
            id
            title
            status
          }
        }
      `, {
        wsId: workspace.id,
        title,
        goal,
        constraints,
        desiredOutput,
      });

      setIsCreatingTask(false);
      setGoal('');
      setTitle('');
      setConstraints('');
      setDesiredOutput('');
      await loadWorkspaceData();
      if (data.createAgentTask) {
        setSelectedTaskId(data.createAgentTask.id);
      }
    } catch (err: any) {
      alert(`Task creation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvanceStep = async (taskId: string) => {
    try {
      await advanceTaskApi(taskId);
      await loadWorkspaceData();
    } catch (err: any) {
      alert(`Failed to advance step: ${err.message}`);
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
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[#090d12]">
      {/* Left Column: Task list & Planning State Machine */}
      <div className="w-full md:w-1/2 border-r border-[#1d2737] flex flex-col h-full overflow-hidden">
        {/* Workspace Toolbar */}
        <div className="p-4 border-b border-[#1d2737] bg-[#0c1219] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">{workspace?.name || 'Co-Work Workspace'}</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Autonomous task decomposition, approval gates &amp; artifacts</p>
          </div>

          <button
            onClick={() => setIsCreatingTask(!isCreatingTask)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        </div>

        {/* Task Creation Form (collapsible) */}
        {isCreatingTask && (
          <form onSubmit={handleCreateTask} className="p-4 bg-[#111822] border-b border-[#1d2737] space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Task Title</label>
              <input
                type="text"
                placeholder="e.g. Implement Distributed Rate Limiter"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-[#090d12] border border-[#232f42] rounded-md text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Objective &amp; Goal</label>
              <textarea
                rows={2}
                placeholder="Describe the objective, problem statement, or code to engineer..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-[#090d12] border border-[#232f42] rounded-md text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Constraints</label>
                <input
                  type="text"
                  placeholder="e.g. Strict TypeScript, Zero deps"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#090d12] border border-[#232f42] rounded-md text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Desired Output</label>
                <input
                  type="text"
                  placeholder="e.g. Full source file + tests"
                  value={desiredOutput}
                  onChange={(e) => setDesiredOutput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#090d12] border border-[#232f42] rounded-md text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingTask(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors"
              >
                {isSubmitting ? 'Planning Task...' : 'Decompose & Plan'}
              </button>
            </div>
          </form>
        )}

        {/* Task Selection Bar */}
        <div className="p-2 border-b border-[#1d2737] bg-[#0c1219] flex items-center gap-1 overflow-x-auto">
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTaskId(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                t.id === selectedTaskId
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131b26]'
              }`}
            >
              <span>{t.title}</span>
              <span className="text-[10px] text-slate-500 font-mono">({t.status})</span>
            </button>
          ))}
          {tasks.length === 0 && (
            <span className="text-xs text-slate-500 px-2 py-1">No tasks in workspace. Click "+ New Task" to begin.</span>
          )}
        </div>

        {/* Selected Task Details & Execution State Machine */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {selectedTask ? (
            <div>
              {/* Task Goal Overview */}
              <div className="p-3.5 bg-[#0f1722] border border-[#232f42] rounded-lg">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-sm font-semibold text-white">{selectedTask.title}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium capitalize ${
                      selectedTask.status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : selectedTask.status === 'awaiting_approval'
                        ? 'bg-amber-500/15 text-amber-400'
                        : selectedTask.status === 'running'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-slate-700/30 text-slate-300'
                    }`}
                  >
                    {selectedTask.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{selectedTask.goal}</p>

                {selectedTask.summary && (
                  <div className="mt-3 pt-2.5 border-t border-[#1d2737] text-xs text-emerald-400">
                    <span className="font-semibold">Result: </span>
                    {selectedTask.summary}
                  </div>
                )}
              </div>

              {/* Steps Timeline */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Execution Plan ({selectedTask.steps.length} Steps)
                  </span>

                  {selectedTask.status !== 'completed' && (
                    <button
                      onClick={() => handleAdvanceStep(selectedTask.id)}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Advance Step</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedTask.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={`p-3 rounded-lg border transition-all ${
                        step.status === 'completed'
                          ? 'bg-[#0c1410] border-emerald-500/30'
                          : step.status === 'running'
                          ? 'bg-[#101b29] border-blue-500/50'
                          : step.status === 'awaiting_approval'
                          ? 'bg-[#1c180e] border-amber-500/50'
                          : 'bg-[#0f1722] border-[#232f42]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5">
                            {step.status === 'completed' && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            )}
                            {step.status === 'running' && (
                              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                            )}
                            {step.status === 'awaiting_approval' && (
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                            )}
                            {step.status === 'pending' && (
                              <Clock className="w-4 h-4 text-slate-500" />
                            )}
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-white">
                              {idx + 1}. {step.title}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                              {step.description}
                            </p>
                            {step.tool && (
                              <div className="mt-1 font-mono text-[11px] text-slate-500">
                                Tool: <span className="text-emerald-400/90">{step.tool}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Approval Gate Button */}
                        {step.status === 'awaiting_approval' && (
                          <div className="shrink-0 flex items-center gap-1.5">
                            <button
                              onClick={() => handleApproveStep(selectedTask.id, step.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded shadow transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-xs text-slate-500">
              Select or create a Co-Work task above.
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Artifacts Explorer & Preview */}
      <div className="w-full md:w-1/2 flex flex-col h-full overflow-hidden bg-[#0a0f16]">
        {/* Artifacts Header */}
        <div className="p-3 border-b border-[#1d2737] bg-[#0c1219] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Workspace Artifacts ({artifacts.length})
            </h3>
          </div>

          {selectedArtifact && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyArtifactContent(selectedArtifact)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 bg-[#16212e] hover:bg-[#1f2f42] border border-[#27374d] rounded transition-colors cursor-pointer"
                title="Copy artifact content"
              >
                {copiedArtId === selectedArtifact.id ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedArtId === selectedArtifact.id ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={() => downloadArtifact(selectedArtifact)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 bg-[#16212e] hover:bg-[#1f2f42] border border-[#27374d] rounded transition-colors cursor-pointer"
                title="Download artifact file"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>
            </div>
          )}
        </div>

        {/* Artifact File Tabs */}
        <div className="p-2 border-b border-[#1d2737] bg-[#080d13] flex items-center gap-1 overflow-x-auto">
          {artifacts.map((art) => (
            <button
              key={art.id}
              onClick={() => setSelectedArtifact(art)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedArtifact?.id === art.id
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131b26]'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>{art.fileName}</span>
              <span className="text-[10px] text-slate-500">v{art.version}</span>
            </button>
          ))}
          {artifacts.length === 0 && (
            <span className="text-xs text-slate-500 px-2 py-1">No artifacts created yet.</span>
          )}
        </div>

        {/* Artifact Content Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#080d13]">
          {selectedArtifact ? (
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1d2737] text-xs text-slate-400">
                <span className="font-semibold text-white">{selectedArtifact.title}</span>
                <span className="font-mono text-[11px]">Format: {selectedArtifact.language}</span>
              </div>
              <pre className="text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap">
                <code>{selectedArtifact.content}</code>
              </pre>
            </div>
          ) : (
            <div className="py-24 text-center text-xs text-slate-500">
              Select an artifact above to inspect its code or documentation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
