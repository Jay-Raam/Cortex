import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Swords,
  X,
  Play,
  Square,
  Sparkles,
  Zap,
  Clock,
  Eye,
  EyeOff,
  ThumbsUp,
  Award,
  RefreshCw,
  Copy,
  Check,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { ModelInfo } from '../../server/types';
import { streamChat, StreamEvent, submitArenaVoteApi } from '../../lib/api';

interface ModelArenaViewProps {
  models: ModelInfo[];
  onBackToChat: () => void;
  defaultConversationId?: string;
}

export const ModelArenaView: React.FC<ModelArenaViewProps> = ({
  models,
  onBackToChat,
  defaultConversationId,
}) => {
  // Available models (filter to popular free/recommended models)
  const selectableModels = models.length > 0 ? models : [
    { id: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', providerId: 'gemini' } as ModelInfo,
    { id: 'meta-llama-3.3-70b-instruct:free', displayName: 'Llama 3.3 70B (Free)', providerId: 'openrouter' } as ModelInfo,
    { id: 'qwen-2.5-coder-32b-instruct:free', displayName: 'Qwen 2.5 Coder 32B (Free)', providerId: 'openrouter' } as ModelInfo,
    { id: 'ollama-local', displayName: 'Ollama Local Models', providerId: 'ollama' } as ModelInfo,
  ];

  const [modelAId, setModelAId] = useState<string>(
    selectableModels[0]?.id || 'gemini-3.8-flash'
  );
  const [modelBId, setModelBId] = useState<string>(
    selectableModels[1]?.id || 'meta-llama-3.3-70b-instruct:free'
  );

  const [isBlindMode, setIsBlindMode] = useState<boolean>(true);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [promptText, setPromptText] = useState<string>('');

  // Streaming State for Model A
  const [isStreamingA, setIsStreamingA] = useState<boolean>(false);
  const [contentA, setContentA] = useState<string>('');
  const [ttftA, setTtftA] = useState<number | null>(null);
  const [tokensA, setTokensA] = useState<number>(0);
  const [copiedA, setCopiedA] = useState<boolean>(false);

  // Streaming State for Model B
  const [isStreamingB, setIsStreamingB] = useState<boolean>(false);
  const [contentB, setContentB] = useState<string>('');
  const [ttftB, setTtftB] = useState<number | null>(null);
  const [tokensB, setTokensB] = useState<number>(0);
  const [copiedB, setCopiedB] = useState<boolean>(false);

  // Voting State
  const [votedWinner, setVotedWinner] = useState<'model_a' | 'model_b' | 'tie' | 'both_bad' | null>(null);
  const [isSubmittingVote, setIsSubmittingVote] = useState<boolean>(false);

  const abortRefA = useRef<(() => void) | null>(null);
  const abortRefB = useRef<(() => void) | null>(null);

  // Model Metadata
  const modelAInfo = selectableModels.find((m) => m.id === modelAId);
  const modelBInfo = selectableModels.find((m) => m.id === modelBId);

  const isAnyStreaming = isStreamingA || isStreamingB;
  const hasResponses = Boolean(contentA || contentB);

  // Execute dual concurrent streaming battle
  const handleStartBattle = useCallback(() => {
    const text = promptText.trim();
    if (!text || isAnyStreaming) return;

    // Reset previous run
    setContentA('');
    setContentB('');
    setTtftA(null);
    setTtftB(null);
    setTokensA(0);
    setTokensB(0);
    setVotedWinner(null);
    setIsRevealed(!isBlindMode);

    const convId = defaultConversationId || `conv_arena_${Date.now()}`;
    const startTime = Date.now();

    // 1. Dispatch Model A
    setIsStreamingA(true);
    let firstTokenSeenA = false;

    abortRefA.current = streamChat(
      {
        conversationId: convId,
        content: text,
        modelId: modelAId,
      },
      (event: StreamEvent) => {
        if (event.type === 'delta') {
          if (!firstTokenSeenA) {
            firstTokenSeenA = true;
            setTtftA(Date.now() - startTime);
          }
          setContentA((prev) => prev + event.payload.text);
          setTokensA((prev) => prev + Math.max(1, Math.ceil(event.payload.text.length / 4)));
        } else if (event.type === 'completed') {
          setIsStreamingA(false);
        }
      },
      (err) => {
        console.warn('Model A stream warning:', err);
        setIsStreamingA(false);
      }
    );

    // 2. Dispatch Model B
    setIsStreamingB(true);
    let firstTokenSeenB = false;

    abortRefB.current = streamChat(
      {
        conversationId: convId,
        content: text,
        modelId: modelBId,
      },
      (event: StreamEvent) => {
        if (event.type === 'delta') {
          if (!firstTokenSeenB) {
            firstTokenSeenB = true;
            setTtftB(Date.now() - startTime);
          }
          setContentB((prev) => prev + event.payload.text);
          setTokensB((prev) => prev + Math.max(1, Math.ceil(event.payload.text.length / 4)));
        } else if (event.type === 'completed') {
          setIsStreamingB(false);
        }
      },
      (err) => {
        console.warn('Model B stream warning:', err);
        setIsStreamingB(false);
      }
    );
  }, [defaultConversationId, isAnyStreaming, isBlindMode, modelAId, modelBId, promptText]);

  // Stop battle
  const handleStopBattle = () => {
    if (abortRefA.current) abortRefA.current();
    if (abortRefB.current) abortRefB.current();
    setIsStreamingA(false);
    setIsStreamingB(false);
  };

  // Submit voting preference
  const handleVote = async (winner: 'model_a' | 'model_b' | 'tie' | 'both_bad') => {
    setVotedWinner(winner);
    setIsRevealed(true);
    setIsSubmittingVote(true);

    try {
      await submitArenaVoteApi({
        prompt: promptText.trim() || 'Arena evaluation prompt',
        modelA: modelAId,
        modelB: modelBId,
        winner,
        latencyMsA: ttftA || 0,
        latencyMsB: ttftB || 0,
      });
    } catch (err) {
      console.warn('Vote submission error:', err);
    } finally {
      setIsSubmittingVote(false);
    }
  };

  // Quick preset sample prompts
  const samplePrompts = [
    'Explain Quantum Computing to a 10-year-old with everyday analogies.',
    'Write a TypeScript function to debounce an API call with cancel method and tests.',
    'Compare Microservices vs Modular Monolith architecture tradeoffs for a startup.',
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF8F5] overflow-hidden font-sans">
      {/* Top Arena Control Bar */}
      <header className="px-4 sm:px-6 py-3 bg-white border-b border-[#E5E0D8] flex items-center justify-between shrink-0 shadow-2xs select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#FF6B00] shadow-xs">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">Model Arena</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-[#FF6B00] border border-orange-200/60 uppercase">
                Dual Stream Battle
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Pit two AI models head-to-head with concurrent streaming and comparative telemetry
            </p>
          </div>
        </div>

        {/* Right header buttons: Blind Mode Toggle + Close */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsBlindMode((prev) => !prev);
              if (!isBlindMode) setIsRevealed(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              isBlindMode
                ? 'bg-purple-50 border-purple-200 text-purple-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Blind Mode conceals model names until you vote"
          >
            {isBlindMode ? <EyeOff className="w-3.5 h-3.5 text-purple-600" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Blind Battle:</span>
            <span>{isBlindMode ? 'Active' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={onBackToChat}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="Exit Arena & Return to Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Arena Model Selectors Strip */}
      <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-[#F0ECE1] grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 shadow-2xs">
        {/* Model A Selector */}
        <div className="flex items-center justify-between gap-2 bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#E5E0D8]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
              A
            </span>
            <div className="truncate text-xs font-semibold text-slate-800">
              {isBlindMode && !isRevealed ? 'Model 🅰️ (Hidden)' : modelAInfo?.displayName || modelAId}
            </div>
          </div>
          <select
            value={modelAId}
            onChange={(e) => setModelAId(e.target.value)}
            disabled={isAnyStreaming}
            className="bg-white border border-slate-200 text-slate-700 rounded-lg text-xs px-2 py-1 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            {selectableModels.map((m) => (
              <option key={`a-${m.id}`} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Model B Selector */}
        <div className="flex items-center justify-between gap-2 bg-[#FAF8F5] px-3 py-1.5 rounded-xl border border-[#E5E0D8]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
              B
            </span>
            <div className="truncate text-xs font-semibold text-slate-800">
              {isBlindMode && !isRevealed ? 'Model 🅱️ (Hidden)' : modelBInfo?.displayName || modelBId}
            </div>
          </div>
          <select
            value={modelBId}
            onChange={(e) => setModelBId(e.target.value)}
            disabled={isAnyStreaming}
            className="bg-white border border-slate-200 text-slate-700 rounded-lg text-xs px-2 py-1 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            {selectableModels.map((m) => (
              <option key={`b-${m.id}`} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Dual Response Battleground */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
        {/* Left Column: Model A */}
        <div className="flex flex-col h-full overflow-hidden bg-white">
          {/* Column A Telemetry Header */}
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-700">
                {isBlindMode && !isRevealed ? 'Model 🅰️' : modelAInfo?.displayName}
              </span>
              {isStreamingA && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-semibold animate-pulse">
                  Streaming...
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
              {ttftA !== null && <span>TTFT: {ttftA}ms</span>}
              {tokensA > 0 && <span>{tokensA} tokens</span>}
              {contentA && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(contentA);
                    setCopiedA(true);
                    setTimeout(() => setCopiedA(false), 2000);
                  }}
                  className="p-1 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Copy Model A response"
                >
                  {copiedA ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* Response Scroll View A */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3 leading-relaxed text-slate-800 text-sm whitespace-pre-wrap select-text">
            {contentA ? (
              contentA
            ) : isStreamingA ? (
              <div className="flex items-center gap-2 text-slate-400 italic text-xs">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <span>Model A is generating answer...</span>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
                <Sparkles className="w-6 h-6 text-slate-300 mb-2" />
                <span className="text-xs">Model A response will appear here</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Model B */}
        <div className="flex flex-col h-full overflow-hidden bg-white">
          {/* Column B Telemetry Header */}
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-700">
                {isBlindMode && !isRevealed ? 'Model 🅱️' : modelBInfo?.displayName}
              </span>
              {isStreamingB && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-semibold animate-pulse">
                  Streaming...
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
              {ttftB !== null && <span>TTFT: {ttftB}ms</span>}
              {tokensB > 0 && <span>{tokensB} tokens</span>}
              {contentB && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(contentB);
                    setCopiedB(true);
                    setTimeout(() => setCopiedB(false), 2000);
                  }}
                  className="p-1 hover:text-slate-900 transition-colors cursor-pointer"
                  title="Copy Model B response"
                >
                  {copiedB ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* Response Scroll View B */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3 leading-relaxed text-slate-800 text-sm whitespace-pre-wrap select-text">
            {contentB ? (
              contentB
            ) : isStreamingB ? (
              <div className="flex items-center gap-2 text-slate-400 italic text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Model B is generating answer...</span>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
                <Sparkles className="w-6 h-6 text-slate-300 mb-2" />
                <span className="text-xs">Model B response will appear here</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Voting Bar: Visible once responses are available */}
      {hasResponses && !isAnyStreaming && (
        <div className="px-4 sm:px-6 py-3 bg-[#FAF8F5] border-t border-[#E5E0D8] shrink-0 animate-in fade-in duration-200">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-orange-500" />
              <span>Which model performed better?</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleVote('model_a')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  votedWinner === 'model_a'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                👈 Model A is Better
              </button>

              <button
                type="button"
                onClick={() => handleVote('tie')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  votedWinner === 'tie'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                🤝 Tie / Equal
              </button>

              <button
                type="button"
                onClick={() => handleVote('model_b')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  votedWinner === 'model_b'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                👉 Model B is Better
              </button>

              <button
                type="button"
                onClick={() => handleVote('both_bad')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  votedWinner === 'both_bad'
                    ? 'bg-red-600 text-white border-red-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-red-50 hover:text-red-700'
                }`}
              >
                👎 Both Poor
              </button>
            </div>
          </div>

          {votedWinner && (
            <div className="max-w-3xl mx-auto mt-2 text-center text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200/80 rounded-lg py-1">
              ✨ Vote recorded! Model identities revealed: Model A was <strong>{modelAInfo?.displayName}</strong> · Model B was <strong>{modelBInfo?.displayName}</strong>
            </div>
          )}
        </div>
      )}

      {/* Bottom Battle Prompt Composer */}
      <footer className="p-4 bg-white border-t border-[#E5E0D8] shrink-0">
        <div className="max-w-3xl mx-auto space-y-2.5">
          {/* Quick preset chips */}
          {!hasResponses && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Try prompt:</span>
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPromptText(p)}
                  className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-orange-50 hover:text-orange-600 border border-slate-200/60 text-slate-600 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Prompt Input Box */}
          <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#E5E0D8] rounded-2xl p-2 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all shadow-xs">
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleStartBattle();
                }
              }}
              placeholder="Enter a prompt to pit both models head-to-head (Enter to start battle)..."
              rows={1}
              className="flex-1 bg-transparent border-0 outline-none resize-none text-xs sm:text-sm text-slate-800 placeholder-slate-400 py-1.5 px-2 max-h-24"
            />

            {isAnyStreaming ? (
              <button
                type="button"
                onClick={handleStopBattle}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartBattle}
                disabled={!promptText.trim()}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition-all cursor-pointer ${
                  promptText.trim()
                    ? 'bg-[#FF6B00] hover:bg-[#E86000] active:scale-95'
                    : 'bg-slate-300 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Battle</span>
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
