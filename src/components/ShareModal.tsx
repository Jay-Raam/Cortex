import React, { useState } from 'react';
import { Share2, Copy, Check, ExternalLink, X, Globe, Lock } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationTitle?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  conversationTitle = 'Cortex AI Workspace Session',
}) => {
  const [copied, setCopied] = useState(false);
  const [shareScope, setShareScope] = useState<'link' | 'public'>('link');

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://cortex.local';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Cortex AI: ${conversationTitle}`,
          text: `Review this AI workspace conversation in Cortex:`,
          url: currentUrl,
        });
        onClose();
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Native share failed or dismissed, falling back to copy:', err);
        }
      }
    }
    // Fallback: copy to clipboard
    handleCopyLink();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-md flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF9F3] border border-[#FFE8D6] flex items-center justify-center text-[#FF6B00]">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Share Workspace</h2>
              <p className="text-[11px] text-slate-500">Collaborate or share this conversation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Conversation Title
            </label>
            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 truncate">
              {conversationTitle}
            </div>
          </div>

          {/* Access Scope Options */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Access Permissions</label>
            <div
              onClick={() => setShareScope('link')}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                shareScope === 'link'
                  ? 'border-[#FF6B00] bg-orange-50/40 ring-1 ring-[#FF6B00]'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-slate-600" />
                <div>
                  <div className="text-xs font-semibold text-slate-900">Anyone with the link</div>
                  <div className="text-[11px] text-slate-500">Read-only view for collaborators</div>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  shareScope === 'link'
                    ? 'border-[#FF6B00] bg-[#FF6B00]'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {shareScope === 'link' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>

            <div
              onClick={() => setShareScope('public')}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                shareScope === 'public'
                  ? 'border-[#FF6B00] bg-orange-50/40 ring-1 ring-[#FF6B00]'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-slate-600" />
                <div>
                  <div className="text-xs font-semibold text-slate-900">Public &amp; Discoverable</div>
                  <div className="text-[11px] text-slate-500">Indexed for team knowledge search</div>
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  shareScope === 'public'
                    ? 'border-[#FF6B00] bg-[#FF6B00]'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {shareScope === 'public' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
          </div>

          {/* Link URL with One-Click Copy */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Direct Link</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 truncate focus:outline-none select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNativeShare}
              className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E86000] active:scale-95 text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Share Link</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
