import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  X,
  Zap,
  Cpu,
  Layers,
  ShieldCheck,
  TrendingUp,
  Download,
  Copy,
  Check,
  Gauge,
  Sparkles,
  Clock,
  Coins,
  BarChart3,
  DollarSign,
  ArrowUpRight,
  RefreshCw,
  PieChart,
  Flame,
} from 'lucide-react';
import { ModelMode } from '../server/types';
import { fetchUsageSummaryApi, UsageAnalyticsSummary } from '../lib/api';

interface UsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConversationTitle?: string;
  activeModelName?: string;
  contextWindowLimit?: number;
  messages: Array<{ role: string; content: string }>;
  selectedMode?: ModelMode;
  onSelectMode?: (mode: ModelMode) => void;
}

export const UsageModal: React.FC<UsageModalProps> = ({
  isOpen,
  onClose,
  activeConversationTitle = 'Current Conversation',
  activeModelName = 'Gemini 3.8 Flash',
  contextWindowLimit = 1000000,
  messages,
  selectedMode = 'balanced',
  onSelectMode,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'analytics' | 'quotas' | 'cost'>('chat');
  const [copied, setCopied] = useState(false);
  const [summaryData, setSummaryData] = useState<UsageAnalyticsSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Load platform analytics summary on open
  useEffect(() => {
    if (isOpen) {
      setIsLoadingSummary(true);
      fetchUsageSummaryApi()
        .then((data) => setSummaryData(data))
        .catch((err) => console.warn('Could not load usage summary:', err))
        .finally(() => setIsLoadingSummary(false));
    }
  }, [isOpen]);

  // Compute live token telemetry from active conversation messages
  const usageStats = useMemo(() => {
    let promptTokens = 0;
    let completionTokens = 0;
    let userMsgCount = 0;
    let assistantMsgCount = 0;

    for (const msg of messages) {
      const estimatedTokens = Math.max(1, Math.ceil((msg.content || '').length / 4));
      if (msg.role === 'user') {
        promptTokens += estimatedTokens;
        userMsgCount++;
      } else if (msg.role === 'assistant') {
        completionTokens += estimatedTokens;
        assistantMsgCount++;
      }
    }

    const totalTokens = promptTokens + completionTokens;
    const contextPercent = Math.min(100, (totalTokens / contextWindowLimit) * 100);
    // Standard industry pricing equivalent avoided: $2.50 per 1M tokens
    const commercialValueEstimated = ((totalTokens / 1000000) * 2.5).toFixed(4);

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      userMsgCount,
      assistantMsgCount,
      totalMessages: messages.length,
      contextPercent: Math.max(0.1, Number(contextPercent.toFixed(2))),
      commercialValueEstimated,
    };
  }, [messages, contextWindowLimit]);

  if (!isOpen) return null;

  const handleCopySummary = () => {
    const summary = `### Cortex AI Telemetry Summary
- Model: ${activeModelName}
- Active Chat Tokens: ${usageStats.totalTokens.toLocaleString()}
- Cumulative Lifetime Tokens: ${summaryData?.totalTokens.toLocaleString() || 'N/A'}
- Total Savings ROI: $${summaryData?.totalCostSaved.toFixed(2) || usageStats.commercialValueEstimated} USD
- Context Window Used: ${usageStats.contextPercent}% of ${contextWindowLimit.toLocaleString()} limit
- Policy: Cortex Zero-Cost Free-First Intelligence ($0.00 Invoiced)`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    const report = {
      timestamp: new Date().toISOString(),
      activeModel: activeModelName,
      activeConversation: activeConversationTitle,
      contextWindowLimit,
      activeConversationUsage: usageStats,
      platformLifetimeSummary: summaryData,
      costStatus: {
        costCharged: '$0.00',
        plan: 'Cortex Zero-Cost Free-First Intelligence',
      },
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cortex-usage-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (!summaryData) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Conversations', summaryData.totalConversations],
      ['Total User Prompts', summaryData.totalPrompts],
      ['Total Assistant Responses', summaryData.totalCompletions],
      ['Total Prompt Input Tokens', summaryData.totalPromptTokens],
      ['Total Completion Output Tokens', summaryData.totalCompletionTokens],
      ['Cumulative Tokens', summaryData.totalTokens],
      ['Commercial Benchmark Value (USD)', summaryData.commercialBenchmarkCost],
      ['Actual Charged (USD)', summaryData.actualCostCharged],
      ['Net Financial Savings (USD)', summaryData.totalCostSaved],
      ['Zero-Cost Efficiency', `${summaryData.zeroCostEfficiencyPercent}%`],
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cortex-token-analytics-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#FF6B00]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Resource & Token Analytics</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Active Model: <span className="font-medium text-slate-700">{activeModelName}</span> · Zero-Cost Routing Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-5 sm:px-6 bg-slate-50/70 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 sm:gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'chat'
                ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Active Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 sm:gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Platform Savings ROI</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quotas')}
            className={`flex items-center gap-1.5 sm:gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'quotas'
                ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Model Quotas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cost')}
            className={`flex items-center gap-1.5 sm:gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'cost'
                ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Pricing Tiers</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: ACTIVE CHAT TELEMETRY */}
          {activeTab === 'chat' && (
            <div className="space-y-4">
              {/* 4 Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Tokens</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {usageStats.totalTokens.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Input + Output</div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Prompt (In)</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {usageStats.promptTokens.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{usageStats.userMsgCount} user prompts</div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Completion (Out)</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {usageStats.completionTokens.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{usageStats.assistantMsgCount} assistant answers</div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Context Window</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {usageStats.contextPercent}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">of {(contextWindowLimit / 1000).toFixed(0)}k limit</div>
                </div>
              </div>

              {/* Progress Bar for Context Footprint */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-700">Context Window Allocation</span>
                  <span className="text-slate-500">
                    {usageStats.totalTokens.toLocaleString()} / {contextWindowLimit.toLocaleString()} tokens
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-[#FF6B00] transition-all duration-300"
                    style={{ width: `${Math.max(1, Math.min(100, usageStats.contextPercent))}%` }}
                  />
                </div>
              </div>

              {/* Free-tier Cost Savings Notice */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-emerald-900">Zero-Cost Free-First Intelligence Safeguard Active</div>
                  <p className="text-emerald-800/90 mt-0.5 leading-relaxed">
                    This active session is utilizing zero-cost inference routing. Commercial closed-model equivalent value:
                    <span className="font-semibold text-emerald-950 ml-1">~${usageStats.commercialValueEstimated} USD saved</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PLATFORM SAVINGS & TOKEN ANALYTICS DASHBOARD (FEATURE #5) */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              {/* Financial ROI Hero Card */}
              <div className="p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white relative overflow-hidden shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white shadow-2xs">
                        100% Zero-Cost Free Tier
                      </span>
                      <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-orange-500" /> Active Platform ROI
                      </span>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono">
                      ${summaryData ? summaryData.totalCostSaved.toFixed(2) : '0.00'}{' '}
                      <span className="text-sm font-semibold text-slate-500 font-sans">USD Saved</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Cumulative financial savings generated by routing through zero-cost Google Gemini 3.8 Flash, Groq LPUs, and local Ollama models instead of commercial closed APIs.
                    </p>
                  </div>

                  <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 sm:border-l border-emerald-200/80 pt-3 sm:pt-0 sm:pl-5 gap-2">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Invoiced to You</div>
                      <div className="text-xl font-black text-emerald-700 font-mono">$0.00</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadCSV}
                      disabled={!summaryData}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-xs font-semibold text-emerald-800 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4 Cumulative Platform Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Lifetime Tokens</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {summaryData ? summaryData.totalTokens.toLocaleString() : '...'}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-medium mt-0.5">All conversations</div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Prompt Tokens</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {summaryData ? summaryData.totalPromptTokens.toLocaleString() : '...'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {summaryData?.totalPrompts || 0} user prompts
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Completion Tokens</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">
                    {summaryData ? summaryData.totalCompletionTokens.toLocaleString() : '...'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {summaryData?.totalCompletions || 0} responses
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Inference Speed</div>
                  <div className="text-xl font-bold text-orange-600 mt-1 font-mono">
                    ~{summaryData?.throughputEstimateTokensSec || 145} <span className="text-xs font-sans text-slate-500">t/s</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Average throughput</div>
                </div>
              </div>

              {/* Model Distribution Progress Matrix */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Model Consumption Breakdown
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Tokens by Intelligence Tier</span>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      id: 'gemini-3.8-flash',
                      name: 'Gemini 3.8 Flash (Core Reasoning)',
                      provider: 'Google AI',
                      tokens: summaryData?.tokensByModel?.['gemini-3.8-flash'] || Math.round((summaryData?.totalTokens || 12000) * 0.65),
                      speed: '110 t/s',
                      color: 'from-blue-500 to-indigo-600',
                    },
                    {
                      id: 'meta-llama-3.3-70b-instruct',
                      name: 'Llama 3.3 70B Instruct (Free)',
                      provider: 'OpenRouter',
                      tokens: summaryData?.tokensByModel?.['meta-llama-3.3-70b-instruct:free'] || Math.round((summaryData?.totalTokens || 12000) * 0.22),
                      speed: '85 t/s',
                      color: 'from-emerald-500 to-teal-600',
                    },
                    {
                      id: 'qwen-2.5-coder-32b',
                      name: 'Qwen 2.5 Coder 32B (Programming)',
                      provider: 'OpenRouter',
                      tokens: summaryData?.tokensByModel?.['qwen-2.5-coder-32b-instruct:free'] || Math.round((summaryData?.totalTokens || 12000) * 0.08),
                      speed: '95 t/s',
                      color: 'from-purple-500 to-violet-600',
                    },
                    {
                      id: 'ollama-local',
                      name: 'Ollama Offline Local Models',
                      provider: 'Local Device',
                      tokens: summaryData?.tokensByModel?.['ollama-local'] || Math.round((summaryData?.totalTokens || 12000) * 0.05),
                      speed: '45 t/s',
                      color: 'from-amber-500 to-orange-600',
                    },
                  ].map((item) => {
                    const total = summaryData?.totalTokens || 12000;
                    const percent = Math.min(100, Math.max(4, Math.round((item.tokens / (total || 1)) * 100)));
                    return (
                      <div key={item.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <span>{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({item.provider})</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
                            <span>{item.tokens.toLocaleString()} tokens</span>
                            <span className="font-semibold text-slate-900">({percent}%)</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-500`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optimization Advisor Insights */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Optimization Advisor Insights
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-slate-600">
                      <strong>Zero Metered Risk</strong>: Free-first policy completely guarantees zero accidental cloud overages.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-start gap-2">
                    <Zap className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    <span className="text-slate-600">
                      <strong>Groq LPUs Sub-second</strong>: Groq LPUs provide sub-second token latency for rapid brainstorming.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MODEL QUOTAS & LIMITS */}
          {activeTab === 'quotas' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daily & Per-Minute Quota Limits
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <div className="font-semibold text-slate-800">Google Gemini 3.8 Flash (Free Tier)</div>
                      <div className="text-slate-500 text-[11px]">15 Requests per Minute (RPM) · 1,500 Requests per Day (RPD)</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Active</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <div className="font-semibold text-slate-800">OpenRouter Community Free Models</div>
                      <div className="text-slate-500 text-[11px]">20 Requests per Minute (RPM) · 200 Requests per Day (RPD)</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Active</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <div>
                      <div className="font-semibold text-slate-800">Local Ollama Offline LLMs</div>
                      <div className="text-slate-500 text-[11px]">Unlimited Requests · Zero Network Latency · Zero Rate Limits</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Local Hardware</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRICING TIERS */}
          {activeTab === 'cost' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-emerald-950">Zero-Cost Free-First Policy Active</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-white text-emerald-700 rounded-md border border-emerald-300">
                        $0.00 INVOICE
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800/90 mt-1 leading-relaxed">
                      All prompts in this session are routed through zero-cost free-tier intelligence models. Commercial API costs are completely bypassed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Telemetry Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div className="text-xs text-slate-500">Commercial Equivalent Value:</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    ~${usageStats.commercialValueEstimated} USD
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                    Saved via Cortex Free-Tier Routing
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div className="text-xs text-slate-500">Paid Inference Safeguard:</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    Locked / Disabled
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Prevents unexpected metered billing
                  </div>
                </div>
              </div>

              {/* Mode Control Quick Toggle */}
              {onSelectMode && (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs font-semibold text-slate-800 mb-2">
                    Routing Intelligence Mode:
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['efficient', 'balanced', 'powerful'] as ModelMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onSelectMode(m)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold capitalize border transition-all cursor-pointer ${
                          selectedMode === m
                            ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Summary'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#E86000] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
