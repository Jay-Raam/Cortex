import React, { useState, useRef, useEffect } from 'react';
import {
  Atom,
  Image as ImageIcon,
  Lightbulb,
  Cpu,
  Globe,
  Paperclip,
  Mic,
  ArrowUpRight,
  Square,
  X,
  ChevronRight,
} from 'lucide-react';
import { ModelMode } from '../server/types';

interface ChatComposerProps {
  onSendMessage: (content: string, attachments: any[]) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  selectedModelName: string;
  selectedMode?: ModelMode;
  onOpenModelModal?: () => void;
  showUpgradeBanner?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  isStreaming,
  onStopStreaming,
  selectedModelName,
  onOpenModelModal,
  showUpgradeBanner = false,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeeperResearchActive, setIsDeeperResearchActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if ((!text.trim() && attachments.length === 0) || isStreaming) return;
    const finalContent = isDeeperResearchActive
      ? `[Deeper Research Mode]\n${text.trim()}`
      : text.trim();
    onSendMessage(finalContent, attachments);
    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const file = files[0];
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const uploaded = await res.json();
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      {/* Outer Composer Card */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm hover:border-[#D1D5DB] transition-all">
        {/* Uploaded attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700"
              >
                <span className="truncate max-w-[140px]">{att.name}</span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="p-0.5 hover:text-red-500 text-slate-400 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input Area */}
        <div className="px-3.5 pt-2.5 pb-1 sm:px-4 sm:pt-3">
          <textarea
            id="chat-composer-input"
            name="chat-composer-input"
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none min-h-[44px] sm:min-h-[48px] max-h-40 leading-relaxed font-sans"
          />
        </div>

        {/* Toolbar Row */}
        <div className="flex flex-wrap items-center justify-between gap-y-1.5 px-3 sm:px-3.5 pb-2 sm:pb-2.5 pt-0">
          {/* Left Toolbar */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Deeper Research Pill */}
            <button
              type="button"
              onClick={() => setIsDeeperResearchActive(!isDeeperResearchActive)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                isDeeperResearchActive
                  ? 'bg-[#FF6B00] text-white border border-[#FF6B00]'
                  : 'bg-[#FFF7ED] text-[#FF6B00] border border-[#FFEDD5] hover:bg-[#FFEDD5]'
              }`}
            >
              <Atom className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Deeper Research</span>
              <span className="xs:hidden">Research</span>
            </button>

            {/* Media Upload Trigger */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              title="Add Image / Media"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Idea / Prompt Suggestions */}
            <button
              type="button"
              onClick={() => {
                setText('Generate fresh ideas and brainstorm creative strategies for: ');
                textareaRef.current?.focus();
              }}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              title="Ideate & Brainstorm"
            >
              <Lightbulb className="w-4 h-4" />
            </button>
          </div>

          {/* Right Toolbar */}
          <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
            {/* Model Processor Toggle */}
            <button
              type="button"
              onClick={onOpenModelModal}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              title={`Active Model: ${selectedModelName}`}
            >
              <Cpu className="w-4 h-4" />
            </button>

            {/* Web Search Toggle */}
            <button
              type="button"
              onClick={() => {
                setText((prev) => (prev.startsWith('[Web Search] ') ? prev.replace('[Web Search] ', '') : `[Web Search] ${prev}`));
              }}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              title="Web Search"
            >
              <Globe className="w-4 h-4" />
            </button>

            {/* Paperclip Attachment */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              title="Attach File"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Voice Audio Mic */}
            <button
              type="button"
              onClick={() => {
                setText('Transcribing voice note...');
              }}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              title="Voice Input"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Send / Stop Circular Orange Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs ml-1"
                title="Stop response"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!text.trim() && attachments.length === 0}
                className={`w-7 h-7 rounded-full text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs ml-1 ${
                  text.trim() || attachments.length > 0
                    ? 'bg-[#FF6B00] hover:bg-[#E86000] active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title="Send message"
              >
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>

        {/* Attached Bottom Banner: "Upgrade to connect all your tools to Cortex" (optional, for empty hero) */}
        {showUpgradeBanner && (
          <div className="border-t border-[#F1F3F5] px-3.5 sm:px-4 py-2 bg-[#FAFBFB] rounded-b-2xl flex items-center justify-between text-xs text-slate-600 hover:bg-slate-100/60 transition-colors cursor-pointer select-none">
            <span className="font-medium text-slate-700 truncate pr-2">
              Upgrade to connect all your tools to Cortex
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {/* Overlapping Connected App Icons */}
              <div className="flex items-center -space-x-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[9px] ring-2 ring-white">
                  N
                </span>
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[9px] ring-2 ring-white">
                  S
                </span>
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-[9px] ring-2 ring-white">
                  G
                </span>
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[9px] ring-2 ring-white">
                  D
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
