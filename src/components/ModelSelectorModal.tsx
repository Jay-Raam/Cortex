import React, { useState, useMemo, useEffect } from 'react';
import { ModelInfo, ModelMode, CustomModelEndpoint } from '../server/types';
import {
  Search,
  Zap,
  Scale,
  Sparkles,
  CheckCircle2,
  Radio,
  X,
  Server,
  Plus,
  Trash2,
  Activity,
  RefreshCw,
  Key,
  ShieldCheck,
  AlertCircle,
  Check,
} from 'lucide-react';
import {
  fetchCustomEndpointsApi,
  saveCustomEndpointApi,
  deleteCustomEndpointApi,
  pingCustomEndpointApi,
} from '../lib/api';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: ModelInfo[];
  selectedModelId: string;
  selectedMode: ModelMode;
  onSelectModel: (modelId: string, mode: ModelMode) => void;
  onSelectMode: (mode: ModelMode) => void;
  onRefreshModels?: () => void;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  models,
  selectedModelId,
  selectedMode,
  onSelectModel,
  onSelectMode,
  onRefreshModels,
}) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'free' | 'gemini' | 'openrouter' | 'groq' | 'ollama' | 'custom'>('all');
  
  // Custom Endpoints State
  const [customEndpoints, setCustomEndpoints] = useState<CustomModelEndpoint[]>([]);
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false);
  const [isAddingEndpoint, setIsAddingEndpoint] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);

  // New Endpoint Form State
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('http://localhost:1234/v1');
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('local-model');
  const [formError, setFormError] = useState<string | null>(null);

  // Load custom endpoints on open
  useEffect(() => {
    if (isOpen) {
      loadEndpoints();
    }
  }, [isOpen]);

  const loadEndpoints = async () => {
    setIsLoadingEndpoints(true);
    try {
      const endpoints = await fetchCustomEndpointsApi();
      setCustomEndpoints(endpoints || []);
    } catch (err) {
      console.warn('Failed to load custom endpoints:', err);
    } finally {
      setIsLoadingEndpoints(false);
    }
  };

  const handleSaveEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newBaseUrl.trim() || !newModel.trim()) {
      setFormError('Name, Base URL, and Default Model are required.');
      return;
    }

    try {
      const saved = await saveCustomEndpointApi({
        name: newName.trim(),
        baseUrl: newBaseUrl.trim(),
        apiKey: newApiKey.trim() || undefined,
        defaultModel: newModel.trim(),
        contextWindow: 32768,
        isEnabled: true,
      });

      setCustomEndpoints((prev) => [...prev.filter((ep) => ep.id !== saved.id), saved]);
      setIsAddingEndpoint(false);
      setNewName('');
      setNewBaseUrl('http://localhost:1234/v1');
      setNewApiKey('');
      setNewModel('local-model');
      setFormError(null);
      if (onRefreshModels) onRefreshModels();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save endpoint');
    }
  };

  const handleDeleteEndpoint = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteCustomEndpointApi(id);
      setCustomEndpoints((prev) => prev.filter((ep) => ep.id !== id));
      if (onRefreshModels) onRefreshModels();
    } catch (err) {
      console.warn('Failed to delete endpoint:', err);
    }
  };

  const handlePingEndpoint = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPingingId(id);
    try {
      const res = await pingCustomEndpointApi(id);
      setCustomEndpoints((prev) =>
        prev.map((ep) =>
          ep.id === id
            ? { ...ep, healthStatus: res.healthStatus as any, latencyMs: res.latencyMs }
            : ep
        )
      );
    } catch (err) {
      console.warn('Ping failed:', err);
    } finally {
      setPingingId(null);
    }
  };

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesSearch =
        m.displayName.toLowerCase().includes(search.toLowerCase()) ||
        m.description.toLowerCase().includes(search.toLowerCase()) ||
        m.providerId.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (activeTab === 'free') return m.isFree;
      if (activeTab === 'gemini') return m.providerId === 'gemini';
      if (activeTab === 'openrouter') return m.providerId === 'openrouter';
      if (activeTab === 'groq') return m.providerId === 'groq';
      if (activeTab === 'ollama') return m.providerId === 'ollama';
      if (activeTab === 'custom') return m.providerId === 'custom' || m.id.startsWith('custom_');
      return true;
    });
  }, [models, search, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cortex Model Routing & Catalog</h2>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              <span>Universal Multi-Provider Gateway</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#FF6B00] font-medium">Free-First Prioritized</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Segmented Control */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
          <div className="text-xs font-semibold text-slate-600 mb-2">Routing Intelligence Mode:</div>
          <div className="grid grid-cols-3 gap-2">
            {/* Efficient */}
            <button
              onClick={() => {
                onSelectMode('efficient');
                const best = models.find((m) => m.mode === 'efficient' && m.isFree);
                if (best) onSelectModel(best.id, 'efficient');
              }}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedMode === 'efficient'
                  ? 'bg-[#FFF7ED] border-[#FF6B00] text-slate-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <Zap className={`w-4 h-4 mt-0.5 shrink-0 ${selectedMode === 'efficient' ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-bold">Efficient</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Ultra-low latency &lt;200ms, streaming throughput</div>
              </div>
            </button>

            {/* Balanced */}
            <button
              onClick={() => {
                onSelectMode('balanced');
                const best = models.find((m) => m.mode === 'balanced' && m.isFree);
                if (best) onSelectModel(best.id, 'balanced');
              }}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedMode === 'balanced'
                  ? 'bg-[#FFF7ED] border-[#FF6B00] text-slate-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <Scale className={`w-4 h-4 mt-0.5 shrink-0 ${selectedMode === 'balanced' ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-bold">Balanced</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Optimal balance of reasoning, code &amp; speed</div>
              </div>
            </button>

            {/* Powerful */}
            <button
              onClick={() => {
                onSelectMode('powerful');
                const best = models.find((m) => m.mode === 'powerful');
                if (best) onSelectModel(best.id, 'powerful');
              }}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedMode === 'powerful'
                  ? 'bg-[#FFF7ED] border-[#FF6B00] text-slate-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 ${selectedMode === 'powerful' ? 'text-[#FF6B00]' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-bold">Powerful</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Deep architectural reasoning &amp; analysis</div>
              </div>
            </button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="px-6 py-3 flex items-center justify-between gap-4 border-b border-slate-100 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 text-xs shrink-0">
            {(['all', 'free', 'gemini', 'openrouter', 'groq', 'ollama', 'custom'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-[#FF6B00] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab === 'ollama' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                {tab === 'custom' && <Server className="w-3.5 h-3.5 shrink-0" />}
                <span>
                  {tab === 'all'
                    ? 'All Models'
                    : tab === 'ollama'
                    ? 'Local Ollama'
                    : tab === 'custom'
                    ? 'Custom Endpoints'
                    : tab}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-60 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search model or provider..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FF6B00]"
            />
          </div>
        </div>

        {/* Content Body: If 'custom' tab is active, show endpoint manager */}
        {activeTab === 'custom' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar max-h-[50vh]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Self-Hosted &amp; OpenAI-Compatible Inference Endpoints
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Connect vLLM, LM Studio, LocalAI, or private reverse proxies directly into Cortex
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingEndpoint(!isAddingEndpoint)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF6B00] hover:bg-[#E86000] text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingEndpoint ? 'Cancel' : 'Add Endpoint'}</span>
              </button>
            </div>

            {/* Add Endpoint Form */}
            {isAddingEndpoint && (
              <form onSubmit={handleSaveEndpoint} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                {formError && (
                  <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Endpoint Name</label>
                    <input
                      type="text"
                      placeholder="e.g. My LM Studio / vLLM Cluster"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Base URL</label>
                    <input
                      type="text"
                      placeholder="http://localhost:1234/v1"
                      value={newBaseUrl}
                      onChange={(e) => setNewBaseUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default Model Name</label>
                    <input
                      type="text"
                      placeholder="e.g. meta-llama-3-8b-instruct or default"
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">API Key / Bearer Token (Optional)</label>
                    <input
                      type="password"
                      placeholder="sk-... or leave empty"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingEndpoint(false)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#FF6B00] hover:bg-[#E86000] text-white rounded-lg font-semibold shadow-2xs"
                  >
                    Save Endpoint
                  </button>
                </div>
              </form>
            )}

            {/* Custom Endpoints List */}
            {customEndpoints.length === 0 && !isAddingEndpoint ? (
              <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                <Server className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                <p>No custom endpoints configured yet.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click 'Add Endpoint' above to connect an LM Studio, vLLM, or LocalAI server.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {customEndpoints.map((ep) => {
                  const modelId = `custom_${ep.id}`;
                  const isSelected = selectedModelId === modelId;
                  return (
                    <div
                      key={ep.id}
                      onClick={() => onSelectModel(modelId, selectedMode)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#FFF7ED] border-[#FF6B00] shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5">
                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-[#FF6B00]" />
                          ) : (
                            <Radio className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">{ep.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-200">
                              Custom OpenAI
                            </span>
                            {/* Health badge */}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                                ep.healthStatus === 'healthy'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : ep.healthStatus === 'unreachable'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  ep.healthStatus === 'healthy'
                                    ? 'bg-emerald-500'
                                    : ep.healthStatus === 'unreachable'
                                    ? 'bg-red-500'
                                    : 'bg-slate-400'
                                }`}
                              />
                              {ep.healthStatus || 'untested'}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 mt-1 flex items-center gap-2">
                            <span>{ep.baseUrl}</span>
                            <span>·</span>
                            <span className="text-slate-700 font-semibold">{ep.defaultModel}</span>
                            {ep.latencyMs ? (
                              <>
                                <span>·</span>
                                <span className="text-emerald-600 font-mono">{ep.latencyMs}ms</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Endpoint Actions */}
                      <div className="flex items-center gap-1 shrink-0 ml-4">
                        <button
                          type="button"
                          onClick={(e) => handlePingEndpoint(ep.id, e)}
                          disabled={pingingId === ep.id}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Ping server health check"
                        >
                          <Activity className={`w-3.5 h-3.5 ${pingingId === ep.id ? 'animate-spin text-orange-500' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteEndpoint(ep.id, e)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete endpoint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Standard Models List */
          <div className="flex-1 overflow-y-auto p-6 space-y-2.5 no-scrollbar max-h-[50vh]">
            {filteredModels.map((m) => {
              const isSelected = m.id === selectedModelId;
              return (
                <div
                  key={m.id}
                  onClick={() => onSelectModel(m.id, selectedMode)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#FFF7ED] border-[#FF6B00] shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5">
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-[#FF6B00]" />
                      ) : (
                        <Radio className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{m.displayName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                          {m.providerId}
                        </span>
                        {m.isFree && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            FREE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{m.description}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-4">
                    <span className="text-[11px] font-mono text-slate-400 capitalize">{m.pricingDescription || (m.isFree ? 'Free' : 'Standard')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
