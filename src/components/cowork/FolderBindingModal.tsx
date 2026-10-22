import React from 'react';
import {
  FolderOpen,
  FolderUp,
  RefreshCw,
  CheckCircle2,
  Check,
  X,
} from 'lucide-react';
import { FolderBindingModalProps } from './types';

export const FolderBindingModal: React.FC<FolderBindingModalProps> = ({
  isOpen,
  onClose,
  localFolderPath,
  setLocalFolderPath,
  localWorkspaceName,
  setLocalWorkspaceName,
  availableWorkspaces,
  isBindingSubmitting,
  isReadingFolder,
  pickedFiles,
  pickedFolderName,
  onPickFolderFromDisk,
  onFolderInputChange,
  onSubmit,
  folderInputRef,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#EA580C]" />
            <h3 className="text-sm font-bold text-slate-900">Select Local Project Folder</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
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
              onClick={onPickFolderFromDisk}
              disabled={isReadingFolder}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer hover:border-[#EA580C]"
            >
              <FolderOpen className="w-4 h-4 text-[#EA580C]" />
              <span>{isReadingFolder ? 'Reading Folder...' : 'Browse Local Folder'}</span>
            </button>

            <input
              type="file"
              ref={folderInputRef as any}
              onChange={onFolderInputChange}
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
              onChange={(e) => setLocalFolderPath(e.target.value)}
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
              onClick={onClose}
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
  );
};
