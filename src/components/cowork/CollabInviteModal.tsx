import React, { useState, useEffect } from 'react';
import {
  Users,
  Copy,
  Check,
  X,
  Link,
  Shield,
  RefreshCw,
  FileCode,
  Radio,
} from 'lucide-react';
import { Workspace } from '../../server/types';
import { createCollabInviteApi, fetchCollabSessionApi } from '../../lib/api';

interface CollabInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
}

export const CollabInviteModal: React.FC<CollabInviteModalProps> = ({
  isOpen,
  onClose,
  workspace,
}) => {
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [inviteToken, setInviteToken] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [peers, setPeers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadSession = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const data = await fetchCollabSessionApi(workspace.id);
      setPeers(data.peers || []);
    } catch (err: any) {
      // Non-fatal if session has no peers
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async () => {
    if (!workspace) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await createCollabInviteApi(workspace.id);
      setInviteToken(res.inviteToken);
      const fullUrl = `${window.location.origin}${res.inviteUrl}`;
      setInviteUrl(fullUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to generate invite');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (isOpen && workspace) {
      loadSession();
      if (!inviteUrl) {
        generateInvite();
      }
    }
  }, [isOpen, workspace?.id]);

  if (!isOpen || !workspace) return null;

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E0D8] shadow-2xl w-full max-w-lg overflow-hidden font-sans text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EBE7DF] bg-[#FAF8F5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
              <Users className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Live Pair Programming
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300 flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
                  REAL-TIME
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Invite collaborators to edit code, share cursors, and build together in <strong>{workspace.name}</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {error}
            </div>
          )}

          {/* Invitation Link Section */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Shareable Collaboration Invite Link
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  readOnly
                  value={generating ? 'Generating secure invite token...' : inviteUrl}
                  className="w-full bg-[#FAF8F5] border border-[#E5E0D8] rounded-xl pl-8 pr-2.5 py-2 text-xs font-mono text-slate-700 select-all focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!inviteUrl || generating}
                className="px-3.5 py-2 bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-xl text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Anyone with this cryptographic link can join this workspace as a live collaborator.
            </p>
          </div>

          {/* Active Collaborators */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>Connected Peers ({peers.length})</span>
              </span>
              <button
                onClick={loadSession}
                title="Refresh peer status"
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {peers.length === 0 ? (
              <div className="p-4 bg-[#FAF8F5] rounded-xl border border-dashed border-[#E5E0D8] text-center text-xs text-slate-400">
                No external collaborators connected yet. Send the invite link above to pair program.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-[#E5E0D8] rounded-xl overflow-hidden bg-white max-h-48 overflow-y-auto">
                {peers.map((peer) => (
                  <div key={peer.id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: peer.color }}
                      />
                      <span className="font-semibold text-slate-800 truncate">{peer.userName}</span>
                      {peer.activeFile && (
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 truncate">
                          <FileCode className="w-3 h-3 text-slate-400" />
                          {peer.activeFile}
                        </span>
                      )}
                    </div>
                    {peer.cursor && (
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        L{peer.cursor.line}:C{peer.cursor.column}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EBE7DF] bg-[#FAF8F5] flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-600" />
            Tokens validate cryptographically per session
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#E5E0D8] hover:bg-slate-50 text-slate-700 font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
