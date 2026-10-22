import React from 'react';
import { GitBranch, FileCode, Check } from 'lucide-react';

interface UnifiedDiffViewerProps {
  gitStatus: any;
  onSelectFile: (filePath: string) => void;
}

export const UnifiedDiffViewer: React.FC<UnifiedDiffViewerProps> = ({ gitStatus, onSelectFile }) => {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-bold text-slate-900">Repository Changes & Diff</h3>
          <p className="text-[11px] text-slate-500">Review staged, modified, and working tree files</p>
        </div>
        {gitStatus?.isGit && (
          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
            <GitBranch className="w-3 h-3" />
            <span>branch: {gitStatus.branch || 'main'}</span>
          </span>
        )}
      </div>

      {gitStatus?.modified && gitStatus.modified.length > 0 ? (
        <div className="space-y-3">
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 font-mono text-xs space-y-2">
            <div className="font-bold text-amber-900 flex items-center gap-1.5 font-sans">
              <FileCode className="w-4 h-4 text-amber-700" />
              <span>Modified Files ({gitStatus.modified.length}):</span>
            </div>
            <div className="space-y-1 pl-1">
              {gitStatus.modified.map((m: string) => (
                <div
                  key={m}
                  onClick={() => onSelectFile(m)}
                  className="text-amber-800 hover:text-[#EA580C] hover:underline cursor-pointer flex items-center justify-between py-1 px-2 rounded hover:bg-amber-100/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>{m}</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold text-amber-700 font-sans">Click to inspect</span>
                </div>
              ))}
            </div>
          </div>

          {/* GitHub / Claude style diff preview container */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
            <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-xs font-mono font-bold text-slate-700 flex items-center justify-between">
              <span>Unified Diff Preview</span>
              <span className="text-[10px] text-slate-400 font-sans font-normal">Git status preview</span>
            </div>
            <div className="p-3 font-mono text-xs space-y-1 bg-slate-900 text-slate-100 overflow-x-auto">
              <div className="text-cyan-400 text-[11px]">@@ -1,15 +1,18 @@ Working Tree Modifications</div>
              {gitStatus.modified.map((file: string, index: number) => (
                <div key={file} className="space-y-0.5 pt-1">
                  <div className="text-slate-400">--- a/{file}</div>
                  <div className="text-slate-400">+++ b/{file}</div>
                  <div className="bg-emerald-950/50 text-emerald-300 px-1 rounded flex items-center gap-2">
                    <span className="select-none text-emerald-500">+</span>
                    <span>// Modified on disk · {file}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500 space-y-2">
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Check className="w-4 h-4" />
          </div>
          <div className="font-semibold text-slate-700">Working tree clean</div>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            No uncommitted modifications detected. As the agent plans and writes code, patches will render here.
          </p>
        </div>
      )}
    </div>
  );
};
