import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Square, Paperclip, X, Zap, Sparkles } from 'lucide-react';
import { uploadFile } from '../lib/api';
import { ModelMode } from '../server/types';

interface ChatComposerProps {
  onSendMessage: (content: string, attachments: any[]) => void;
  isStreaming: boolean;
  onStopStreaming: () => void;
  selectedModelName: string;
  selectedMode: ModelMode;
  onOpenModelModal: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  isStreaming,
  onStopStreaming,
  selectedModelName,
  selectedMode,
  onOpenModelModal,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
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
    onSendMessage(text.trim(), attachments);
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
      const uploaded = await uploadFile(file);
      setAttachments((prev) => [...prev, uploaded]);
    } catch (err: any) {
      alert(`File upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-5 pt-2">
      <div className="relative rounded-xl border border-[#233145] bg-[#0d141d] focus-within:border-emerald-500/60 shadow-lg transition-colors">
        {/* Attachments preview list */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141e2b] border border-[#26374d] rounded-md text-xs text-slate-300"
              >
                <span className="truncate max-w-[140px]">{att.name}</span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="p-0.5 hover:text-red-400 text-slate-500 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Input */}
        <textarea
          id="chat-composer-input"
          name="chat-composer-input"
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Cortex anything, analyze code, or create tasks..."
          className="w-full p-3.5 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none max-h-44"
        />

        {/* Action Toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          {/* Left: Attachment & Model Trigger */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#162333] rounded-md transition-colors cursor-pointer"
              title="Attach File or Code"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenModelModal}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-[#162333] border border-[#213045] rounded-md transition-colors cursor-pointer"
              title="Change active model or mode"
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span className="max-w-[120px] truncate font-medium text-slate-300">{selectedModelName}</span>
              <span className="text-[10px] text-slate-500 font-mono">({selectedMode})</span>
            </button>
          </div>

          {/* Right: Send or Stop Button */}
          <div>
            {isStreaming ? (
              <button
                onClick={onStopStreaming}
                className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors cursor-pointer"
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!text.trim() && attachments.length === 0}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  text.trim() || attachments.length > 0
                    ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold'
                    : 'bg-[#182333] text-slate-600 cursor-not-allowed'
                }`}
                title="Send message (Enter)"
              >
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
