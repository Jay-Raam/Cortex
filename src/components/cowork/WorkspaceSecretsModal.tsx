import React, { useState, useEffect } from 'react';
import {
  Shield,
  Key,
  Plus,
  Trash2,
  X,
  Eye,
  EyeOff,
  Upload,
  Check,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { Workspace } from '../../server/types';
import {
  fetchWorkspaceSecretsApi,
  saveWorkspaceSecretApi,
  deleteWorkspaceSecretApi,
  importWorkspaceSecretsApi,
} from '../../lib/api';

interface WorkspaceSecretsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
}

interface SecretItem {
  id: string;
  key: string;
  maskedValue: string;
  description?: string;
  updatedAt: string;
}

export const WorkspaceSecretsModal: React.FC<WorkspaceSecretsModalProps> = ({
  isOpen,
  onClose,
  workspace,
}) => {
  const [secrets, setSecrets] = useState<SecretItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Secret form state
  const [key, setKey] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [showValue, setShowValue] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Bulk import state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [dotEnvText, setDotEnvText] = useState<string>('');
  const [showImportArea, setShowImportArea] = useState<boolean>(false);

  const loadSecrets = async () => {
    if (!workspace) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaceSecretsApi(workspace.id);
      setSecrets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load secrets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && workspace) {
      loadSecrets();
    }
  }, [isOpen, workspace?.id]);

  if (!isOpen || !workspace) return null;

  const handleSaveSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim() || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      await saveWorkspaceSecretApi(workspace.id, {
        key: key.trim().toUpperCase(),
        value: value.trim(),
        description: description.trim() || undefined,
      });
      setKey('');
      setValue('');
      setDescription('');
      setSuccessMsg(`Secret ${key.trim().toUpperCase()} encrypted and saved.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadSecrets();
    } catch (err: any) {
      setError(err.message || 'Failed to save secret');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSecret = async (secretKey: string) => {
    if (!confirm(`Are you sure you want to permanently delete secret "${secretKey}"?`)) return;
    try {
      await deleteWorkspaceSecretApi(workspace.id, secretKey);
      await loadSecrets();
    } catch (err: any) {
      setError(err.message || 'Failed to delete secret');
    }
  };

  const handleImportDotEnv = async () => {
    if (!dotEnvText.trim() || isImporting) return;
    setIsImporting(true);
    setError(null);
    try {
      const res = await importWorkspaceSecretsApi(workspace.id, dotEnvText);
      setDotEnvText('');
      setShowImportArea(false);
      setSuccessMsg(`Successfully imported ${res.importedCount} secrets.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadSecrets();
    } catch (err: any) {
      setError(err.message || 'Failed to import .env');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E0D8] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden font-sans text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EBE7DF] bg-[#FAF8F5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Lock className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Workspace Secrets Vault
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                  AES-256-GCM
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Encrypted environment variables for <strong>{workspace.name}</strong>. Never written to disk unencrypted.
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

        {/* Alerts */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Add Secret Form */}
          <form onSubmit={handleSaveSecret} className="bg-[#FAF8F5] p-4 rounded-xl border border-[#E5E0D8] space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Add / Update Encrypted Secret</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Key Name
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="e.g. STRIPE_API_KEY"
                  className="w-full bg-white border border-[#E5E0D8] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#EA580C]"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Secret Value
                </label>
                <div className="relative">
                  <input
                    type={showValue ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Enter sensitive value..."
                    className="w-full bg-white border border-[#E5E0D8] rounded-lg pl-2.5 pr-8 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#EA580C]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowValue(!showValue)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                  >
                    {showValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Production Stripe secret key"
                className="w-full bg-white border border-[#E5E0D8] rounded-lg px-2.5 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#EA580C]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowImportArea(!showImportArea)}
                className="text-xs text-slate-500 hover:text-[#EA580C] font-medium flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>{showImportArea ? 'Hide .env Import' : 'Bulk Import .env File'}</span>
              </button>

              <button
                type="submit"
                disabled={isSaving || !key.trim() || !value.trim()}
                className="px-4 py-1.5 bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                {isSaving ? 'Encrypting...' : 'Save Secret'}
              </button>
            </div>
          </form>

          {/* Bulk Import Collapsible */}
          {showImportArea && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Paste .env Key-Value Pairs
              </label>
              <textarea
                rows={4}
                value={dotEnvText}
                onChange={(e) => setDotEnvText(e.target.value)}
                placeholder={`PORT=8080\nDATABASE_URL=postgres://...\nJWT_SECRET=secret123`}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#EA580C]"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleImportDotEnv}
                  disabled={isImporting || !dotEnvText.trim()}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs cursor-pointer"
                >
                  {isImporting ? 'Importing...' : 'Import Secrets'}
                </button>
              </div>
            </div>
          )}

          {/* Existing Secrets List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-900">
                Encrypted Workspace Secrets ({secrets.length})
              </h4>
            </div>

            {loading ? (
              <div className="text-center py-6 text-xs text-slate-400">Loading secrets vault...</div>
            ) : secrets.length === 0 ? (
              <div className="text-center py-8 bg-[#FAF8F5] rounded-xl border border-dashed border-[#E5E0D8] text-slate-400">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="text-xs font-medium">No secrets configured in this workspace</p>
                <p className="text-[11px] text-slate-400">Add environment variables above to securely inject them.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-[#E5E0D8] rounded-xl overflow-hidden bg-white">
                {secrets.map((sec) => (
                  <div
                    key={sec.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Key className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 truncate">
                            {sec.key}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            {sec.maskedValue}
                          </span>
                        </div>
                        {sec.description && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {sec.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSecret(sec.key)}
                      title={`Delete secret ${sec.key}`}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EBE7DF] bg-[#FAF8F5] flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span className="text-[11px] flex items-center gap-1 text-slate-400">
            <Lock className="w-3 h-3 text-emerald-600" />
            Master key derived per workspace via authenticated GCM tag
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#E5E0D8] hover:bg-slate-50 text-slate-700 font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
