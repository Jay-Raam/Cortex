import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Download,
  Copy,
  Check,
  Code2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { parseMermaid, renderDiagramToSvg } from './diagramParser';

interface DiagramVisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mermaidSource: string;
  title?: string;
}

export const DiagramVisualizerModal: React.FC<DiagramVisualizerModalProps> = ({
  isOpen,
  onClose,
  mermaidSource,
  title = 'System Architecture & Workflow Diagram',
}) => {
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showCode, setShowCode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Parse diagram and generate SVG markup
  const parsedDiagram = useMemo(() => {
    return parseMermaid(mermaidSource || 'graph TD\nStart --> Process --> Done');
  }, [mermaidSource]);

  const svgMarkup = useMemo(() => {
    return renderDiagramToSvg(parsedDiagram);
  }, [parsedDiagram]);

  // Reset zoom & pan on open
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))));
  const handleZoomOut = () => setScale((s) => Math.max(0.4, Number((s - 0.15).toFixed(2))));
  const handleResetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((s) => Math.min(2.5, Number((s + 0.08).toFixed(2))));
    } else {
      setScale((s) => Math.max(0.4, Number((s - 0.08).toFixed(2))));
    }
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Download SVG
  const handleDownloadSvg = () => {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortex-architecture-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download PNG (rasterize SVG to canvas)
  const handleDownloadPng = () => {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = parsedDiagram.width * 2; // 2x high-res
      canvas.height = parsedDiagram.height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.drawImage(image, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `cortex-diagram-${Date.now()}.png`;
        a.click();
      }
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

  // Copy Mermaid Source
  const handleCopySource = () => {
    navigator.clipboard.writeText(mermaidSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150 font-sans select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-[85vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <header className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#FF6B00]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-[#EA580C] uppercase tracking-wider">
                  Interactive Canvas
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Click &amp; drag to pan · Scroll to zoom · High-res export
              </p>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1.5">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 mr-2">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono font-bold text-slate-700 px-2 min-w-[48px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer ml-0.5"
                title="Reset to 100%"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* View Source Toggle */}
            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                showCode
                  ? 'bg-orange-50 border-orange-200 text-[#FF6B00]'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Toggle Raw Mermaid Source"
            >
              <Code2 className="w-4 h-4" />
            </button>

            {/* Export SVG */}
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              title="Download standalone vector SVG"
            >
              <Download className="w-3.5 h-3.5 text-orange-600" />
              <span className="hidden sm:inline">SVG</span>
            </button>

            {/* Export PNG */}
            <button
              type="button"
              onClick={handleDownloadPng}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              title="Download high-resolution PNG image"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">PNG</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Canvas + Side Source Split */}
        <div className="flex-1 overflow-hidden flex relative">
          {/* Interactive Pan/Zoom Canvas Area */}
          <div
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`flex-1 h-full bg-[#FAF8F5] overflow-hidden flex items-center justify-center relative select-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Dot grid pattern backdrop */}
            <div
              className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />

            {/* Scaled & Panned SVG Diagram */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
              className="shrink-0 shadow-lg rounded-xl overflow-hidden border border-slate-200/80 bg-white"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          </div>

          {/* Collapsible Source Code Drawer */}
          {showCode && (
            <div className="w-80 border-l border-slate-200 bg-[#0F172A] text-slate-200 flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-150">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#1E293B] text-xs">
                <span className="font-mono font-bold text-orange-400">Mermaid Code</span>
                <button
                  type="button"
                  onClick={handleCopySource}
                  className="flex items-center gap-1 text-[11px] hover:text-white transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono overflow-auto flex-1 leading-relaxed text-slate-300 whitespace-pre-wrap selection:bg-orange-500/30">
                {mermaidSource}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
