import React, { useState, useRef } from 'react';
import {
  X,
  Briefcase,
  FolderOpen,
  FolderUp,
  Plus,
  RefreshCw,
  CheckCircle2,
  HardDrive,
  Sparkles,
  LayoutTemplate,
  Code2,
} from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlank: (name: string, description: string) => Promise<void>;
  onImportLocalFolder: (
    name: string,
    folderName: string,
    files: Array<{ path: string; content: string }>,
    originalPath?: string
  ) => Promise<void>;
  onBindLocalPath: (folderPath: string, name?: string) => Promise<void>;
  onScaffoldTemplate?: (templateId: string, name?: string, description?: string) => Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateBlank,
  onImportLocalFolder,
  onBindLocalPath,
  onScaffoldTemplate,
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'templates' | 'blank'>('local');

  // Blank project state
  const [blankName, setBlankName] = useState('');
  const [blankDescription, setBlankDescription] = useState('');


  // Template scaffolding state
  const [selectedTemplate, setSelectedTemplate] = useState('react-vite-tailwind');
  const [templateProjectName, setTemplateProjectName] = useState('cortex-app');

  // Local folder binding state
  const [localFolderPath, setLocalFolderPath] = useState('');
  const [localProjectName, setLocalProjectName] = useState('');
  const [pickedFolderName, setPickedFolderName] = useState('');
  const [pickedFiles, setPickedFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [isReadingFolder, setIsReadingFolder] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Directory Picker from Browser
  const handlePickFolderFromDisk = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        setIsReadingFolder(true);
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        const files: Array<{ path: string; content: string }> = [];

        async function readDir(handle: any, currentPath = '') {
          for await (const entry of handle.values()) {
            if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', '.git', 'coverage'].includes(entry.name)) {
              continue;
            }
            const itemPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
            if (entry.kind === 'file') {
              if (/\.(png|jpe?g|gif|ico|webp|svg|mp4|zip|tar|gz|pdf|exe|dll|dylib|so|lock)$/i.test(entry.name)) {
                continue;
              }
              try {
                const file = await entry.getFile();
                if (file.size <= 2 * 1024 * 1024) {
                  const content = await file.text();
                  files.push({ path: itemPath, content });
                }
              } catch (err) {
                console.warn('Error reading file:', itemPath, err);
              }
            } else if (entry.kind === 'directory') {
              await readDir(entry, itemPath);
            }
          }
        }

        await readDir(dirHandle);
        setPickedFolderName(dirHandle.name);
        setPickedFiles(files);
        setLocalProjectName(dirHandle.name);
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

  // Directory input handler fallback
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
      setLocalProjectName(folderName);
      setLocalFolderPath(folderName);
    } finally {
      setIsReadingFolder(false);
    }
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
if (activeTab === 'templates' && onScaffoldTemplate) {
        await onScaffoldTemplate(selectedTemplate, templateProjectName.trim() || undefined);
      } else if (activeTab === 'local') {

        if (pickedFiles.length > 0) {
          await onImportLocalFolder(
            localProjectName.trim() || pickedFolderName || 'Local Project',
            pickedFolderName,
            pickedFiles,
            localFolderPath.trim() || pickedFolderName
          );
        } else if (localFolderPath.trim()) {
          await onBindLocalPath(localFolderPath.trim(), localProjectName.trim() || undefined);
        }
      } else {
        if (!blankName.trim()) return;
        await onCreateBlank(blankName.trim(), blankDescription.trim());
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to create or bind project:', err);
      alert(`Error: ${err.message || 'Operation failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-[#E5E0D8] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-[#FCFAF7] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#EA580C] shadow-2xs">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Select Project</h3>
              <p className="text-[11px] text-slate-500">Claude Cowork workspace for your code</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 shrink-0">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('local')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'local'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Select Local Project</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('blank')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'blank'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>New Blank Project</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 no-scrollbar">
          
          {activeTab === 'templates' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={templateProjectName}
                  onChange={(e) => setTemplateProjectName(e.target.value)}
                  placeholder="e.g. my-cortex-app"
                  className="w-full px-3 py-2 text-xs border border-[#E5E0D8] rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Starter Template
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {
                      id: 'react-vite-tailwind',
                      name: 'React 19 + Vite 6 + Tailwind',
                      badge: 'TypeScript / Frontend',
                      desc: 'Modern SPA with Vite 6, Tailwind CSS & Lucide icons',
                      iconBg: 'bg-cyan-50 border-cyan-200 text-cyan-600',
                    },
                    {
                      id: 'fastapi-python',
                      name: 'Python FastAPI + Pydantic v2',
                      badge: 'Python / API',
                      desc: 'Async REST API with automatic Swagger docs & Pytest',
                      iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
                    },
                    {
                      id: 'express-node',
                      name: 'Express 5 + TypeScript + Zod',
                      badge: 'Node.js / Backend',
                      desc: 'Type-safe REST API with Zod validation & Vitest',
                      iconBg: 'bg-amber-50 border-amber-200 text-amber-600',
                    },
                    {
                      id: 'go-gin',
                      name: 'Go 1.23 + Gin Framework',
                      badge: 'Go / Microservice',
                      desc: 'Ultra-fast HTTP microservice with clean architecture',
                      iconBg: 'bg-blue-50 border-blue-200 text-blue-600',
                    },
                    {
                      id: 'rust-axum',
                      name: 'Rust + Axum + Tokio',
                      badge: 'Rust / Systems',
                      desc: 'Memory-safe async service with Axum & Tokio runtime',
                      iconBg: 'bg-orange-50 border-orange-200 text-orange-600',
                    },
                  ].map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedTemplate === tpl.id
                          ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                          : 'border-[#E5E0D8] hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${tpl.iconBg}`}>
                          <Code2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{tpl.name}</span>
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {tpl.badge}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">{tpl.desc}</div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        checked={selectedTemplate === tpl.id}
                        onChange={() => setSelectedTemplate(tpl.id)}
                        className="accent-indigo-600 w-4 h-4"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'local' ? (
            <>
              {/* Option 1: Native Folder Picker */}
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
                    Choose Local Project Folder
                  </div>
                  <div className="text-[11px] text-slate-500 max-w-xs mt-0.5 leading-relaxed">
                    Select a local project folder from your computer to bind and pair-program with Cortex agent.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePickFolderFromDisk}
                  disabled={isReadingFolder}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-[#FFF7ED] border border-[#E5E0D8] hover:border-[#FED7AA] rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-[#EA580C]" />
                  <span>{isReadingFolder ? 'Scanning Files...' : 'Browse Local Folder'}</span>
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
                  Or Specify Path
                </span>
              </div>

              {/* Option 2: Direct Host Folder Path */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Local Folder Path
                  </label>
                  <input
                    type="text"
                    value={localFolderPath}
                    onChange={(e) => {
                      setLocalFolderPath(e.target.value);
                      if (!localProjectName && e.target.value) {
                        const parts = e.target.value.split(/[\/\\]/);
                        setLocalProjectName(parts[parts.length - 1] || '');
                      }
                    }}
                    placeholder="e.g. D:\Chat Application or C:\Users\dev\portfolio"
                    className="w-full px-3 py-2 text-xs border border-[#E5E0D8] rounded-xl focus:outline-none focus:border-[#EA580C] bg-slate-50/50 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Enter an existing folder path, or enter a new project name. Cortex will bind or create the project folder automatically.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Project Display Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={localProjectName}
                    onChange={(e) => setLocalProjectName(e.target.value)}
                    placeholder="e.g. Chat Application"
                    className="w-full px-3 py-2 text-xs border border-[#E5E0D8] rounded-xl focus:outline-none focus:border-[#EA580C] bg-slate-50/50"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Project Name <span className="text-[#EA580C]">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={blankName}
                  onChange={(e) => setBlankName(e.target.value)}
                  placeholder="e.g. Authentication Microservice"
                  className="w-full px-3 py-2 text-xs border border-[#E5E0D8] rounded-xl focus:outline-none focus:border-[#EA580C] bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={blankDescription}
                  onChange={(e) => setBlankDescription(e.target.value)}
                  placeholder="Describe the goals, tech stack, or architecture..."
                  className="w-full px-3 py-2 text-xs border border-[#E5E0D8] rounded-xl focus:outline-none focus:border-[#EA580C] bg-slate-50/50 resize-none leading-relaxed"
                />
              </div>
            </>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (activeTab === 'local' && !localFolderPath.trim() && pickedFiles.length === 0) ||
                (activeTab === 'blank' && !blankName.trim())
              }
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-40 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{activeTab === 'templates' ? 'Scaffold Project' : activeTab === 'local' ? 'Open Local Project' : 'Create Blank Project'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
