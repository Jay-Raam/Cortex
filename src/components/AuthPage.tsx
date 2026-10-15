import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles, CheckCircle2, Bot, Layers, Wrench } from 'lucide-react';
import { CognivoLogo } from './CognivoLogo';

interface AuthPageProps {
  onSuccess: (user: any) => void;
  onLogin: (email: string, pass: string) => Promise<any>;
  onRegister: (email: string, name: string, pass: string) => Promise<any>;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onSuccess,
  onLogin,
  onRegister,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const user = await onLogin(email, password);
        onSuccess(user);
      } else {
        if (!name.trim()) {
          throw new Error('Please enter your full name');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        const user = await onRegister(email, name, password);
        onSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col lg:flex-row bg-[#FAFBFB] text-slate-900 font-sans selection:bg-[#FFEDD5] selection:text-[#C2410C]">
      {/* Left Brand Showcase Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A0F1D] text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Subtle glowing ambient lights */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF6B00]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-lg">
            <CognivoLogo size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight font-sans">Cortex</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FF6B00]/20 text-[#FF8533] border border-[#FF6B00]/30 ml-2">
            AI Platform
          </span>
        </div>

        {/* Center Hero Copy & Capabilities Grid */}
        <div className="relative z-10 max-w-lg my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-orange-200 mb-6 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Next-Gen Autonomous Agent & Model Routing</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight font-sans">
            Start smart conversations with multi-model intelligence.
          </h2>
          <p className="mt-4 text-sm text-slate-300 leading-relaxed">
            Access leading models including Gemini, Llama, and Nemotron with automatic zero-cost routing, collaborative workspaces, and custom personas.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
                <Bot className="w-4 h-4 text-[#FF6B00]" />
                <span>Free-First Routing</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Intelligently routes inference to top zero-cost models first.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Co-Work Engine</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Artifact generation, live unified diffs, and workspace tools.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>End-to-End Multi-Tenant Isolation</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>All Systems Operational</span>
          </div>
        </div>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative overflow-y-auto">
        {/* Mobile Brand Header */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#FFF9F3] border border-[#FFE8D6] flex items-center justify-center shadow-xs">
            <CognivoLogo size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Cortex</span>
        </div>

        <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-3xl shadow-xl p-8 sm:p-10 relative">
          {/* Header Title */}
          <div className="text-left mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {mode === 'login' ? 'Sign In to Cortex' : 'Create your Cortex Account'}
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {mode === 'login'
                ? 'Sign in to access your autonomous AI workspaces, agentic skills, and model router.'
                : 'Get started with zero-cost intelligent model routing and private Co-Work sessions.'}
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input for Register */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#FF6B00] focus:bg-white focus:ring-2 focus:ring-[#FF6B00]/15 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Work or Personal Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#FF6B00] focus:bg-white focus:ring-2 focus:ring-[#FF6B00]/15 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Password
                </label>
                {mode === 'register' && (
                  <span className="text-[11px] text-slate-400">Min 6 characters</span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:border-[#FF6B00] focus:bg-white focus:ring-2 focus:ring-[#FF6B00]/15 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 h-11 bg-[#FF6B00] hover:bg-[#E86000] active:scale-[0.99] text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Cortex' : 'Create Free Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security & Non-Storage Policy Notice */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Protected by secure <strong>HTTP-Only session cookies</strong>. No sensitive tokens in unencrypted local storage.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
