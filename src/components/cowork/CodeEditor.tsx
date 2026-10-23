import React, { useRef, useState, useEffect } from 'react';
import {
  Copy,
  Save,
  Check,
  Code2,
  FileText,
  Globe,
  Palette,
} from 'lucide-react';

export interface CodeEditorProps {
  filePath: string;
  content: string;
  originalContent: string;
  onChange: (newContent: string) => void;
  onSave: () => void;
  isSaving?: boolean;
}

function detectLanguage(filePath: string): { label: string; mode: string } {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return { label: 'TypeScript', mode: 'ts' };
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return { label: 'JavaScript', mode: 'js' };
  if (lower.endsWith('.html')) return { label: 'HTML5', mode: 'html' };
  if (lower.endsWith('.css')) return { label: 'CSS3', mode: 'css' };
  if (lower.endsWith('.py')) return { label: 'Python', mode: 'python' };
  if (lower.endsWith('.json')) return { label: 'JSON', mode: 'json' };
  if (lower.endsWith('.md')) return { label: 'Markdown', mode: 'markdown' };
  if (lower.endsWith('.rs')) return { label: 'Rust', mode: 'rust' };
  if (lower.endsWith('.go')) return { label: 'Go', mode: 'go' };
  return { label: 'Plain Text', mode: 'text' };
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  filePath,
  content,
  originalContent,
  onChange,
  onSave,
  isSaving = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isCopied, setIsCopied] = useState(false);

  const isDirty = content !== originalContent;
  const lines = content.split('\n');
  const lineCount = Math.max(lines.length, 1);
  const lang = detectLanguage(filePath);

  // Sync gutter vertical scroll with textarea
  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Update cursor position
  const updateCursorPosition = () => {
    if (!textareaRef.current) return;
    const textBeforeCursor = content.substring(0, textareaRef.current.selectionStart);
    const lineIndex = textBeforeCursor.split('\n').length;
    const lastNewlineIndex = textBeforeCursor.lastIndexOf('\n');
    const colIndex = textareaRef.current.selectionStart - (lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1) + 1;
    setCursorPos({ line: lineIndex, col: colIndex });
  };

  // Keyboard shortcut handlers: Tab for indent, Ctrl+S for save
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onSave();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const target = textareaRef.current;
      if (!target) return;

      const start = target.selectionStart;
      const end = target.selectionEnd;
      const indent = '  '; // 2 spaces

      const newContent = content.substring(0, start) + indent + content.substring(end);
      onChange(newContent);

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + indent.length;
        updateCursorPosition();
      }, 0);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden font-mono text-xs select-none">
      {/* Top File Bar */}
      <div className="px-3.5 py-1.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between text-xs text-slate-600 shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-slate-800 truncate">{filePath}</span>
          {isDirty ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Modified
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-sans">Saved</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-sans font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
            title="Copy code to clipboard"
          >
            {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-sans font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Save file changes (Ctrl+S)"
          >
            <Save className="w-3 h-3" />
            <span>{isSaving ? 'Saving...' : 'Save (Ctrl+S)'}</span>
          </button>
        </div>
      </div>

      {/* Editor Body: Line Number Gutter + Textarea */}
      <div className="flex-1 min-h-0 flex bg-white relative overflow-hidden">
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="w-12 py-3 px-2 bg-slate-50/60 border-r border-slate-100 text-right font-mono text-[11.5px] leading-[21px] text-slate-300 select-none overflow-hidden shrink-0"
        >
          {Array.from({ length: lineCount }).map((_, i) => {
            const lineNum = i + 1;
            const isCurrent = lineNum === cursorPos.line;
            return (
              <div
                key={lineNum}
                className={isCurrent ? 'text-slate-800 font-bold bg-slate-200/50 rounded-xs' : ''}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Code Input Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            onChange(e.target.value);
            updateCursorPosition();
          }}
          onScroll={handleScroll}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          onSelect={updateCursorPosition}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="flex-1 w-full h-full p-3 font-mono text-[12.5px] leading-[21px] text-slate-800 bg-transparent focus:outline-none resize-none no-scrollbar select-text whitespace-pre overflow-auto"
        />
      </div>

      {/* Editor Footer Status Bar */}
      <div className="h-6 px-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-sans shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="font-mono">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span>·</span>
          <span>{lineCount} lines</span>
          <span>·</span>
          <span>{content.length} characters</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">Spaces: 2</span>
          <span>·</span>
          <span className="text-slate-400">UTF-8</span>
          <span>·</span>
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <Code2 className="w-3 h-3 text-blue-600" />
            {lang.label}
          </span>
        </div>
      </div>
    </div>
  );
};
