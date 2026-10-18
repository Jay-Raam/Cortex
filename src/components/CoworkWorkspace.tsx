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
  Send,
  PanelLeft,
  PanelLeftClose,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { AgentTask, Workspace, WorkspaceArtifact, WorkspaceFileNode, ExecutionCommandResult } from '../server/types';
import { fetchGraphQL, advanceTaskApi } from '../lib/api';

interface CoworkWorkspaceProps {
  workspace: Workspace | null;
  onRefreshWorkspace: () => void;
  onSelectWorkspace?: (ws: Workspace) => void;
}

export const CoworkWorkspace: React.FC<CoworkWorkspaceProps> = ({
  workspace,
  onRefreshWorkspace,
  onSelectWorkspace,
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

  // Canvas drawer & inline prompt state (Claude Cowork / ChatGPT Canvas layout)
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [inlinePrompt, setInlinePrompt] = useState('');
  const [isInlineSubmitting, setIsInlineSubmitting] = useState(false);

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

  // Configurable Context Window state
  const [contextPreference, setContextPreference] = useState<string>(workspace?.contextWindowPreference || 'auto');
  const [contextBudget, setContextBudget] = useState<any>(null);
  const [contextOptions, setContextOptions] = useState<Array<{ id: string; label: string; disabled: boolean }>>([]);

  // Load Context Budget
  const loadContextBudget = async (pref = contextPreference) => {
    if (!workspace) return;
    try {
      const res = await fetch('/api/cowork/context-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'gemini-3.8-flash',
          preference: pref,
          workspaceId: workspace.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setContextBudget(data.budget);
        if (data.options) {
          setContextOptions(data.options);
        }
      }
    } catch (err) {
      console.warn('Failed to load context budget:', err);
    }
  };

  // Change Context Window Preference
  const handleChangeContextPreference = async (newPref: string) => {
    setContextPreference(newPref);
    await loadContextBudget(newPref);
    if (workspace) {
      try {
        await fetch(`/api/cowork/workspaces/${workspace.id}/context-preference`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contextWindowPreference: newPref }),
        });
      } catch {}
    }
  };

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
        if (data.workspace && onSelectWorkspace) {
          onSelectWorkspace(data.workspace);
        }
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
            permissionMode
            isPlanApproved
            plannedFiles
            summary
            error
            steps {
              id
              title
              description
              status
              tool
              operation
              targetPath
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
    loadContextBudget();
    loadWorkspaces();
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

  // Submit quick inline instruction from Co-Work prompt composer
  const handleInlinePromptSubmit = async (customPrompt?: string) => {
    const textToSubmit = (customPrompt || inlinePrompt).trim();
    if (!workspace || !textToSubmit || isInlineSubmitting) return;

    setIsInlineSubmitting(true);
    try {
      const derivedTitle = textToSubmit.length > 55 ? textToSubmit.slice(0, 52) + '...' : textToSubmit;
      const data = await fetchGraphQL(
        `
        mutation CreateTask($wsId: ID!, $title: String!, $goal: String!) {
          createAgentTask(workspaceId: $wsId, title: $title, goal: $goal) {
            id
            title
            status
          }
        }
      `,
        {
          wsId: workspace.id,
          title: derivedTitle,
          goal: textToSubmit,
        }
      );

      if (data?.createAgentTask) {
        setInlinePrompt('');
        await loadWorkspaceData();
        setSelectedTaskId(data.createAgentTask.id);
      }
    } catch (err) {
      console.error('Failed to submit inline task:', err);
    } finally {
      setIsInlineSubmitting(false);
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

  // Approve Complete Plan (Mode B)
  const handleApprovePlan = async (taskId: string) => {
    try {
      await fetch(`/api/cowork/tasks/${taskId}/plan/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await loadWorkspaceData();
      await loadProjectTree();
    } catch (err) {
      console.error('Failed to approve plan:', err);
    }
  };

  // Reject Complete Plan
  const handleRejectPlan = async (taskId: string) => {
    try {
      await fetch(`/api/cowork/tasks/${taskId}/plan/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected by developer' }),
      });
      await loadWorkspaceData();
    } catch (err) {
      console.error('Failed to reject plan:', err);
    }
  };

  // Update Workspace Permission Mode
  const handleUpdatePermissionMode = async (mode: string) => {
    if (!workspace) return;
    try {
      const res = await fetch(`/api/cowork/workspaces/${workspace.id}/permission-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionMode: mode }),
      });
      const data = await res.json();
      if (data.success) {
        onRefreshWorkspace();
      }
    } catch (err) {
      console.error('Failed to update permission mode:', err);
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
    <div className="flex flex-col h-full w-full bg-[#FAF8F5] select-none overflow-hidden font-sans text-slate-800">
      {/* Top Workspace Header - Claude Cowork Style */}
      <div className="h-13 border-b border-[#EBE7DF] px-4 flex items-center justify-between bg-[#FCFAF7] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#FFF7ED] border border-[#FEE5D2] flex items-center justify-center text-[#EA580C] shadow-2xs">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900 tracking-tight">
                {workspace?.name || 'Primary Workspace'}
              </h2>
              {availableWorkspaces.length > 1 && (
                <select
                  value={workspace?.id}
                  onChange={(e) => {
                    const found = availableWorkspaces.find((w) => w.id === e.target.value);
                    if (found && onSelectWorkspace) {
                      onSelectWorkspace(found);
                    }
                  }}
                  className="text-[10px] bg-white hover:bg-slate-50 border border-[#E5E0D8] rounded-md px-1.5 py-0.5 text-slate-700 font-semibold cursor-pointer focus:outline-none shadow-2xs"
                  title="Switch workspace"
                >
                  {availableWorkspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
              <span className="truncate max-w-[200px]" title={workspace?.projectRoot}>
                {workspace?.projectRoot || 'workspaces/' + (workspace?.id || '')}
              </span>
              {gitStatus?.isGit && (
                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-sans font-semibold">
                  <GitBranch className="w-2.5 h-2.5" />
                  {gitStatus.branch || 'main'}
                </span>
              )}
              {projectStack && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#FFF7ED] text-[#9A3412] font-sans text-[10px] font-semibold border border-[#FED7AA]">
                  {projectStack.framework}
                  {projectStack.hasTests && ' · Tests'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Configurable Context Window Selector */}
          <div
            className="flex items-center gap-1.5 bg-white border border-[#E5E0D8] px-2.5 py-1 rounded-lg text-xs shadow-2xs"
            title={contextBudget ? `Effective limit: ${(contextBudget.effectiveLimit / 1024).toFixed(0)}K · Remaining: ${(contextBudget.remainingTokens / 1024).toFixed(1)}K` : undefined}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] uppercase font-bold text-slate-500">Context:</span>
            <select
              value={contextPreference}
              onChange={(e) => handleChangeContextPreference(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-none cursor-pointer"
            >
              <option value="auto">Auto (1M)</option>
              <option value="32k">32K Tokens</option>
              <option value="64k">64K Tokens</option>
              <option value="128k">128K Tokens</option>
              <option value="200k">200K Tokens</option>
              <option value="500k">500K Tokens</option>
              <option value="1m">1M Tokens</option>
            </select>
            {contextBudget && (
              <span className="text-[10px] font-mono text-slate-500 border-l border-[#E5E0D8] pl-1.5">
                {contextBudget.utilizationPercent}%
              </span>
            )}
          </div>

          {/* Permission Mode Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-[#E5E0D8] px-2.5 py-1 rounded-lg text-xs shadow-2xs">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] uppercase font-bold text-slate-500">Mode:</span>
            <select
              value={workspace?.permissionMode || 'approve_plan'}
              onChange={(e) => handleUpdatePermissionMode(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 text-xs focus:outline-none cursor-pointer"
            >
              <option value="approve_plan">Mode B: Approve Plan (Default)</option>
              <option value="ask_every_change">Mode A: Ask Every Change</option>
              <option value="session_edit">Mode C: Session Edit</option>
            </select>
          </div>

          <button
            onClick={() => {
              loadWorkspaces();
              setIsBindingLocal(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-[#E5E0D8] rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Bind local project folder"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Open Folder</span>
          </button>
          <button
            onClick={() => {
              loadWorkspaceData();
              loadProjectTree();
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-[#E5E0D8] rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Refresh repository and tasks"
          >
            <RefreshCw className="w-3 h-3 text-slate-500" />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setIsCreatingTask(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Goal</span>
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
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C] bg-slate-50/50"
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
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C]"
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
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isBindingSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Authorize & Open Workspace</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main 2-Pane Primary Body: Left Mission Control & Right Canvas */}
      <div className="flex-1 flex overflow-hidden bg-[#FAF8F5]">
        {/* Left Pane: Mission Control / Task Orchestration (42-45% width) */}
        <div className="w-[430px] lg:w-[460px] xl:w-[490px] border-r border-[#EBE7DF] bg-[#FAF8F5] flex flex-col shrink-0 overflow-hidden">
          {/* Mission Control Top Bar */}
          <div className="p-3 border-b border-[#EBE7DF] bg-[#FCFAF7] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Mission Control
              </span>
              {tasks.length > 0 && (
                <select
                  value={selectedTaskId || ''}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="text-xs bg-white border border-[#E5E0D8] rounded-lg px-2 py-1 text-slate-800 font-semibold truncate max-w-[210px] cursor-pointer focus:outline-none shadow-2xs"
                  title="Switch Task"
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.status.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {selectedTask && selectedTask.status !== 'completed' && selectedTask.status !== 'cancelled' && (
                <button
                  onClick={() => handleCancelTask(selectedTask.id)}
                  className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 rounded cursor-pointer transition-colors"
                  title="Cancel active goal"
                >
                  Cancel
                </button>
              )}
              {selectedTask && (
                <button
                  onClick={() => handleAdvanceTask(selectedTask.id)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Advance next step"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Advance</span>
                </button>
              )}
            </div>
          </div>

          {/* Mission Control Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 no-scrollbar">
            {/* Create Task Drawer / Card */}
            {isCreatingTask && (
              <div className="p-4 bg-white rounded-xl border border-[#E5E0D8] shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#EA580C]" />
                    <h3 className="text-xs font-bold text-slate-900">Define Autonomous Goal</h3>
                  </div>
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
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EA580C] bg-slate-50/50"
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
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#EA580C] bg-slate-50/50"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsCreatingTask(false)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-3.5 py-1 text-xs font-bold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-lg shadow-2xs"
                    >
                      {isSubmitting ? 'Planning...' : 'Plan Task'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {selectedTask ? (
              <div className="space-y-3">
                {/* Active Goal Context Card */}
                <div className="p-3.5 bg-white rounded-xl border border-[#EAE6DF] shadow-2xs">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-xs font-bold text-slate-900 leading-snug">{selectedTask.title}</h3>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded capitalize shrink-0 font-bold ${
                        selectedTask.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : selectedTask.status === 'awaiting_approval'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                          : selectedTask.status === 'failed'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {selectedTask.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{selectedTask.goal}</p>

                  {selectedTask.summary && (
                    <div className="mt-2.5 p-2 bg-emerald-50 rounded-lg border border-emerald-200/80 text-[11px] text-emerald-900">
                      <div className="font-bold flex items-center gap-1 mb-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Execution Complete</span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-emerald-800">{selectedTask.summary}</p>
                    </div>
                  )}
                </div>

                {/* Mode B: Plan Review Approval Banner (Claude Callout Style) */}
                {(workspace?.permissionMode || 'approve_plan') === 'approve_plan' &&
                  !selectedTask.isPlanApproved &&
                  selectedTask.status !== 'completed' &&
                  selectedTask.status !== 'cancelled' && (
                    <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs shadow-2xs space-y-2.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-950">
                        <ShieldAlert className="w-4 h-4 text-[#D97706]" />
                        <span>Mode B: Complete Plan Review Required</span>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        Review all planned file operations and commands. Once approved, the agent will execute the plan automatically.
                      </p>

                      {/* Planned Files Preview with Click-to-Inspect in Canvas */}
                      {selectedTask.plannedFiles && selectedTask.plannedFiles.length > 0 && (
                        <div className="p-2.5 bg-amber-100/70 rounded-lg border border-amber-200">
                          <span className="text-[10px] font-bold text-amber-950 block mb-1.5">
                            Target Files ({selectedTask.plannedFiles.length}) — click to view:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedTask.plannedFiles.map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => handleSelectFile(f)}
                                className="px-2 py-0.5 rounded-md bg-white hover:bg-amber-50 text-amber-900 font-mono text-[10px] border border-amber-300 font-semibold shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                                title="Inspect in Canvas"
                              >
                                <Eye className="w-2.5 h-2.5 text-amber-600" />
                                <span>{f}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleApprovePlan(selectedTask.id)}
                          className="px-3.5 py-1.5 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-lg shadow-2xs cursor-pointer text-xs transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Change Plan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectPlan(selectedTask.id)}
                          className="px-2.5 py-1.5 text-amber-900 hover:bg-amber-100/80 rounded-lg cursor-pointer text-xs transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                {/* Plan Steps Timeline */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Implementation Plan ({selectedTask.steps.length} steps)
                    </span>
                  </div>

                  <div className="relative pl-5 space-y-2.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5E0D8]">
                    {selectedTask.steps.map((step, idx) => (
                      <div key={step.id} className="relative">
                        {/* Timeline Status Dot */}
                        <div className="absolute -left-5 top-2.5 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                          {step.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                          ) : step.status === 'awaiting_approval' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-600 fill-amber-100 animate-pulse" />
                          ) : step.status === 'running' ? (
                            <RefreshCw className="w-3.5 h-3.5 text-[#EA580C] animate-spin" />
                          ) : (
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                          )}
                        </div>

                        {/* Step Card */}
                        <div
                          className={`p-3 rounded-xl border text-xs transition-all ${
                            step.status === 'completed'
                              ? 'bg-white border-emerald-200/80 shadow-2xs'
                              : step.status === 'awaiting_approval'
                              ? 'bg-[#FFFBEB] border-amber-300 shadow-xs'
                              : step.status === 'running'
                              ? 'bg-white border-[#EA580C] shadow-xs'
                              : 'bg-white/80 border-[#E5E0D8]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-slate-900 truncate">
                              {idx + 1}. {step.title}
                            </span>
                            {step.operation && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                                  step.operation === 'create'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : step.operation === 'edit'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                    : step.operation === 'delete'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : step.operation === 'command'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                    : 'bg-slate-100 text-slate-700 border border-slate-300'
                                }`}
                              >
                                {step.operation}
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-500 leading-tight mb-2">
                            {step.description}
                          </p>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {step.targetPath && (
                              <button
                                type="button"
                                onClick={() => handleSelectFile(step.targetPath!)}
                                className="text-[10px] font-mono text-slate-700 hover:text-[#EA580C] bg-slate-100 hover:bg-[#FFF7ED] px-1.5 py-0.5 rounded border border-slate-200 hover:border-[#FED7AA] truncate max-w-[180px] flex items-center gap-1 cursor-pointer transition-colors"
                                title="Open file in Canvas"
                              >
                                <Eye className="w-2.5 h-2.5" />
                                <span>{step.targetPath}</span>
                              </button>
                            )}
                            {step.tool && (
                              <span className="text-[10px] font-mono text-slate-400">
                                tool: <span className="text-[#EA580C] font-semibold">{step.tool}</span>
                              </span>
                            )}
                            {step.status === 'completed' && (
                              <span className="ml-auto inline-flex items-center gap-0.5 text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded text-[9px] border border-emerald-200 shrink-0">
                                <Check className="w-2.5 h-2.5" /> Verified
                              </span>
                            )}
                          </div>

                          {/* Mode A: Individual Step Approval Gate */}
                          {step.requiresApproval && !step.isApproved && step.status === 'awaiting_approval' && (
                            <div className="mt-2.5 p-2.5 bg-amber-100/70 border border-amber-300 rounded-lg text-amber-950 text-[11px] space-y-1.5">
                              <div className="flex items-center gap-1 font-bold">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                                <span>Human Approval Required</span>
                              </div>
                              <p className="text-[10px] leading-relaxed text-amber-800">
                                This action modifies repository state or runs commands. Confirm execution?
                              </p>
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleApproveStep(selectedTask.id, step.id)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-md shadow-2xs cursor-pointer"
                                >
                                  Approve & Run
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectStep(selectedTask.id, step.id)}
                                  className="px-2 py-1 text-[11px] text-amber-900 hover:bg-amber-200/80 rounded-md cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                <Sparkles className="w-6 h-6 text-[#EA580C]/40 mx-auto" />
                <p className="font-semibold text-slate-600">No active autonomous task selected</p>
                <p className="text-[11px]">Type an instruction below or click "New Goal" above.</p>
              </div>
            )}
          </div>

          {/* Integrated Co-Work Prompt Composer (Claude Cowork / ChatGPT Canvas style) */}
          <div className="p-3 bg-white border-t border-[#EBE7DF] shrink-0 space-y-2">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {['Run test suite', 'Fix linter errors', 'Explain code', 'Check git status'].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setInlinePrompt(suggestion);
                    handleInlinePromptSubmit(suggestion);
                  }}
                  className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-[#FFF7ED] hover:text-[#EA580C] border border-slate-200 hover:border-[#FED7AA] text-[10px] text-slate-600 font-medium whitespace-nowrap cursor-pointer transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleInlinePromptSubmit();
              }}
              className="flex items-center gap-1.5 bg-[#FAF8F5] border border-[#E5E0D8] focus-within:border-[#EA580C] rounded-xl p-1.5 transition-all shadow-2xs"
            >
              <textarea
                value={inlinePrompt}
                onChange={(e) => setInlinePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleInlinePromptSubmit();
                  }
                }}
                rows={1}
                placeholder="Instruct Cortex to add features, refactor code, or run commands..."
                className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none px-2 py-1 leading-relaxed max-h-24"
              />
              <button
                type="submit"
                disabled={isInlineSubmitting || !inlinePrompt.trim()}
                className="p-1.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-40 text-white cursor-pointer transition-colors shrink-0"
                title="Send instruction to Cortex"
              >
                {isInlineSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Pane: Code & Diff Canvas with Collapsible Accessories (55-58% width) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Canvas Top Bar */}
          <div className="h-11 border-b border-[#EBE7DF] bg-[#FAF8F5] px-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {/* Toggle Files Drawer Button */}
              <button
                type="button"
                onClick={() => setIsExplorerOpen(!isExplorerOpen)}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  isExplorerOpen
                    ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#EA580C]'
                    : 'bg-white border-[#E5E0D8] text-slate-600 hover:bg-slate-50'
                }`}
                title={isExplorerOpen ? 'Hide file tree' : 'Show file tree'}
              >
                {isExplorerOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
                <span className="text-[11px]">Files</span>
              </button>

              {/* Active File Tab */}
              {selectedFilePath && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E5E0D8] text-xs font-mono text-slate-800 shadow-2xs">
                  <FileCode className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span className="font-bold truncate max-w-[200px]">{pathBasename(selectedFilePath)}</span>
                  {editedFileContent !== selectedFileContent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Unsaved changes" />
                  )}
                </div>
              )}

              {/* View Mode Segment Pills */}
              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600">
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

            {/* Right Actions: Save File & Toggle Terminal */}
            <div className="flex items-center gap-2">
              {rightViewMode === 'editor' && selectedFilePath && (
                <button
                  onClick={handleSaveFile}
                  disabled={isSavingFile || editedFileContent === selectedFileContent}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingFile ? 'Saving...' : 'Save File'}</span>
                </button>
              )}

              {/* Terminal Toggle Button */}
              <button
                type="button"
                onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                  isTerminalOpen
                    ? 'bg-slate-900 text-emerald-400 border-slate-950 shadow-2xs'
                    : 'bg-white border-[#E5E0D8] text-slate-700 hover:bg-slate-50'
                }`}
                title={isTerminalOpen ? 'Hide Terminal drawer' : 'Open Terminal drawer'}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-sans font-semibold">Terminal</span>
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

          {/* Canvas Main Body: Sliding File Explorer + Editor / Diff Area */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Sliding File Explorer Drawer */}
            {isExplorerOpen && (
              <div className="w-60 border-r border-[#EBE7DF] bg-[#FAF8F5] flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-left-4 duration-150">
                <div className="p-2.5 border-b border-[#EBE7DF] flex items-center justify-between bg-[#FCFAF7]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Project Explorer
                  </span>
                  <button
                    onClick={loadProjectTree}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded"
                    title="Refresh files"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
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

            {/* Code Editor / Diff / Artifacts Content View */}
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
                        Select a file from the Project Explorer, click a planned file from the Agent Plan, or submit an autonomous goal to begin editing.
                      </p>
                    </div>
                  </div>
                )
              ) : rightViewMode === 'diff' ? (
                <div className="h-full overflow-y-auto p-4 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-900">Repository Changes & Diff</h3>
                    {gitStatus?.isGit && (
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        branch: {gitStatus.branch || 'main'}
                      </span>
                    )}
                  </div>

                  {gitStatus?.modified && gitStatus.modified.length > 0 ? (
                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 font-mono text-xs space-y-2">
                      <div className="font-bold text-amber-900">Modified Files ({gitStatus.modified.length}):</div>
                      <div className="space-y-1">
                        {gitStatus.modified.map((m: string) => (
                          <div
                            key={m}
                            onClick={() => handleSelectFile(m)}
                            className="text-amber-800 hover:text-[#EA580C] hover:underline cursor-pointer flex items-center gap-1.5"
                          >
                            <span>•</span>
                            <span>{m}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 italic">
                      Working tree clean. No uncommitted modifications.
                    </div>
                  )}
                </div>
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
                    {artifacts.length === 0 && (
                      <div className="text-xs text-slate-400 py-8 text-center">No standalone artifacts created.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Bottom Terminal Drawer */}
          {isTerminalOpen && (
            <div className="h-56 border-t border-slate-800 bg-[#16161E] text-slate-200 flex flex-col shrink-0 animate-in slide-in-from-bottom-6 duration-150">
              {/* Terminal Top Bar */}
              <div className="px-3 py-1.5 bg-[#1F1F2E] border-b border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold text-slate-200">Workspace Terminal</span>
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

                {/* Quick Command Pills */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExecuteTerminal('npm test')}
                    disabled={isExecutingCommand}
                    className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer transition-colors"
                  >
                    npm test
                  </button>
                  <button
                    onClick={() => handleExecuteTerminal('npm run lint')}
                    disabled={isExecutingCommand}
                    className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer transition-colors"
                  >
                    npm run lint
                  </button>
                  <button
                    onClick={() => handleExecuteTerminal('git status')}
                    disabled={isExecutingCommand}
                    className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer transition-colors"
                  >
                    git status
                  </button>
                  <button
                    onClick={() => setTerminalOutput(null)}
                    className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Clear output"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setIsTerminalOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Minimize terminal"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Terminal Body */}
              <div className="flex-1 p-3 font-mono text-xs overflow-y-auto no-scrollbar space-y-1">
                {isExecutingCommand && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Executing command in workspace root...</span>
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
                    Run authorized development commands (npm test, npm run lint, git status) in authorized workspace root.
                  </div>
                )}
              </div>

              {/* Terminal Input Bar */}
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
                  className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded cursor-pointer transition-colors"
                >
                  Run
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function pathBasename(p: string): string {
  const parts = p.split(/[\/\\]/);
  return parts[parts.length - 1] || p;
}
