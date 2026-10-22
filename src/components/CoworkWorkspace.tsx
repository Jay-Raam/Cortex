import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  Plus,
  RefreshCw,
  Trash2,
  X,
  FolderOpen,
  GitBranch,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
} from 'lucide-react';
import { AgentTask, Workspace, WorkspaceArtifact, WorkspaceFileNode, ExecutionCommandResult } from '../server/types';
import { fetchGraphQL, advanceTaskApi } from '../lib/api';
import { CoworkWorkspaceProps, RightViewMode } from './cowork/types';
import { CoworkTaskList } from './cowork/CoworkTaskList';
import { CoworkHeroView } from './cowork/CoworkHeroView';
import { CoworkCanvas } from './cowork/CoworkCanvas';
import { CoworkSidecar } from './cowork/CoworkSidecar';
import { FolderBindingModal } from './cowork/FolderBindingModal';

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

  // Right panel view mode: 'editor' | 'diff' | 'artifacts'
  const [rightViewMode, setRightViewMode] = useState<RightViewMode>('editor');

  // Responsive drawer overlay state for smaller viewports
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isSidecarOpen, setIsSidecarOpen] = useState(false);

  // Canvas drawer & inline prompt state
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [inlinePrompt, setInlinePrompt] = useState('');
  const [isInlineSubmitting, setIsInlineSubmitting] = useState(false);

  // Terminal state
  const [terminalCommand, setTerminalCommand] = useState('');
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<ExecutionCommandResult | null>(null);

  // Project stack & local folder binding state
  const [projectStack, setProjectStack] = useState<any>(null);
  const [isBindingLocal, setIsBindingLocal] = useState(false);
  const [localFolderPath, setLocalFolderPath] = useState('');
  const [localWorkspaceName, setLocalWorkspaceName] = useState('');
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([]);
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
        if (segments.some((s) => ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(s))) {
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

      {/* Main 3-Panel Claude Cowork Body */}
      <div className="flex-1 flex overflow-hidden bg-[#FAF8F5] relative">
        {/* Panel 1: Task List */}
        <CoworkTaskList
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={(id) => {
            setSelectedTaskId(id);
            if (typeof window !== 'undefined' && window.innerWidth < 1280) setIsTasksOpen(false);
          }}
          onNewTaskClick={() => {
            setSelectedTaskId(null);
            setIsCreatingTask(false);
            if (typeof window !== 'undefined' && window.innerWidth < 1280) setIsTasksOpen(false);
          }}
          workspace={workspace}
          isTasksOpen={isTasksOpen}
          onCloseTasks={() => setIsTasksOpen(false)}
        />

        {/* Panel 2: Center Canvas / Workspace Notebook */}
        <div
          className="flex-1 min-w-0 flex flex-col overflow-y-auto relative bg-[#FAF8F5]"
          style={{
            backgroundImage: 'radial-gradient(#E8E3DA 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {!selectedTask ? (
            <CoworkHeroView
              workspace={workspace}
              inlinePrompt={inlinePrompt}
              setInlinePrompt={setInlinePrompt}
              isInlineSubmitting={isInlineSubmitting}
              onInlinePromptSubmit={handleInlinePromptSubmit}
              isExplorerOpen={isExplorerOpen}
              setIsExplorerOpen={setIsExplorerOpen}
              contextPreference={contextPreference}
              contextBudget={contextBudget}
              onChangeContextPreference={handleChangeContextPreference}
              onUpdatePermissionMode={handleUpdatePermissionMode}
            />
          ) : (
            <CoworkCanvas
              workspace={workspace}
              selectedTask={selectedTask}
              selectedFilePath={selectedFilePath}
              selectedFileContent={selectedFileContent}
              editedFileContent={editedFileContent}
              setEditedFileContent={setEditedFileContent}
              isSavingFile={isSavingFile}
              onSaveFile={handleSaveFile}
              rightViewMode={rightViewMode}
              setRightViewMode={setRightViewMode}
              artifacts={artifacts}
              isExplorerOpen={isExplorerOpen}
              setIsExplorerOpen={setIsExplorerOpen}
              fileTree={fileTree}
              onSelectFile={handleSelectFile}
              fileSearchQuery={fileSearchQuery}
              setFileSearchQuery={setFileSearchQuery}
              gitStatus={gitStatus}
              onLoadProjectTree={loadProjectTree}
              isSyncingFiles={isSyncingFiles}
              onSyncFolderInputChange={handleSyncFolderInputChange}
              syncFolderInputRef={syncFolderInputRef}
              isTerminalOpen={isTerminalOpen}
              setIsTerminalOpen={setIsTerminalOpen}
              terminalCommand={terminalCommand}
              setTerminalCommand={setTerminalCommand}
              isExecutingCommand={isExecutingCommand}
              terminalOutput={terminalOutput}
              onExecuteTerminal={handleExecuteTerminal}
            />
          )}
        </div>

        {/* Panel 3: Right Sidecar Widgets */}
        <CoworkSidecar
          workspace={workspace}
          selectedTask={selectedTask}
          artifacts={artifacts}
          projectStack={projectStack}
          gitStatus={gitStatus}
          contextPreference={contextPreference}
          contextBudget={contextBudget}
          isSidecarOpen={isSidecarOpen}
          onCloseSidecar={() => setIsSidecarOpen(false)}
          onAdvanceTask={handleAdvanceTask}
          onApprovePlan={handleApprovePlan}
          onRejectPlan={handleRejectPlan}
          onSelectFile={handleSelectFile}
          onChangeContextPreference={handleChangeContextPreference}
          onUpdatePermissionMode={handleUpdatePermissionMode}
        />
      </div>

      {/* Bind Local Folder Modal */}
      <FolderBindingModal
        isOpen={isBindingLocal}
        onClose={() => {
          setIsBindingLocal(false);
          setPickedFiles([]);
          setPickedFolderName('');
        }}
        localFolderPath={localFolderPath}
        setLocalFolderPath={setLocalFolderPath}
        localWorkspaceName={localWorkspaceName}
        setLocalWorkspaceName={setLocalWorkspaceName}
        availableWorkspaces={availableWorkspaces}
        isBindingSubmitting={isBindingSubmitting}
        isReadingFolder={isReadingFolder}
        pickedFiles={pickedFiles}
        pickedFolderName={pickedFolderName}
        onPickFolderFromDisk={handlePickFolderFromDisk}
        onFolderInputChange={handleFolderInputChange}
        onSubmit={handleBindLocalFolder}
        folderInputRef={folderInputRef}
      />

      {/* New Task Goal Modal */}
      {isCreatingTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Define Autonomous Goal</h3>
              <button
                onClick={() => setIsCreatingTask(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Build dark mode toggle with Tailwind"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Goal Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe what needs to be implemented..."
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C] resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Constraints (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Do not touch database schema"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatingTask(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Launch Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
