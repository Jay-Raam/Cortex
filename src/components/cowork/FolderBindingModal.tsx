import React, { useState } from 'react';
import {
  FolderOpen,
  FolderUp,
  RefreshCw,
  CheckCircle2,
  Check,
  X,
  Github,
  GitBranch,
  ArrowRight,
  Sparkles,
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
  onImportGitHub,
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'github'>('local');
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [githubWsName, setGithubWsName] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGitHubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubRepoUrl.trim() || isCloning) return;
    setIsCloning(true);
    setCloneError(null);
    try {
      if (onImportGitHub) {
        await onImportGitHub({
          repoUrl: githubRepoUrl.trim(),
          branch: githubBranch.trim() || 'main',
          name: githubWsName.trim() || undefined,
        });
      }
    } catch (err: any) {
      setCloneError(err.message || 'Failed to clone repository');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#EA580C]">
              {activeTab === 'local' ? <FolderOpen className="w-4 h-4" /> : <Github className="w-4 h-4" />}
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {activeTab === 'local' ? 'Import Local Project' : 'Import GitHub Repository'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'local'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>Local Folder</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'github'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Github className="w-3.5 h-3.5 text-slate-900" />
            <span>GitHub Repository</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full">
              New
            </span>
          </button>
        </div>

        {/* Tab 1: Local Folder */}
        {activeTab === 'local' && (
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
                placeholder="e.g. D:\Portfolio or /home/user/project"
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
                placeholder="e.g. Portfolio"
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
        )}

        {/* Tab 2: GitHub Repository */}
        {activeTab === 'github' && (
          <form onSubmit={handleGitHubSubmit} className="p-5 space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Github className="w-4 h-4 text-slate-800" />
                <span>Clone & Bind Direct GitHub Repo</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Import any public or private repository from GitHub. The AI agent will inspect the project, execute tasks, and open Pull Requests directly back to your repo!
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                GitHub Repository URL or Slug <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Jay-Raam/Smart-ERP or https://github.com/Jay-Raam/Smart-ERP"
                  value={githubRepoUrl}
                  onChange={(e) => setGithubRepoUrl(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C] bg-white"
                />
                <Github className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                <span>Quick suggestions:</span>
                <button
                  type="button"
                  onClick={() => {
                    setGithubRepoUrl('Jay-Raam/Smart-ERP');
                    setGithubWsName('Smart-ERP');
                  }}
                  className="text-[#EA580C] hover:underline font-semibold cursor-pointer"
                >
                  Jay-Raam/Smart-ERP
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => {
                    setGithubRepoUrl('Jay-Raam/Cortex');
                    setGithubWsName('Cortex');
                  }}
                  className="text-[#EA580C] hover:underline font-semibold cursor-pointer"
                >
                  Jay-Raam/Cortex
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                  <span>Branch (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Workspace Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Smart ERP Workspace"
                  value={githubWsName}
                  onChange={(e) => setGithubWsName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-[#EA580C]"
                />
              </div>
            </div>

            {cloneError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {cloneError}
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
                disabled={isCloning || !githubRepoUrl.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isCloning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cloning Repository...</span>
                  </>
                ) : (
                  <>
                    <Github className="w-3.5 h-3.5" />
                    <span>Clone & Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
