import React from 'react';
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
}) => {
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
              onClick={onSaveFile}
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
  );
};
