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
  ChevronDown,
  Layers,
  Terminal,
  Trash2,
  X,
  Zap,
  Folder,
  FolderOpen,
  File,
  GitBranch,
  Save,
  RotateCcw,
  ShieldAlert,
  Search,
  Eye,
} from 'lucide-react';
import { AgentTask, Workspace, WorkspaceArtifact, WorkspaceFileNode, ExecutionCommandResult } from '../server/types';
import { fetchGraphQL, advanceTaskApi } from '../lib/api';

interface CoworkWorkspaceProps {
  workspace: Workspace | null;
  onRefreshWorkspace: () => void;
}

export const CoworkWorkspace: React.FC<CoworkWorkspaceProps> = ({
  workspace,
  onRefreshWorkspace,
}) => {
  // Tasks state
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // New task form state
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [goal, setGoal] = useState('');
  const [title, setTitle] = useState('');
  const [constraints, setConstraints] = useState('');
  const [desiredOutput, setDesiredOutput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real Project Filesystem state
  const [fileTree, setFileTree] = useState<WorkspaceFileNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string>('');
  const [editedFileContent, setEditedFileContent] = useState<string>('');
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [gitStatus, setGitStatus] = useState<any>(null);

  // Artifacts state (backward compatibility)
  const [artifacts, setArtifacts] = useState<WorkspaceArtifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<WorkspaceArtifact | null>(null);
  const [copiedArtId, setCopiedArtId] = useState<string | null>(null);

  // Right panel view mode: 'editor' | 'diff' | 'artifacts'
  const [rightViewMode, setRightViewMode] = useState<'editor' | 'diff' | 'artifacts'>('editor');

  // Terminal state
  const [terminalCommand, setTerminalCommand] = useState('');
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<ExecutionCommandResult | null>(null);
  const [terminalHistory, setTerminalHistory] = useState<Array<{ command: string; result: ExecutionCommandResult }>>([]);

  // Project stack & local folder binding state
  const [projectStack, setProjectStack] = useState<any>(null);
  const [isBindingLocal, setIsBindingLocal] = useState(false);
  const [localFolderPath, setLocalFolderPath] = useState('');
  const [localWorkspaceName, setLocalWorkspaceName] = useState('');
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([]);
  const [isSelectingWorkspace, setIsSelectingWorkspace] = useState(false);
  const [isBindingSubmitting, setIsBindingSubmitting] = useState(false);

  // Load Workspaces list
  const loadWorkspaces = async () => {
    try {
      const res = await fetch('/api/cowork/workspaces');
      const data = await res.json();
      if (data.success && data.workspaces) {
        setAvailableWorkspaces(data.workspaces);
      }
    } catch (err) {
      console.warn('Failed to load workspaces:', err);
    }
  };

  // Load Real Project Tree & Stack
  const loadProjectTree = async () => {
    if (!workspace) return;
    try {
      const res = await fetch(`/api/cowork/workspaces/${workspace.id}/tree`);
      const data = await res.json();
      if (data.success && data.tree) {
        setFileTree(data.tree);
        if (data.git) {
          setGitStatus(data.git);
        }
        if (data.stack) {
          setProjectStack(data.stack);
        }
      }
    } catch (err) {
      console.warn('Failed to load project tree:', err);
    }
  };

  // Bind local project folder
  const handleBindLocalFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localFolderPath.trim() || isBindingSubmitting) return;
    setIsBindingSubmitting(true);
    try {
      const res = await fetch('/api/cowork/workspaces/bind-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: localFolderPath.trim(),
          name: localWorkspaceName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsBindingLocal(false);
        setLocalFolderPath('');
        setLocalWorkspaceName('');
        onRefreshWorkspace();
        await loadWorkspaces();
      } else {
        alert(data.error || 'Failed to bind local folder.');
      }
    } catch (err: any) {
      alert(`Error binding folder: ${err.message}`);
    } finally {
      setIsBindingSubmitting(false);
    }
  };

  // Read a real file
  const handleSelectFile = async (filePath: string) => {
    if (!workspace) return;
    setSelectedFilePath(filePath);
    setSelectedArtifact(null);
    setRightViewMode('editor');
    setIsFileLoading(true);

    try {
      const res = await fetch(`/api/cowork/workspaces/${workspace.id}/file?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.success) {
        setSelectedFileContent(data.content);
        setEditedFileContent(data.content);
      } else {
        setSelectedFileContent(`// Error loading file: ${data.error}`);
        setEditedFileContent(`// Error loading file: ${data.error}`);
      }
    } catch (err: any) {
      setSelectedFileContent(`// Network error loading file: ${err.message}`);
      setEditedFileContent(`// Network error loading file: ${err.message}`);
    } finally {
      setIsFileLoading(false);
    }
  };

  // Save changes to a real file
  const handleSaveFile = async () => {
    if (!workspace || !selectedFilePath || isSavingFile) return;
    setIsSavingFile(true);
    try {
      const res = await fetch(`/api/cowork/workspaces/${workspace.id}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedFilePath,
          content: editedFileContent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedFileContent(editedFileContent);
        await loadProjectTree();
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setIsSavingFile(false);
    }
  };

  // Execute terminal command
  const handleExecuteTerminal = async (cmdToRun?: string) => {
    const cmd = cmdToRun || terminalCommand;
    if (!workspace || !cmd.trim() || isExecutingCommand) return;

    setIsExecutingCommand(true);
    try {
      const res = await fetch(`/api/cowork/workspaces/${workspace.id}/terminal/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd.trim() }),
      });
      const data = await res.json();
      if (data.result) {
        setTerminalOutput(data.result);
        setTerminalHistory((prev) => [{ command: cmd.trim(), result: data.result }, ...prev.slice(0, 9)]);
      }
      setTerminalCommand('');
      await loadProjectTree();
    } catch (err: any) {
      setTerminalOutput({
        exitCode: 1,
        stdout: '',
        stderr: err.message || 'Terminal command execution failed.',
        durationMs: 0,
        timedOut: false,
      });
    } finally {
      setIsExecutingCommand(false);
    }
  };

  // Load tasks & artifacts via GraphQL
  const loadWorkspaceData = async () => {
    if (!workspace) return;
    try {
      const data = await fetchGraphQL(
        `
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
            steps {
              id
              title
              description
              status
              tool
              requiresApproval
              isApproved
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
      `,
        { wsId: workspace.id }
      );

      if (data) {
        if (data.agentTasks) {
          setTasks(data.agentTasks);
          if (data.agentTasks.length > 0 && !selectedTaskId) {
            setSelectedTaskId(data.agentTasks[0].id);
          }
        }
        if (data.artifacts) {
          setArtifacts(data.artifacts);
        }
      }
    } catch (err) {
      console.error('Error fetching workspace data:', err);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
    loadProjectTree();
  }, [workspace]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // Create new task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !title.trim() || !goal.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const data = await fetchGraphQL(
        `
        mutation CreateTask($wsId: ID!, $title: String!, $goal: String!, $constraints: String, $desiredOutput: String) {
          createAgentTask(workspaceId: $wsId, title: $title, goal: $goal, constraints: $constraints, desiredOutput: $desiredOutput) {
            id
            title
            status
          }
        }
      `,
        {
          wsId: workspace.id,
          title,
          goal,
          constraints: constraints || undefined,
          desiredOutput: desiredOutput || undefined,
        }
      );

      if (data?.createAgentTask) {
        setTitle('');
        setGoal('');
        setConstraints('');
        setDesiredOutput('');
        setIsCreatingTask(false);
        await loadWorkspaceData();
        setSelectedTaskId(data.createAgentTask.id);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Advance Task
  const handleAdvanceTask = async (taskId: string) => {
    try {
      await advanceTaskApi(taskId);
      await loadWorkspaceData();
      await loadProjectTree();
    } catch (err) {
      console.error('Failed to advance task:', err);
    }
  };

  // Server-Enforced Approval
  const handleApproveStep = async (taskId: string, stepId: string) => {
    try {
      await fetch(`/api/cowork/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
      });
      await loadWorkspaceData();
      await loadProjectTree();
    } catch (err) {
      console.error('Failed to approve step:', err);
    }
  };

  // Server-Enforced Rejection
  const handleRejectStep = async (taskId: string, stepId: string) => {
    try {
      await fetch(`/api/cowork/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, reason: 'Rejected by developer' }),
      });
      await loadWorkspaceData();
    } catch (err) {
      console.error('Failed to reject step:', err);
    }
  };

  // Cancel Task
  const handleCancelTask = async (taskId: string) => {
    try {
      await fetch(`/api/cowork/tasks/${taskId}/cancel`, { method: 'POST' });
      await loadWorkspaceData();
    } catch (err) {
      console.error('Failed to cancel task:', err);
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
              handleSelectFile(node.path);
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

  return (
    <div className="flex flex-col h-full w-full bg-white select-none overflow-hidden font-sans">
      {/* Top Workspace Header */}
      <div className="h-12 border-b border-[#E5E7EB] px-4 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#FFF9F3] border border-[#FFE8D6] flex items-center justify-center text-[#FF6B00]">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900">
              {workspace?.name || 'Primary Workspace'}
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <span>Path: {workspace?.projectRoot || 'workspaces/' + (workspace?.id || '')}</span>
              {gitStatus?.isGit && (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                  <GitBranch className="w-3 h-3" />
                  {gitStatus.branch || 'main'}
                </span>
              )}
              {projectStack && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-sans text-[10px] font-medium border border-blue-200">
                  {projectStack.framework}
                  {projectStack.hasTests && ' · Tests'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadWorkspaces();
              setIsBindingLocal(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Bind local project folder"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Open Project Folder</span>
          </button>
          <button
            onClick={() => {
              loadWorkspaceData();
              loadProjectTree();
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Refresh repository and tasks"
          >
            <RefreshCw className="w-3 h-3 text-slate-500" />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setIsCreatingTask(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#FF6B00] hover:bg-[#E56000] rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>New Co-Work Goal</span>
          </button>
        </div>
      </div>

      {/* Bind Local Folder Modal */}
      {isBindingLocal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">Select Local Project Folder</h3>
              </div>
              <button
                onClick={() => setIsBindingLocal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBindLocalFolder} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Local Folder Path <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. D:\Chat Application or /home/user/project"
                  value={localFolderPath}
                  onChange={(e) => setLocalFolderPath(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6B00] bg-slate-50/50"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter absolute path to authorized local project folder. Stack and scripts will be automatically detected.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Workspace Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Core Service"
                  value={localWorkspaceName}
                  onChange={(e) => setLocalWorkspaceName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#FF6B00]"
                />
              </div>

              {availableWorkspaces.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[11px] font-semibold text-slate-600 mb-2">Recent Authorized Projects:</div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {availableWorkspaces.map((ws) => (
                      <div
                        key={ws.id}
                        onClick={() => {
                          if (ws.projectRoot) setLocalFolderPath(ws.projectRoot);
                          setLocalWorkspaceName(ws.name);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-amber-50 border border-slate-200/80 text-xs flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <span className="font-semibold text-slate-800">{ws.name}</span>
                        <span className="font-mono text-[10px] text-slate-500 truncate max-w-[200px]">{ws.projectRoot || ws.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBindingLocal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBindingSubmitting || !localFolderPath.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#FF6B00] hover:bg-[#E56000] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isBindingSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Authorize & Open Workspace</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main 3-Column IDE Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Task & Step Orchestrator (30% width) */}
        <div className="w-80 border-r border-[#E5E7EB] bg-slate-50 flex flex-col shrink-0 overflow-hidden">
          {/* Create Task Modal / Drawer */}
          {isCreatingTask ? (
            <div className="p-4 bg-white border-b border-slate-200 overflow-y-auto max-h-96">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-900">New Autonomous Goal</h3>
                <button
                  onClick={() => setIsCreatingTask(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateTask} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Implement JWT Auth & Token Verification"
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:border-[#FF6B00]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Goal</label>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Describe the objective in detail..."
                    rows={2}
                    className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:border-[#FF6B00]"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingTask(false)}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3 py-1 text-xs font-semibold text-white bg-[#FF6B00] hover:bg-[#E56000] rounded"
                  >
                    {isSubmitting ? 'Planning...' : 'Plan Task'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {/* Task List Selector */}
          <div className="p-3 border-b border-slate-200 bg-white">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Autonomous Tasks ({tasks.length})
            </span>
            <div className="space-y-1 max-h-36 overflow-y-auto no-scrollbar">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer flex items-center justify-between ${
                    selectedTaskId === task.id
                      ? 'bg-[#FFF7ED] text-[#EA580C] font-bold border border-[#FFEDD5]'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate pr-2">{task.title}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded capitalize ${
                      task.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : task.status === 'awaiting_approval'
                        ? 'bg-amber-100 text-amber-700 font-bold'
                        : task.status === 'failed'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Task Steps & Approval Gates */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {selectedTask ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-900">Execution Plan</h3>
                  <div className="flex items-center gap-1">
                    {selectedTask.status !== 'completed' && selectedTask.status !== 'cancelled' && (
                      <button
                        onClick={() => handleCancelTask(selectedTask.id)}
                        className="px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:text-rose-600 rounded cursor-pointer"
                        title="Cancel task execution"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => handleAdvanceTask(selectedTask.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-2xs transition-colors cursor-pointer"
                      title="Advance to next step"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Advance</span>
                    </button>
                  </div>
                </div>

                {/* Steps List */}
                <div className="space-y-2">
                  {selectedTask.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={`p-2.5 rounded-lg border text-xs transition-colors ${
                        step.status === 'completed'
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : step.status === 'awaiting_approval'
                          ? 'bg-amber-50 border-amber-300 shadow-2xs'
                          : step.status === 'running'
                          ? 'bg-white border-[#FF6B00] shadow-2xs'
                          : 'bg-white border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {step.status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        ) : step.status === 'awaiting_approval' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0 animate-pulse" />
                        ) : step.status === 'running' ? (
                          <RefreshCw className="w-3.5 h-3.5 text-[#FF6B00] animate-spin mt-0.5 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {idx + 1}. {step.title}
                          </div>
                          <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                            {step.description}
                          </div>

                          {step.tool && (
                            <div className="mt-1 text-[10px] font-mono text-slate-400">
                              Tool: <span className="text-[#EA580C] font-semibold">{step.tool}</span>
                            </div>
                          )}

                          {/* Server-Enforced Approval Dialog */}
                          {step.requiresApproval && !step.isApproved && step.status === 'awaiting_approval' && (
                            <div className="mt-2.5 p-2 bg-amber-100/70 border border-amber-300 rounded text-amber-900 text-[11px]">
                              <div className="flex items-center gap-1 font-bold mb-1">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                                <span>Human Approval Required</span>
                              </div>
                              <p className="text-[10px] leading-relaxed mb-2 text-amber-800">
                                This action modifies repository state or runs shell commands. Confirm execution?
                              </p>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleApproveStep(selectedTask.id, step.id)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 rounded shadow-2xs cursor-pointer"
                                >
                                  Approve & Run
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectStep(selectedTask.id, step.id)}
                                  className="px-2 py-1 text-[11px] text-amber-800 hover:bg-amber-200/80 rounded cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Create or select a task above.
              </div>
            )}
          </div>
        </div>

        {/* Center-Left: Project File Tree Explorer (20% width) */}
        <div className="w-64 border-r border-[#E5E7EB] bg-white flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-[#E5E7EB] bg-slate-50/80 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Project Explorer
            </span>
            <button
              onClick={loadProjectTree}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              title="Refresh files"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
              <input
                type="text"
                placeholder="Search files..."
                value={fileSearchQuery}
                onChange={(e) => setFileSearchQuery(e.target.value)}
                className="w-full text-[11px] pl-6 pr-2 py-1 rounded bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#FF6B00]"
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

        {/* Center-Right: Code Editor & Artifact / Diff Workspace (Remaining width) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Editor Header Bar with Tabs */}
          <div className="h-10 border-b border-[#E5E7EB] bg-slate-50 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRightViewMode('editor')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t border-b-2 transition-colors cursor-pointer ${
                  rightViewMode === 'editor'
                    ? 'border-[#FF6B00] text-slate-900 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {selectedFilePath ? pathBasename(selectedFilePath) : 'Source Editor'}
              </button>
              <button
                onClick={() => setRightViewMode('diff')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t border-b-2 transition-colors cursor-pointer ${
                  rightViewMode === 'diff'
                    ? 'border-[#FF6B00] text-slate-900 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Unified Diff Review
              </button>
              <button
                onClick={() => setRightViewMode('artifacts')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-t border-b-2 transition-colors cursor-pointer ${
                  rightViewMode === 'artifacts'
                    ? 'border-[#FF6B00] text-slate-900 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Artifacts ({artifacts.length})
              </button>
            </div>

            {rightViewMode === 'editor' && selectedFilePath && (
              <div className="flex items-center gap-2">
                {editedFileContent !== selectedFileContent && (
                  <span className="text-[10px] text-amber-600 font-semibold">• Unsaved</span>
                )}
                <button
                  onClick={handleSaveFile}
                  disabled={isSavingFile || editedFileContent === selectedFileContent}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingFile ? 'Saving...' : 'Save File'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Editor / Diff Main Content Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-white">
            {rightViewMode === 'editor' ? (
              selectedFilePath ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs text-slate-500 font-mono">
                    <span>{selectedFilePath}</span>
                    <span>{editedFileContent.split('\n').length} lines</span>
                  </div>
                  <textarea
                    value={editedFileContent}
                    onChange={(e) => setEditedFileContent(e.target.value)}
                    className="flex-1 w-full p-3 font-mono text-xs text-slate-800 bg-slate-50/50 rounded-lg border border-slate-200 focus:outline-none focus:border-[#FF6B00] resize-none leading-relaxed"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="py-24 text-center text-xs text-slate-400">
                  Select a file from the Project Explorer or run an agent task.
                </div>
              )
            ) : rightViewMode === 'diff' ? (
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-2">Repository Changes & Diff</h3>
                {gitStatus?.modified?.length > 0 ? (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-xs">
                    <div className="font-bold text-slate-700 mb-1">Modified Files:</div>
                    {gitStatus.modified.map((m: string) => (
                      <div key={m} className="text-amber-600">• {m}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic py-4">
                    No active modifications in workspace. Clean working tree.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-3">Workspace Artifacts</h3>
                <div className="space-y-3">
                  {artifacts.map((art) => (
                    <div key={art.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                        <span>{art.title}</span>
                        <span className="font-mono text-[10px] text-slate-400">v{art.version}</span>
                      </div>
                      <pre className="font-mono text-[11px] text-slate-700 max-h-40 overflow-y-auto bg-white p-2 rounded border border-slate-200">
                        <code>{art.content}</code>
                      </pre>
                    </div>
                  ))}
                  {artifacts.length === 0 && (
                    <div className="text-xs text-slate-400">No standalone artifacts created.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panel: Interactive Terminal */}
          <div className="h-48 border-t border-slate-800 bg-[#16161E] text-slate-200 flex flex-col shrink-0">
            {/* Terminal Top Bar */}
            <div className="px-3 py-1.5 bg-[#1F1F2E] border-b border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-slate-200">Interactive Terminal</span>
                {terminalOutput && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      terminalOutput.exitCode === 0
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    exit: {terminalOutput.exitCode} ({terminalOutput.durationMs}ms)
                  </span>
                )}
              </div>

              {/* Quick Command Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleExecuteTerminal('npm test')}
                  disabled={isExecutingCommand}
                  className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                >
                  npm test
                </button>
                <button
                  onClick={() => handleExecuteTerminal('git status')}
                  disabled={isExecutingCommand}
                  className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                >
                  git status
                </button>
                <button
                  onClick={() => setTerminalOutput(null)}
                  className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                  title="Clear terminal"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 p-3 font-mono text-xs overflow-y-auto no-scrollbar space-y-1">
              {isExecutingCommand && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Executing command in workspace...</span>
                </div>
              )}
              {terminalOutput ? (
                <div>
                  {terminalOutput.stdout && (
                    <pre className="text-slate-200 whitespace-pre-wrap break-all leading-relaxed">
                      {terminalOutput.stdout}
                    </pre>
                  )}
                  {terminalOutput.stderr && (
                    <pre className="text-rose-400 whitespace-pre-wrap break-all leading-relaxed mt-1">
                      {terminalOutput.stderr}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 italic">
                  Run development commands (npm test, git diff, tsc) in authorized workspace root.
                </div>
              )}
            </div>

            {/* Terminal Command Input */}
            <div className="p-2 border-t border-slate-800 bg-[#1A1A26] flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-xs select-none">❯</span>
              <input
                type="text"
                placeholder="Enter command (e.g. npm test, git status)..."
                value={terminalCommand}
                onChange={(e) => setTerminalCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteTerminal();
                }}
                disabled={isExecutingCommand}
                className="flex-1 bg-transparent text-xs font-mono text-white focus:outline-none placeholder-slate-500"
              />
              <button
                onClick={() => handleExecuteTerminal()}
                disabled={isExecutingCommand || !terminalCommand.trim()}
                className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded cursor-pointer"
              >
                Run
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function pathBasename(p: string): string {
  const parts = p.split(/[\/\\]/);
  return parts[parts.length - 1] || p;
}
