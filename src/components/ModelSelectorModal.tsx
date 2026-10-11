import React, { useState, useMemo } from 'react';
import { ModelInfo, ModelMode } from '../server/types';
import { Search, Zap, Scale, Sparkles, Check, CheckCircle2, AlertCircle, Eye, Wrench, Brain, Radio } from 'lucide-react';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: ModelInfo[];
  selectedModelId: string;
  selectedMode: ModelMode;
  onSelectModel: (modelId: string, mode: ModelMode) => void;
  onSelectMode: (mode: ModelMode) => void;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  models,
  selectedModelId,
  selectedMode,
  onSelectModel,
  onSelectMode,
}) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'free' | 'gemini' | 'openrouter' | 'groq'>('all');

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
      return true;
    });
  }, [models, search, activeTab]);

  if (!isOpen) return null;

  const currentModel = models.find((m) => m.id === selectedModelId) || models[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-[#0f1722] border border-[#232f42] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232f42]">
          <div>
            <h2 className="text-base font-semibold text-white">Model Routing & Catalog</h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <span>Dynamic Multi-Provider Gateway</span>
              <span aria-hidden="true">·</span>
              <span>Zero-Cost Prioritized</span>
              <span aria-hidden="true">·</span>
              <span>Honest Provider Health</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-[#16202c] hover:bg-[#1f2d3d] border border-[#2b3a4e] rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Mode Selector Segmented Control */}
        <div className="px-6 py-3 bg-[#0a0f16] border-b border-[#232f42]">
          <div className="text-xs font-medium text-slate-400 mb-2">Routing Intelligence Mode:</div>
          <div className="grid grid-cols-3 gap-2">
            {/* Efficient */}
            <button
              onClick={() => {
                onSelectMode('efficient');
                const best = models.find((m) => m.mode === 'efficient' && m.isFree);
                if (best) onSelectModel(best.id, 'efficient');
              }}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                selectedMode === 'efficient'
                  ? 'bg-[#13221b] border-emerald-500/60 text-white shadow-sm'
                  : 'bg-[#121a24] border-[#232f42] text-slate-300 hover:border-[#34445c]'
              }`}
            >
              <Zap className={`w-4 h-4 mt-0.5 shrink-0 ${selectedMode === 'efficient' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-semibold">Efficient</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Ultra-low latency &lt;200ms, streaming throughput</div>
              </div>
            </button>

            {/* Balanced */}
            <button
              onClick={() => {
                onSelectMode('balanced');
                const best = models.find((m) => m.mode === 'balanced' && m.isFree);
                if (best) onSelectModel(best.id, 'balanced');
              }}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                selectedMode === 'balanced'
                  ? 'bg-[#13221b] border-emerald-500/60 text-white shadow-sm'
                  : 'bg-[#121a24] border-[#232f42] text-slate-300 hover:border-[#34445c]'
              }`}
            >
              <Scale className={`w-4 h-4 mt-0.5 shrink-0 ${selectedMode === 'balanced' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-semibold">Balanced</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Optimal balance of reasoning, code &amp; speed</div>
              </div>
            </button>

            {/* Powerful */}
            <button
              onClick={() => {
                onSelectMode('powerful');
                const best = models.find((m) => m.mode === 'powerful');
                if (best) onSelectModel(best.id, 'powerful');
              }}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                selectedMode === 'powerful'
                  ? 'bg-[#13221b] border-emerald-500/60 text-white shadow-sm'
                  : 'bg-[#121a24] border-[#232f42] text-slate-300 hover:border-[#34445c]'
              }`}
            >
              <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 ${selectedMode === 'powerful' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div>
                <div className="text-xs font-semibold">Powerful</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Frontier STEM, logic &amp; multi-step reflection</div>
              </div>
            </button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex items-center justify-between gap-3 px-6 py-2.5 bg-[#0f1722] border-b border-[#232f42]">
          <div className="flex items-center gap-1">
            {(['all', 'free', 'gemini', 'openrouter', 'groq'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize cursor-pointer ${
                  activeTab === tab
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'all' ? 'All Models' : tab === 'free' ? 'Zero-Cost Free' : tab}
              </button>
            ))}
          </div>

          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-[#16202c] border border-[#2b3a4e] rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Model List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredModels.map((m) => {
            const isSelected = m.id === selectedModelId;
            return (
              <div
                key={m.id}
                onClick={() => onSelectModel(m.id, m.mode)}
                className={`group p-3.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#111e17] border-emerald-500/70 shadow-sm'
                    : 'bg-[#131b26] border-[#222e3f] hover:border-[#33445c] hover:bg-[#16212e]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white tracking-tight">{m.displayName}</span>
                      <span className="text-[11px] text-slate-400 font-mono">({m.providerId})</span>
                      {m.isFree && (
                        <span className="text-[11px] text-emerald-400 font-medium">· Zero-Cost</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{m.description}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-2 text-[11px]">
                      {m.availability === 'available' ? (
                        <span className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Available
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {m.availability}
                        </span>
                      )}
                      <span className="text-slate-500 font-mono tabular-nums">{m.latencyMs}ms</span>
                    </div>

                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
                        <Check className="w-3 h-3" /> Selected
                      </span>
                    )}
                  </div>
                </div>

                {/* Capabilities and Specs Row */}
                <div className="flex items-center justify-between gap-4 mt-2.5 pt-2 border-t border-[#1d2737] text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums">Context: {(m.contextWindow / 1024).toFixed(0)}k</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <div className="flex items-center gap-2 text-slate-400">
                      {m.capabilities.vision && (
                        <span className="flex items-center gap-1" title="Multimodal Vision">
                          <Eye className="w-3 h-3 text-slate-400" /> Vision
                        </span>
                      )}
                      {m.capabilities.toolCalling && (
                        <span className="flex items-center gap-1" title="Tool Calling Support">
                          <Wrench className="w-3 h-3 text-slate-400" /> Tools
                        </span>
                      )}
                      {m.capabilities.reasoning && (
                        <span className="flex items-center gap-1" title="Extended Reasoning">
                          <Brain className="w-3 h-3 text-slate-400" /> Reasoning
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-slate-400 text-right text-[11px] truncate max-w-xs">
                    {m.pricingDescription}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredModels.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400">
              No models matching your search and category filter.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#0a0f16] border-t border-[#232f42] text-xs text-slate-400">
          <div>
            Active: <span className="text-white font-medium">{currentModel?.displayName}</span> (Mode: {selectedMode})
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
          >
            Apply Model
          </button>
        </div>
      </div>
    </div>
  );
};
