import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Settings,
  Send,
  Square,
  Radio,
  RotateCcw,
  Sliders,
  ChevronDown,
  Info,
} from 'lucide-react';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (content: string, attachments?: any[], overrideModelId?: string) => void | Promise<void>;
  isStreaming: boolean;
  lastAssistantMessage?: string;
  selectedModelName: string;
}

// Clean markdown for natural text-to-speech pronunciation
function sanitizeForSpeech(text: string): string {
  if (!text) return '';
  return text
    // Replace code blocks with a brief conversational notice
    .replace(/```[\s\S]*?```/g, ' [Code block omitted for speech] ')
    // Replace inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove headers, bold, italics, strikethroughs
    .replace(/[#*_~]+/g, ' ')
    // Replace markdown links with link text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Collapse excess whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

export const VoiceOverlayModal: React.FC<VoiceOverlayModalProps> = ({
  isOpen,
  onClose,
  onSendMessage,
  isStreaming,
  lastAssistantMessage,
  selectedModelName,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastUserPrompt, setLastUserPrompt] = useState('');
  const [lastSpokenResponse, setLastSpokenResponse] = useState('');
  const [isContinuous, setIsContinuous] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isTtsMuted, setIsTtsMuted] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(16).fill(12));
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Voice Synthesis settings
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [speechPitch, setSpeechPitch] = useState<number>(1.0);

  // References
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastProcessedAssistantRef = useRef<string>('');

  // Load available speech synthesis voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        setAvailableVoices(voices);
        // Prefer natural English voices if available
        const defaultVoice =
          voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha'))) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];
        if (defaultVoice && !selectedVoiceURI) {
          setSelectedVoiceURI(defaultVoice.voiceURI);
        }
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceURI]);

  // Audio frequency visualizer loop
  const updateVisualizer = useCallback(() => {
    if (analyserRef.current && voiceState === 'listening' && !isMuted) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Extract 16 frequency bands
      const bands: number[] = [];
      const step = Math.floor(dataArray.length / 16);
      for (let i = 0; i < 16; i++) {
        const val = dataArray[i * step] || 0;
        // Scale to 8px - 64px
        bands.push(Math.max(10, Math.min(68, Math.round((val / 255) * 60) + 8)));
      }
      setAudioLevels(bands);
    } else if (voiceState === 'speaking') {
      // Dynamic simulated rhythm for TTS speaking
      setAudioLevels((prev) =>
        prev.map(() => Math.floor(Math.random() * 45) + 16)
      );
    } else if (voiceState === 'thinking') {
      // Pulse animation rhythm for thinking state
      const t = Date.now() / 250;
      setAudioLevels((prev) =>
        prev.map((_, idx) => Math.max(10, Math.round(Math.sin(t + idx * 0.4) * 20 + 26)))
      );
    } else {
      // Idle gentle breathing line
      setAudioLevels(new Array(16).fill(10));
    }

    animFrameRef.current = requestAnimationFrame(updateVisualizer);
  }, [voiceState, isMuted]);

  useEffect(() => {
    if (isOpen) {
      animFrameRef.current = requestAnimationFrame(updateVisualizer);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, updateVisualizer]);

  // Setup Microphone AudioContext for visualizer
  const initAudioStream = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
      }
    } catch (err) {
      console.warn('Microphone stream access notice:', err);
    }
  }, []);

  const stopAudioStream = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // Stop active speech synthesis
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Submit collected user speech to chat
  const handleDispatchUserSpeech = useCallback(
    (speechText: string) => {
      const clean = speechText.trim();
      if (!clean) return;

      // Stop speech recognition while AI is thinking/speaking
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }

      setLastUserPrompt(clean);
      setTranscript('');
      setInterimTranscript('');
      setVoiceState('thinking');

      // Send to Cortex AI backend
      onSendMessage(clean);
    },
    [onSendMessage]
  );

  // Start speech recognition
  const startListening = useCallback(() => {
    if (isMuted) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorNotice('Web Speech Recognition is not supported by your browser. Please use Chrome, Edge, or Brave.');
      setVoiceState('idle');
      return;
    }

    stopSpeaking();
    setErrorNotice(null);

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setVoiceState('listening');
      };

      recognition.onresult = (event: any) => {
        let currentFinal = '';
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            currentFinal += item[0].transcript;
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (currentFinal) {
          setTranscript((prev) => (prev ? `${prev.trim()} ${currentFinal.trim()}` : currentFinal.trim()));
        }
        setInterimTranscript(currentInterim);

        // Reset silence timeout to detect end of speech turn
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          setTranscript((latestFinal) => {
            const fullText = `${latestFinal} ${currentInterim}`.trim();
            if (fullText.length > 2) {
              handleDispatchUserSpeech(fullText);
            }
            return latestFinal;
          });
        }, 2200); // 2.2s silence window for natural pause
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('Speech recognition warning:', event.error);
        }
        if (event.error === 'not-allowed') {
          setErrorNotice('Microphone access was denied. Please allow microphone permissions in browser settings.');
          setVoiceState('idle');
        }
      };

      recognition.onend = () => {
        // In continuous mode, restart listening if still in listening state and not streaming
        if (voiceState === 'listening' && !isMuted) {
          try {
            recognition.start();
          } catch (_) {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Speech recognition exception:', e);
      setVoiceState('idle');
    }
  }, [handleDispatchUserSpeech, isMuted, stopSpeaking, voiceState]);

  // Speak assistant response aloud using TTS
  const speakResponse = useCallback(
    (textToSpeak: string) => {
      if (isTtsMuted || !textToSpeak || !('speechSynthesis' in window)) {
        setVoiceState(isContinuous ? 'listening' : 'idle');
        if (isContinuous && !isMuted) startListening();
        return;
      }

      const cleanText = sanitizeForSpeech(textToSpeak);
      if (!cleanText) {
        setVoiceState(isContinuous ? 'listening' : 'idle');
        if (isContinuous && !isMuted) startListening();
        return;
      }

      stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;

      if (selectedVoiceURI) {
        const found = availableVoices.find((v) => v.voiceURI === selectedVoiceURI);
        if (found) utterance.voice = found;
      }

      utterance.onstart = () => {
        setVoiceState('speaking');
        setLastSpokenResponse(cleanText);
      };

      utterance.onend = () => {
        if (isContinuous && !isMuted) {
          setVoiceState('listening');
          startListening();
        } else {
          setVoiceState('idle');
        }
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis error:', e);
        if (isContinuous && !isMuted) {
          setVoiceState('listening');
          startListening();
        } else {
          setVoiceState('idle');
        }
      };

      window.speechSynthesis.speak(utterance);
    },
    [availableVoices, isContinuous, isMuted, isTtsMuted, selectedVoiceURI, speechPitch, speechRate, startListening, stopSpeaking]
  );

  // Watch streaming state and assistant message updates
  useEffect(() => {
    if (isStreaming) {
      setVoiceState('thinking');
    } else if (
      voiceState === 'thinking' &&
      lastAssistantMessage &&
      lastAssistantMessage !== lastProcessedAssistantRef.current
    ) {
      lastProcessedAssistantRef.current = lastAssistantMessage;
      speakResponse(lastAssistantMessage);
    }
  }, [isStreaming, lastAssistantMessage, speakResponse, voiceState]);

  // Launch on open
  useEffect(() => {
    if (isOpen) {
      initAudioStream();
      // Start listening automatically on HUD open
      const startTimer = setTimeout(() => {
        startListening();
      }, 400);
      return () => clearTimeout(startTimer);
    } else {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      stopAudioStream();
      setVoiceState('idle');
      setTranscript('');
      setInterimTranscript('');
      setErrorNotice(null);
    }
  }, [initAudioStream, isOpen, startListening, stopAudioStream, stopSpeaking]);

  // User click on the central orb: tap to interrupt or tap to talk
  const handleOrbClick = () => {
    if (voiceState === 'speaking') {
      // User interrupts AI
      stopSpeaking();
      startListening();
    } else if (voiceState === 'listening') {
      // User manual instant send
      const full = `${transcript} ${interimTranscript}`.trim();
      if (full) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        handleDispatchUserSpeech(full);
      } else {
        // Pause listening
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (_) {}
        }
        setVoiceState('idle');
      }
    } else if (voiceState === 'idle') {
      startListening();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950/95 backdrop-blur-2xl text-white select-none transition-all duration-300 font-sans">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-5 max-w-5xl w-full mx-auto border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-[#FF6B00] shadow-lg shadow-orange-500/20">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white">Cortex Voice Live</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase flex items-center gap-1 ${
                  voiceState === 'listening'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : voiceState === 'speaking'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : voiceState === 'thinking'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    voiceState === 'listening'
                      ? 'bg-cyan-400 animate-ping'
                      : voiceState === 'speaking'
                      ? 'bg-emerald-400 animate-pulse'
                      : voiceState === 'thinking'
                      ? 'bg-amber-400 animate-spin'
                      : 'bg-slate-500'
                  }`}
                />
                {voiceState}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Model: {selectedModelName} · Hands-free Mode
            </p>
          </div>
        </div>

        {/* Right header controls */}
        <div className="flex items-center gap-2">
          {/* Continuous toggle */}
          <button
            onClick={() => setIsContinuous((prev) => !prev)}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              isContinuous
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="When active, mic automatically listens after Cortex finishes speaking"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isContinuous ? 'text-orange-400' : ''}`} />
            <span>Continuous Loop</span>
          </button>

          {/* Voice Settings Button */}
          <button
            onClick={() => setShowSettings((prev) => !prev)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              showSettings
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Speech Settings & Voices"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Close HUD */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
            title="Exit Voice Mode (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Drawer (expandable) */}
      {showSettings && (
        <div className="max-w-2xl w-full mx-auto px-6 py-4 bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-150 my-2">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-orange-400" /> Speech Configuration
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Voice Select */}
            <div>
              <label className="block text-slate-400 mb-1.5 font-medium">Text-to-Speech Voice</label>
              <select
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                className="w-full bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-xs"
              >
                {availableVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            {/* Speech Rate Slider */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1.5 font-medium">
                <span>Speed ({speechRate}x)</span>
                <span>Normal: 1.0x</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.5"
                step="0.05"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className="w-full accent-[#FF6B00] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Central Interactive Orb Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-3xl w-full mx-auto text-center relative py-6">
        {/* Glow Halo behind Orb */}
        <div
          className={`absolute w-72 h-72 rounded-full blur-3xl opacity-30 transition-all duration-700 pointer-events-none ${
            voiceState === 'listening'
              ? 'bg-cyan-500'
              : voiceState === 'speaking'
              ? 'bg-emerald-500'
              : voiceState === 'thinking'
              ? 'bg-amber-500'
              : 'bg-orange-500/40'
          }`}
        />

        {/* Central Audio Orb Button */}
        <button
          onClick={handleOrbClick}
          className="relative group cursor-pointer focus:outline-none transition-transform active:scale-95 mb-8"
          title={
            voiceState === 'speaking'
              ? 'Click to Interrupt AI & Speak'
              : voiceState === 'listening'
              ? 'Click to Send Immediately'
              : 'Click to Start Speaking'
          }
        >
          {/* Outer Ripple Rings */}
          <div
            className={`absolute -inset-4 rounded-full border border-white/15 transition-all duration-500 ${
              voiceState === 'listening'
                ? 'border-cyan-500/50 scale-110 animate-ping opacity-40'
                : voiceState === 'speaking'
                ? 'border-emerald-500/50 scale-105 animate-pulse'
                : voiceState === 'thinking'
                ? 'border-amber-500/60 rotate-180 animate-spin'
                : 'opacity-20'
            }`}
          />

          {/* Main Orb Circle */}
          <div
            className={`w-40 h-40 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-500 border ${
              voiceState === 'listening'
                ? 'bg-gradient-to-tr from-cyan-950 via-slate-900 to-cyan-900/60 border-cyan-400 shadow-cyan-500/30 ring-4 ring-cyan-500/20'
                : voiceState === 'speaking'
                ? 'bg-gradient-to-tr from-emerald-950 via-slate-900 to-emerald-900/60 border-emerald-400 shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                : voiceState === 'thinking'
                ? 'bg-gradient-to-tr from-amber-950 via-slate-900 to-amber-900/60 border-amber-400 shadow-amber-500/30 ring-4 ring-amber-500/20'
                : 'bg-gradient-to-tr from-slate-900 via-slate-950 to-orange-950/40 border-white/20 shadow-orange-500/10 hover:border-orange-500/50'
            }`}
          >
            {voiceState === 'listening' && (
              <div className="flex flex-col items-center gap-1.5 text-cyan-400">
                <Mic className="w-8 h-8 animate-bounce" />
                <span className="text-[11px] font-bold tracking-wider uppercase">Listening</span>
              </div>
            )}
            {voiceState === 'speaking' && (
              <div className="flex flex-col items-center gap-1.5 text-emerald-400">
                <Volume2 className="w-8 h-8 animate-pulse" />
                <span className="text-[11px] font-bold tracking-wider uppercase">Speaking</span>
                <span className="text-[9px] text-emerald-300/80">Tap to Interrupt</span>
              </div>
            )}
            {voiceState === 'thinking' && (
              <div className="flex flex-col items-center gap-1.5 text-amber-400">
                <Sparkles className="w-8 h-8 animate-spin" />
                <span className="text-[11px] font-bold tracking-wider uppercase">Thinking</span>
              </div>
            )}
            {voiceState === 'idle' && (
              <div className="flex flex-col items-center gap-1.5 text-slate-300 group-hover:text-orange-400 transition-colors">
                <Mic className="w-8 h-8" />
                <span className="text-[11px] font-bold tracking-wider uppercase">Tap to Speak</span>
              </div>
            )}
          </div>
        </button>

        {/* Dynamic 16-Bar Audio Equalizer Wave */}
        <div className="flex items-center justify-center gap-1.5 h-16 w-full max-w-md px-4 mb-6">
          {audioLevels.map((lvl, i) => (
            <div
              key={i}
              style={{ height: `${lvl}px` }}
              className={`w-2 rounded-full transition-all duration-75 ${
                voiceState === 'listening'
                  ? 'bg-gradient-to-t from-cyan-600 to-cyan-300'
                  : voiceState === 'speaking'
                  ? 'bg-gradient-to-t from-emerald-600 to-emerald-300'
                  : voiceState === 'thinking'
                  ? 'bg-gradient-to-t from-amber-600 to-amber-300'
                  : 'bg-slate-700/60'
              }`}
            />
          ))}
        </div>

        {/* Live Subtitle Transcript Card */}
        <div className="w-full max-w-xl min-h-[90px] bg-white/5 border border-white/10 rounded-2xl p-4 text-left shadow-lg backdrop-blur-sm">
          {errorNotice ? (
            <div className="flex items-start gap-2 text-amber-400 text-xs">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorNotice}</span>
            </div>
          ) : voiceState === 'listening' ? (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 block mb-1">
                You are saying:
              </span>
              <p className="text-sm font-medium text-white/95">
                {transcript} <span className="text-cyan-300/80 italic">{interimTranscript}</span>
                {!transcript && !interimTranscript && (
                  <span className="text-slate-500 italic">Listening for speech... speak anytime...</span>
                )}
              </p>
            </div>
          ) : voiceState === 'speaking' ? (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                Cortex is speaking:
              </span>
              <p className="text-sm text-slate-200 line-clamp-3">
                {lastSpokenResponse || lastAssistantMessage || 'Generating response...'}
              </p>
            </div>
          ) : voiceState === 'thinking' ? (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                Prompt Sent:
              </span>
              <p className="text-sm font-medium text-slate-300 italic">
                "{lastUserPrompt}"
              </p>
            </div>
          ) : (
            <div className="text-center py-2 text-slate-400 text-xs">
              Microphone idle. Click the orb or unmute to start speaking.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Dock Navigation */}
      <div className="px-6 py-5 max-w-3xl w-full mx-auto border-t border-white/10 flex items-center justify-between shrink-0">
        {/* Left: Mic Mute / Unmute */}
        <button
          onClick={() => {
            if (isMuted) {
              setIsMuted(false);
              startListening();
            } else {
              setIsMuted(true);
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.stop();
                } catch (_) {}
              }
              setVoiceState('idle');
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            isMuted
              ? 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30'
              : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/15'
          }`}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-cyan-400" />}
          <span>{isMuted ? 'Muted' : 'Mic On'}</span>
        </button>

        {/* Center: Tap to Interrupt / Instant Action */}
        <div className="flex items-center gap-2">
          {voiceState === 'speaking' && (
            <button
              onClick={() => {
                stopSpeaking();
                startListening();
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/25 cursor-pointer active:scale-95"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Interrupt &amp; Talk</span>
            </button>
          )}

          {voiceState === 'listening' && (transcript || interimTranscript) && (
            <button
              onClick={() => {
                const full = `${transcript} ${interimTranscript}`.trim();
                if (full) {
                  if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                  handleDispatchUserSpeech(full);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E86000] text-white text-xs font-bold transition-all shadow-lg shadow-orange-500/25 cursor-pointer active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Now</span>
            </button>
          )}
        </div>

        {/* Right: TTS Output Audio Mute */}
        <button
          onClick={() => {
            if (isTtsMuted) {
              setIsTtsMuted(false);
            } else {
              setIsTtsMuted(true);
              stopSpeaking();
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            isTtsMuted
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/15'
          }`}
          title={isTtsMuted ? 'Unmute AI Voice Readout' : 'Mute AI Voice Readout'}
        >
          {isTtsMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          <span className="hidden sm:inline">{isTtsMuted ? 'Voice Muted' : 'Voice Output'}</span>
        </button>
      </div>
    </div>
  );
};
