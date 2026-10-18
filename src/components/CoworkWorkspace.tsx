import React, { useState, useEffect, useRef } from 'react';
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
  FolderUp,
  UploadCloud,
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
  PanelRight,
  PanelRightClose,
  ListTodo,
  ChevronUp,
  Sparkles,
  BarChart3,
  Monitor,
  Sunrise,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { AgentTask, Workspace, WorkspaceArtifact, WorkspaceFileNode, ExecutionCommandResult } from '../server/types';
import { fetchGraphQL, advanceTaskApi } from '../lib/api';

interface CoworkWorkspaceProps {
  workspace: Workspace | null;
  onRefreshWorkspace: () => void;
  onSelectWorkspace?: (ws: Workspace) => void;
  onDeleteWorkspace?: (id: string) => void;
}

export const CoworkWorkspace: React.FC<CoworkWorkspaceProps> = ({
  workspace,
  onRefreshWorkspace,
  onSelectWorkspace,
  onDeleteWorkspace,
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

  // Responsive drawer overlay state for smaller viewports
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isSidecarOpen, setIsSidecarOpen] = useState(false);

  // Canvas drawer & inline prompt state (Claude Cowork / ChatGPT Canvas layout)
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [inlinePrompt, setInlinePrompt] = useState('');
  const [isInlineSubmitting, setIsInlineSubmitting] = useState(false);

  // Right Sidecar widgets state (Claude Cowork Image 3 layout)
  const [isProgressOpen, setIsProgressOpen] = useState(true);
  const [isArtifactsOpen, setIsArtifactsOpen] = useState(true);
  const [isContextOpen, setIsContextOpen] = useState(true);

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
  const [pickedFiles, setPickedFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [pickedFolderName, setPickedFolderName] = useState('');
  const [isReadingFolder, setIsReadingFolder] = useState(false);
  const [isSyncingFiles, setIsSyncingFiles] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const syncFolderInputRef = useRef<HTMLInputElement>(null);

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

  // Browse and read folder directly from user's disk
  const handlePickFolderFromDisk = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        setIsReadingFolder(true);
        const files: Array<{ path: string; content: string }> = [];

        async function readDir(handle: any, currentPath = '') {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              if (
                /\.(png|jpe?g|gif|ico|webp|svg|mp4|zip|tar|gz|pdf|exe|dll|dylib|so|lock)$/i.test(entry.name) ||
                entry.name === 'package-lock.json' ||
                entry.name === 'yarn.lock' ||
                entry.name === 'pnpm-lock.yaml'
              ) {
                continue;
              }
              try {
                const file = await entry.getFile();
                if (file.size > 2 * 1024 * 1024) continue;
                const content = await file.text();
                const relPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                files.push({ path: relPath, content });
              } catch (e) {
                console.warn('Failed to read file:', entry.name, e);
              }
            } else if (entry.kind === 'directory') {
              if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'].includes(entry.name)) {
                continue;
              }
              const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
              await readDir(entry, nextPath);
            }
          }
        }

        await readDir(dirHandle);
        setPickedFolderName(dirHandle.name);
        setPickedFiles(files);
        setLocalWorkspaceName(dirHandle.name);
        setLocalFolderPath(dirHandle.name);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Directory picker failed, falling back to input:', err);
          folderInputRef.current?.click();
        }
      } finally {
        setIsReadingFolder(false);
      }
    } else {
      folderInputRef.current?.click();
    }
  };

  // Fallback directory input handler
  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setIsReadingFolder(true);
    try {
      const files: Array<{ path: string; content: string }> = [];
      let detectedName = '';
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const relPath = file.webkitRelativePath || file.name;
        const segments = relPath.split('/');
        if (segments.length > 1 && !detectedName) {
          detectedName = segments[0];
        }
        if (segments.some((s) => ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'].includes(s))) {
          continue;
        }
        if (file.size > 2 * 1024 * 1024) continue;
        if (/\.(png|jpe?g|gif|ico|webp|svg|mp4|zip|tar|gz|pdf|exe|dll|dylib|so|lock)$/i.test(file.name)) {
          continue;
        }
        try {
          const content = await file.text();
          const cleanRelPath = segments.length > 1 ? segments.slice(1).join('/') : relPath;
          files.push({ path: cleanRelPath, content });
        } catch (err) {
          console.warn('Error reading file:', file.name, err);
        }
      }
      const folderName = detectedName || 'Local Project';
      setPickedFolderName(folderName);
      setPickedFiles(files);
      setLocalWorkspaceName(folderName);
      setLocalFolderPath(folderName);
    } finally {
      setIsReadingFolder(false);
    }
  };

  // Sync / Upload files into current workspace
  const handleSyncFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!workspace) return;
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setIsSyncingFiles(true);
    try {
      const files: Array<{ path: string; content: string }> = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const relPath = file.webkitRelativePath || file.name;
        const segments = relPath.split('/');
        if (segments.some((s) => ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'].includes(s))) {
          continue;
        }
        if (file.size > 2 * 1024 * 1024) continue;
        if (/\.(png|jpe?g|gif|ico|webp|svg|mp4|zip|tar|gz|pdf|exe|dll|dylib|so|lock)$/i.test(file.name)) {
          continue;
        }
        try {
          const content = await file.text();
          const cleanRelPath = segments.length > 1 ? segments.slice(1).join('/') : relPath;
          files.push({ path: cleanRelPath, content });
        } catch (err) {
          console.warn('Error reading file for sync:', file.name, err);
        }
      }

      if (files.length > 0) {
        const res = await fetch(`/api/cowork/workspaces/${workspace.id}/sync-files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files }),
        });
        const data = await res.json();
        if (data.success) {
          alert(`Successfully synced ${data.syncedCount} file(s) into workspace!`);
          await loadProjectTree();
        } else {
          alert(data.error || 'Failed to sync files.');
        }
      }
    } catch (err: any) {
      alert(`Error syncing files: ${err.message}`);
    } finally {
      setIsSyncingFiles(false);
    }
  };

  // Bind local project folder or import picked files
  const handleBindLocalFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!localFolderPath.trim() && pickedFiles.length === 0) || isBindingSubmitting) return;
    setIsBindingSubmitting(true);
    try {
      let res: Response;
      if (pickedFiles.length > 0) {
        res = await fetch('/api/cowork/workspaces/import-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: localWorkspaceName.trim() || pickedFolderName || 'Local Project',
            folderName: pickedFolderName,
            originalPath: localFolderPath.trim() || pickedFolderName,
            files: pickedFiles,
          }),
        });
      } else {
        res = await fetch('/api/cowork/workspaces/bind-local', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderPath: localFolderPath.trim(),
            name: localWorkspaceName.trim() || undefined,
          }),
        });
      }
      const data = await res.json();
      if (data.success) {
        setIsBindingLocal(false);
        setLocalFolderPath('');
        setLocalWorkspaceName('');
        setPickedFiles([]);
        setPickedFolderName('');
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
      <div className="min-h-13 py-2 px-3 sm:px-4 border-b border-[#EBE7DF] flex items-center justify-between gap-2 bg-[#FCFAF7] shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsTasksOpen(!isTasksOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isTasksOpen
                ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#EA580C]'
                : 'bg-white border-[#E5E0D8] text-slate-600 hover:bg-slate-50'
            }`}
            title={isTasksOpen ? 'Hide tasks panel' : 'Show tasks panel'}
          >
            {isTasksOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Tasks</span>
            {tasks.length > 0 && <span className="text-[10px] opacity-75 font-mono">({tasks.length})</span>}
          </button>

          <div className="w-8 h-8 rounded-xl bg-[#FFF7ED] border border-[#FEE5D2] flex items-center justify-center text-[#EA580C] shadow-2xs shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900 tracking-tight truncate max-w-[120px] sm:max-w-[200px]">
                {workspace?.name || 'Primary Workspace'}
              </h2>
              {availableWorkspaces.length > 1 && (
                <div className="flex items-center gap-1 shrink-0">
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
                  {workspace && onDeleteWorkspace && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete workspace "${workspace.name}"?`)) {
                          onDeleteWorkspace(workspace.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title="Delete this workspace"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5 overflow-hidden">
              <span className="truncate max-w-[120px] sm:max-w-[200px]" title={workspace?.projectRoot}>
                {workspace?.projectRoot || 'workspaces/' + (workspace?.id || '')}
              </span>
              {gitStatus?.isGit && (
                <span className="hidden sm:inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-sans font-semibold shrink-0">
                  <GitBranch className="w-2.5 h-2.5" />
                  {gitStatus.branch || 'main'}
                </span>
              )}
              {projectStack && (
                <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#FFF7ED] text-[#9A3412] font-sans text-[10px] font-semibold border border-[#FED7AA] shrink-0">
                  {projectStack.framework}
                  {projectStack.hasTests && ' · Tests'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => {
              loadWorkspaces();
              setIsBindingLocal(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[#E5E0D8] rounded-xl transition-colors cursor-pointer shadow-2xs"
            title="Bind local project folder"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Open Folder</span>
          </button>
          <button
            onClick={() => {
              loadWorkspaceData();
              loadProjectTree();
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-[#E5E0D8] rounded-xl transition-colors cursor-pointer shadow-2xs"
            title="Refresh repository and tasks"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Sync</span>
          </button>
          <button
            onClick={() => setIsCreatingTask(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Goal</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSidecarOpen(!isSidecarOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isSidecarOpen
                ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#EA580C]'
                : 'bg-white border-[#E5E0D8] text-slate-600 hover:bg-slate-50'
            }`}
            title={isSidecarOpen ? 'Hide sidecar panel' : 'Show sidecar panel'}
          >
            {isSidecarOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRight className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Sidecar</span>
          </button>
        </div>
      </div>

      {/* Bind Local Folder Modal */}
      {isBindingLocal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-[#EA580C]" />
                <h3 className="text-sm font-bold text-slate-900">Select Local Project Folder</h3>
              </div>
              <button
                onClick={() => {
                  setIsBindingLocal(false);
                  setPickedFiles([]);
                  setPickedFolderName('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBindLocalFolder} className="p-5 space-y-4">
              {/* Option 1: Native Folder Picker / Upload */}
              <div className="p-4 rounded-xl border border-dashed border-[#FED7AA] bg-[#FFFBF7] flex flex-col items-center justify-center text-center space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#EA580C]">
                  {isReadingFolder ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <FolderUp className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Choose Folder from your Computer
                  </div>
                  <div className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                    Select a local project folder directly (e.g. your portfolio or React app) to authorize and sync into the workspace.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePickFolderFromDisk}
                  disabled={isReadingFolder}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer hover:border-[#EA580C]"
                >
                  <FolderOpen className="w-4 h-4 text-[#EA580C]" />
                  <span>{isReadingFolder ? 'Reading Folder...' : 'Browse Local Folder'}</span>
                </button>

                <input
                  type="file"
                  ref={folderInputRef}
                  onChange={handleFolderInputChange}
                  className="hidden"
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  multiple
                />

                {pickedFiles.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Selected <strong>{pickedFolderName}</strong> ({pickedFiles.length} file{pickedFiles.length > 1 ? 's' : ''} ready)
                    </span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider absolute">
                  Or Enter Folder Path
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Local Folder Path {pickedFiles.length === 0 && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  required={pickedFiles.length === 0}
                  placeholder="e.g. D:\Portfoloi or /home/user/project"
                  value={localFolderPath}
                  onChange={(e) => {
                    setLocalFolderPath(e.target.value);
                    if (pickedFiles.length > 0) setPickedFiles([]);
                  }}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C] bg-slate-50/50"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter local path. On cloud environments, this initializes a managed workspace for your project.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Workspace Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Portfoloi"
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
                  onClick={() => {
                    setIsBindingLocal(false);
                    setPickedFiles([]);
                    setPickedFolderName('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBindingSubmitting || (!localFolderPath.trim() && pickedFiles.length === 0)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isBindingSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{pickedFiles.length > 0 ? 'Upload & Open Workspace' : 'Authorize & Open Workspace'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main 3-Panel Claude Cowork Body matching Image 3 */}
      <div className="flex-1 flex overflow-hidden bg-[#FAF8F5] relative">
        {/* Panel 1 (Left): Task List & New Task Button (Image 3 Left Panel) */}
        {isTasksOpen && (
          <div
            className="fixed inset-0 bg-black/25 backdrop-blur-2xs z-30 xl:hidden"
            onClick={() => setIsTasksOpen(false)}
          />
        )}
        <div
          className={`${
            isTasksOpen
              ? 'fixed inset-y-0 left-0 z-40 xl:static flex'
              : 'hidden xl:flex'
          } w-72 md:w-80 border-r border-[#EBE7DF] bg-[#FAF8F5] flex-col shrink-0 overflow-hidden shadow-xl xl:shadow-none animate-in slide-in-from-left duration-200`}
        >
              {/* + New task Button */}
              <div className="p-3 border-b border-[#EBE7DF] bg-[#FCFAF7] shrink-0 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(null);
                    setIsCreatingTask(false);
                    if (typeof window !== 'undefined' && window.innerWidth < 1280) setIsTasksOpen(false);
                  }}
                  className="flex-1 flex items-center gap-2 px-3 py-2 bg-white hover:bg-[#FFF7ED] text-slate-800 hover:text-[#EA580C] border border-[#E5E0D8] hover:border-[#FED7AA] rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer group"
                >
                  <div className="w-5 h-5 rounded-lg bg-slate-100 group-hover:bg-[#FFF7ED] flex items-center justify-center text-slate-600 group-hover:text-[#EA580C] transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <span>New task</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsTasksOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer xl:hidden"
                  title="Close tasks"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Task List Items */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
                {tasks.map((task) => {
                  const isSelected = selectedTaskId === task.id;
                  const completedCount = task.steps?.filter((s) => s.status === 'completed').length || 0;
                  const totalCount = task.steps?.length || 0;

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => {
                        setSelectedTaskId(task.id);
                        if (typeof window !== 'undefined' && window.innerWidth < 1280) setIsTasksOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl text-left transition-all cursor-pointer flex items-start justify-between gap-2 border ${
                        isSelected
                          ? 'bg-white border-[#E5E0D8] shadow-xs'
                          : 'hover:bg-white/70 border-transparent hover:border-[#E5E0D8]/60 text-slate-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-slate-900 truncate leading-tight">
                          {task.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                          {task.status === 'completed' ? (
                            <span className="text-emerald-700 font-sans font-medium">Finished · Verified</span>
                          ) : task.status === 'awaiting_approval' ? (
                            <span className="text-amber-700 font-sans font-semibold">Needs human approval</span>
                          ) : totalCount > 0 ? (
                            <span>Step {completedCount + 1} of {totalCount}</span>
                          ) : (
                            <span>Autonomous Task</span>
                          )}
                        </p>
                      </div>

                      {/* Status Indicator Dot matching Image 3 */}
                      <div className="shrink-0 mt-1">
                        {task.status === 'completed' ? (
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Completed" />
                        ) : task.status === 'awaiting_approval' ? (
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" title="Needs Approval" />
                        ) : task.status === 'running' ? (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#EA580C] animate-ping" title="Running" />
                        ) : (
                          <div className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" title="Ready" />
                        )}
                      </div>
                    </button>
                  );
                })}

                {tasks.length === 0 && (
                  <div className="py-12 text-center text-xs text-slate-400 italic">
                    No tasks yet. Click "+ New task" above.
                  </div>
                )}
              </div>

              {/* User profile footer matching Image 3 bottom */}
              <div className="p-3 border-t border-[#EBE7DF] bg-[#FCFAF7] flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-xs font-bold text-[#EA580C]">
                  C
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">Developer Workspace</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">{workspace?.name || 'Cortex AI'}</div>
                </div>
              </div>
            </div>

        {/* Panel 2 (Center): Workspace / Canvas (Image 3 Center Notebook) */}
        <div
          className="flex-1 min-w-0 flex flex-col overflow-y-auto relative bg-[#FAF8F5]"
          style={{
            backgroundImage: 'radial-gradient(#E8E3DA 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* When No Task is Selected: Hero "Let's knock something off your list" matching Image 3 */}
          {!selectedTask ? (
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 max-w-2xl mx-auto w-full my-auto animate-in fade-in duration-200">
              {/* Anthropic Terracotta Icon & Headline */}
              <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#EA580C] mb-4 shadow-xs">
                  <Sparkles className="w-6 h-6 fill-current" />
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-slate-800 tracking-tight text-center leading-snug">
                  Let's knock something off your list
                </h2>
              </div>

              {/* 6 Action Cards Grid (2 rows x 3 columns) matching Image 3 */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6 sm:mb-8">
                <button
                  type="button"
                  onClick={() => setInlinePrompt('Create a new file in workspace: ')}
                  className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
                >
                  <FileText className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-slate-800 block">Create a file</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInlinePrompt('Analyze codebase metrics, dependencies, and performance: ')}
                  className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
                >
                  <BarChart3 className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-slate-800 block">Crunch data</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInlinePrompt('Implement a working prototype for: ')}
                  className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
                >
                  <Monitor className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-slate-800 block">Make a prototype</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInlinePrompt('Summarize project health, open git changes, and run tests: ')}
                  className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
                >
                  <Sunrise className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-slate-800 block">Prep for the day</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInlinePrompt('Refactor and clean up repository directory structure: ')}
                  className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
                >
                  <Folder className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-slate-800 block">Organize files</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInlinePrompt('Run test suite and verify changes: ')}
                  className="p-3 rounded-xl bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] text-left transition-all shadow-2xs hover:shadow-xs cursor-pointer group"
                >
                  <MessageSquare className="w-4 h-4 text-slate-500 group-hover:text-[#EA580C] mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-slate-800 block">Send a message</span>
                </button>
              </div>

              {/* Floating Bottom Prompt Composer matching Image 3 */}
              <div className="w-full">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleInlinePromptSubmit();
                  }}
                  className="bg-white rounded-2xl border border-[#E5E0D8] focus-within:border-[#EA580C] p-3 shadow-md transition-all flex flex-col gap-2.5"
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
                    rows={2}
                    placeholder="Type a task here or use / for more tools"
                    className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none resize-none px-1 leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setIsExplorerOpen(!isExplorerOpen)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                        title="Attach file / browse workspace"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      {/* Mode Selector Pill in Prompt Composer */}
                      <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-[#E5E0D8] px-2.5 py-1 rounded-lg text-xs transition-colors shadow-2xs shrink-0">
                        <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <select
                          value={workspace?.permissionMode || 'approve_plan'}
                          onChange={(e) => handleUpdatePermissionMode(e.target.value)}
                          className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="approve_plan">Mode B: Approve Plan</option>
                          <option value="ask_every_change">Mode A: Ask Each Change</option>
                          <option value="session_edit">Mode C: Session Edit</option>
                        </select>
                      </div>

                      {/* Context Window Selector Pill in Prompt Composer */}
                      <div
                        className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-[#E5E0D8] px-2.5 py-1 rounded-lg text-xs transition-colors shadow-2xs shrink-0"
                        title={contextBudget ? `Effective limit: ${(contextBudget.effectiveLimit / 1024).toFixed(0)}K · Remaining: ${(contextBudget.remainingTokens / 1024).toFixed(1)}K` : undefined}
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <select
                          value={contextPreference}
                          onChange={(e) => handleChangeContextPreference(e.target.value)}
                          className="bg-transparent font-semibold text-slate-700 text-xs focus:outline-none cursor-pointer"
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
                          <span className="text-[10px] font-mono text-slate-500 border-l border-[#E5E0D8] pl-1.5 shrink-0">
                            {contextBudget.utilizationPercent}%
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isInlineSubmitting || !inlinePrompt.trim()}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-40 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      {isInlineSubmitting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <span>Start</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* When a Task is Active: The Interactive Code & Diff Canvas */
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              {/* Canvas Header */}
              <div className="h-11 border-b border-[#EBE7DF] bg-[#FAF8F5] px-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setIsExplorerOpen(!isExplorerOpen)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      isExplorerOpen
                        ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#EA580C]'
                        : 'bg-white border-[#E5E0D8] text-slate-600 hover:bg-slate-50'
                    }`}
                    title={isExplorerOpen ? 'Hide file tree' : 'Show file tree'}
                  >
                    {isExplorerOpen ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
                    <span className="text-[11px]">Files</span>
                  </button>

                  {selectedFilePath && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E5E0D8] text-xs font-mono text-slate-800 shadow-2xs">
                      <FileCode className="w-3.5 h-3.5 text-[#EA580C]" />
                      <span className="font-bold truncate max-w-[200px]">{pathBasename(selectedFilePath)}</span>
                      {editedFileContent !== selectedFileContent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Unsaved changes" />
                      )}
                    </div>
                  )}

                  {/* Mode Pills */}
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

              {/* Canvas Body */}
              <div className="flex-1 flex overflow-hidden relative">
                {isExplorerOpen && (
                  <div className="w-60 border-r border-[#EBE7DF] bg-[#FAF8F5] flex flex-col shrink-0 overflow-hidden">
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
                          onChange={handleSyncFolderInputChange}
                          className="hidden"
                          // @ts-ignore
                          webkitdirectory=""
                          directory=""
                          multiple
                        />
                        <button
                          onClick={loadProjectTree}
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

                {/* Main Canvas Editor Area */}
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
                            Click any planned file from the Progress panel on the right or explore project files to start editing.
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
                        if (e.key === 'Enter') handleExecuteTerminal();
                      }}
                      className="flex-1 bg-transparent text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel 3 (Right): Sidecar Widgets (Progress, Artifacts, Context) matching Image 3 */}
        {isSidecarOpen && (
          <div
            className="fixed inset-0 bg-black/25 backdrop-blur-2xs z-30 2xl:hidden"
            onClick={() => setIsSidecarOpen(false)}
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
                  onClick={() => setIsSidecarOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                  title="Close sidecar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Card 1: Progress (matching Image 3 top card) */}
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
                          onClick={() => handleAdvanceTask(selectedTask.id)}
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
                                  onClick={() => handleSelectFile(f)}
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
                              onClick={() => handleApprovePlan(selectedTask.id)}
                              className="px-2.5 py-1 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded text-[10px]"
                            >
                              Approve Plan
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectPlan(selectedTask.id)}
                              className="px-2 py-1 text-amber-900 hover:bg-amber-100 rounded text-[10px]"
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
                              onClick={() => handleSelectFile(step.targetPath!)}
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

          {/* Card 2: Artifacts (matching Image 3 middle card) */}
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
              </div>
            )}
          </div>

          {/* Card 3: Context (matching Image 3 bottom card) */}
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
                    onChange={(e) => handleChangeContextPreference(e.target.value)}
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
                    onChange={(e) => handleUpdatePermissionMode(e.target.value)}
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
        </div>
      </div>
    </div>
  );
};

function pathBasename(p: string): string {
  const parts = p.split(/[\/\\]/);
  return parts[parts.length - 1] || p;
}
