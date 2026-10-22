import React from 'react';
import { X, Download, Cpu, HardDrive, Terminal, Check } from 'lucide-react';

interface DesktopPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesktopPromoModal: React.FC<DesktopPromoModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="relative p-6 border-b border-slate-100 flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#EA580C] bg-orange-50 px-2 py-0.5 rounded-md">
              Desktop Edition
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-2">
              Cortex for Windows
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Optimized for Windows 10 & 11 (all editions)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Features */}
        <div className="p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-orange-50 text-[#EA580C] shrink-0 mt-0.5">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Lightweight & Low Memory</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Uses ~35MB RAM. Runs smoothly on 4GB RAM low-end laptops up to high-end workstations.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0 mt-0.5">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Direct Disk Access</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Bind local project folders directly on your drive without upload limits or cloud delays.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Native Terminal Execution</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Run PowerShell, Python, Pip, Node, and Git commands natively on your machine.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Close
          </button>
          <a
            href="https://github.com/Jay-Raam/Cortex/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#EA580C] hover:bg-[#D94F04] text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .exe</span>
          </a>
        </div>
      </div>
    </div>
  );
};
