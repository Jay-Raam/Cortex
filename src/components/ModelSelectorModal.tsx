import React, { useState, useMemo } from 'react';
import { ModelInfo, ModelMode } from '../server/types';
import { Search, Zap, Scale, Sparkles, CheckCircle2, Radio, X } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cognivo Model Routing & Catalog</h2>
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
                <div className="text-[11px] text-slate-500 mt-0.5">Optimal balance of reasoning, code & speed</div>
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
                <div className="text-[11px] text-slate-500 mt-0.5">Deep architectural reasoning & analysis</div>
              </div>
            </button>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="px-6 py-3 flex items-center justify-between gap-4 border-b border-slate-100">
          <div className="flex items-center gap-1 text-xs">
            {(['all', 'free', 'gemini', 'openrouter', 'groq'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#FF6B00] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab === 'all' ? 'All Models' : tab}
              </button>
            ))}
          </div>

          <div className="relative w-64">
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

        {/* Models List */}
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
      </div>
    </div>
  );
};
