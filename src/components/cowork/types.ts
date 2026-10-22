import { AgentTask, Workspace, WorkspaceArtifact, WorkspaceFileNode, ExecutionCommandResult } from '../../server/types';

export interface CoworkWorkspaceProps {
  workspace: Workspace | null;
  onRefreshWorkspace: () => void;
  onSelectWorkspace?: (ws: Workspace) => void;
  onDeleteWorkspace?: (id: string) => void;
  workspaces?: Workspace[];
  onNewWorkspace?: () => void;
}

export type RightViewMode = 'editor' | 'preview' | 'diff' | 'artifacts';

export interface CoworkTaskListProps {
  tasks: AgentTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onNewTaskClick: () => void;
  workspace: Workspace | null;
  isTasksOpen: boolean;
  onCloseTasks: () => void;
}

export interface CoworkHeroViewProps {
  workspace: Workspace | null;
  inlinePrompt: string;
  setInlinePrompt: (val: string) => void;
  isInlineSubmitting: boolean;
  onInlinePromptSubmit: (customPrompt?: string) => void;
  isExplorerOpen: boolean;
  setIsExplorerOpen: (val: boolean) => void;
  contextPreference: string;
  contextBudget: any;
  onChangeContextPreference: (pref: string) => void;
  onUpdatePermissionMode: (mode: string) => void;
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
  onToggleTasks?: () => void;
  tasksCount?: number;
}

export interface CoworkCanvasProps {
  workspace: Workspace | null;
  selectedTask: AgentTask;
  selectedFilePath: string | null;
  selectedFileContent: string;
  editedFileContent: string;
  setEditedFileContent: (val: string) => void;
  isSavingFile: boolean;
  onSaveFile: () => void;
  rightViewMode: RightViewMode;
  setRightViewMode: (mode: RightViewMode) => void;
  artifacts: WorkspaceArtifact[];
  isExplorerOpen: boolean;
  setIsExplorerOpen: (val: boolean) => void;
  fileTree: WorkspaceFileNode[];
  onSelectFile: (filePath: string) => void;
  fileSearchQuery: string;
  setFileSearchQuery: (val: string) => void;
  gitStatus: any;
  onLoadProjectTree: () => void;
  isSyncingFiles: boolean;
  onSyncFolderInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  syncFolderInputRef: React.RefObject<HTMLInputElement | null>;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (val: boolean) => void;
  terminalCommand: string;
  setTerminalCommand: (val: string) => void;
  isExecutingCommand: boolean;
  terminalOutput: ExecutionCommandResult | null;
  onExecuteTerminal: (cmd?: string) => void;
  onAdvanceTask: (taskId: string) => void;
  onApproveStep?: (taskId: string, stepId?: string, approvalId?: string) => void;
  onApprovePlan: (taskId: string) => void;
  onRejectPlan: (taskId: string) => void;
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
  inlinePrompt: string;
  setInlinePrompt: (val: string) => void;
  isInlineSubmitting: boolean;
  onInlinePromptSubmit: (customPrompt?: string) => void;
  onToggleTasks?: () => void;
}

export interface CoworkSidecarProps {
  workspace: Workspace | null;
  selectedTask?: AgentTask;
  artifacts: WorkspaceArtifact[];
  projectStack: any;
  gitStatus: any;
  contextPreference: string;
  contextBudget: any;
  isSidecarOpen: boolean;
  onCloseSidecar: () => void;
  onAdvanceTask: (taskId: string) => void;
  onApproveStep?: (taskId: string, stepId?: string, approvalId?: string) => void;
  onApprovePlan: (taskId: string) => void;
  onRejectPlan: (taskId: string) => void;
  onSelectFile: (filePath: string) => void;
  onChangeContextPreference: (pref: string) => void;
  onUpdatePermissionMode: (mode: string) => void;
}

export interface FolderBindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  localFolderPath: string;
  setLocalFolderPath: (val: string) => void;
  localWorkspaceName: string;
  setLocalWorkspaceName: (val: string) => void;
  availableWorkspaces: Workspace[];
  isBindingSubmitting: boolean;
  isReadingFolder: boolean;
  pickedFiles: Array<{ path: string; content: string }>;
  pickedFolderName: string;
  onPickFolderFromDisk: () => void;
  onFolderInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
}
