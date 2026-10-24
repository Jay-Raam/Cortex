import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Plus,
  Sparkles,
  Layers,
  ShieldCheck,
  Bug,
  Code2,
  Database,
  FileText,
  Copy,
  Check,
  Trash2,
  Play,
  SlidersHorizontal,
  ChevronRight,
  UserCheck,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { PromptTemplateEntity, PromptCategory } from '../server/types';
import { fetchPromptTemplatesApi, savePromptTemplateApi, deletePromptTemplateApi } from '../lib/api';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

const CATEGORIES: { label: string; value: 'All' | PromptCategory; icon: React.ReactNode }[] = [
  { label: 'All', value: 'All', icon: <Layers className="w-3.5 h-3.5 text-slate-400" /> },
  { label: 'Engineering', value: 'Engineering', icon: <Code2 className="w-3.5 h-3.5 text-blue-400" /> },
  { label: 'Architecture', value: 'Architecture', icon: <Layers className="w-3.5 h-3.5 text-indigo-400" /> },
  { label: 'Debugging', value: 'Debugging', icon: <Bug className="w-3.5 h-3.5 text-amber-400" /> },
  { label: 'Security', value: 'Security', icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> },
  { label: 'Quality', value: 'Quality', icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" /> },
  { label: 'Productivity', value: 'Productivity', icon: <FileText className="w-3.5 h-3.5 text-cyan-400" /> },
  { label: 'Custom', value: 'Custom', icon: <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> },
];

export const TemplatesModal: React.FC<TemplatesModalProps> = ({ isOpen, onClose, onSelectPrompt }) => {
  const [templates, setTemplates] = useState<PromptTemplateEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | PromptCategory>('All');
  const [activeTab, setActiveTab] = useState<'explore' | 'create'>('explore');

  // Variable Filling Wizard State
  const [configuringTemplate, setConfiguringTemplate] = useState<PromptTemplateEntity | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Create Custom Template Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<PromptCategory>('Custom');
  const [formDescription, setFormDescription] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formTags, setFormTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load templates when modal opens
  useEffect(() => {
    if (!isOpen) {
      setConfiguringTemplate(null);
      setActiveTab('explore');
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchPromptTemplatesApi();
        setTemplates(data);
      } catch (err) {
        console.error('Failed to load prompt templates:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Filter templates by search and category
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesCategory =
        selectedCategory === 'All'
          ? true
          : selectedCategory === 'Custom'
          ? !tpl.isBuiltin
          : tpl.category === selectedCategory;

      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const inTitle = tpl.title.toLowerCase().includes(q);
      const inDesc = tpl.description.toLowerCase().includes(q);
      const inPrompt = tpl.prompt.toLowerCase().includes(q);
      const inTags = tpl.tags?.some((t) => t.toLowerCase().includes(q));

      return inTitle || inDesc || inPrompt || inTags;
    });
  }, [templates, selectedCategory, searchQuery]);

  // Handle Copy Prompt
  const handleCopy = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle Delete Template
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this custom prompt template?')) return;

    try {
      await deletePromptTemplateApi(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (configuringTemplate?.id === id) {
        setConfiguringTemplate(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete template');
    }
  };

  // Launch Template (with or without wizard)
  const handleStartTemplate = (tpl: PromptTemplateEntity) => {
    if (tpl.variables && tpl.variables.length > 0) {
      const initialVars: Record<string, string> = {};
      tpl.variables.forEach((v) => {
        initialVars[v] = '';
      });
      setVariableValues(initialVars);
      setConfiguringTemplate(tpl);
    } else {
      onSelectPrompt(tpl.prompt);
      onClose();
    }
  };

  // Compile prompt with variable replacements
  const compiledPrompt = useMemo(() => {
    if (!configuringTemplate) return '';
    let result = configuringTemplate.prompt;
    Object.entries(variableValues).forEach(([key, val]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, val.trim() || `[${key}]`);
    });
    return result;
  }, [configuringTemplate, variableValues]);

  // Submit compiled prompt
  const handleApplyCompiledPrompt = () => {
    if (!configuringTemplate) return;
    onSelectPrompt(compiledPrompt);
    onClose();
  };

  // Handle Create Custom Template
  const handleSaveCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formTitle.trim()) {
      setFormError('Please enter a template title');
      return;
    }
    if (!formPrompt.trim()) {
      setFormError('Please enter a prompt body');
      return;
    }

    setIsSaving(true);
    try {
      const tags = formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const saved = await savePromptTemplateApi({
        title: formTitle,
        category: formCategory,
        description: formDescription,
        prompt: formPrompt,
        tags,
      });

      setTemplates((prev) => [saved, ...prev]);
      setActiveTab('explore');
      setFormTitle('');
      setFormDescription('');
      setFormPrompt('');
      setFormTags('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to save custom template');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0b0f17] border border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2436] bg-[#0d131f]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-wide">
                  Prompt Templates &amp; Custom Personas
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  {templates.length} Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Curated engineering prompt templates and customizable AI persona workflows
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-[#111823] border border-[#1e293b]">
              <button
                onClick={() => {
                  setActiveTab('explore');
                  setConfiguringTemplate(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'explore'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Browse Library
              </button>
              <button
                onClick={() => {
                  setActiveTab('create');
                  setConfiguringTemplate(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'create'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Template</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-[#192435] rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab 1: Explore & Browse Templates */}
        {activeTab === 'explore' && !configuringTemplate && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search & Categories Bar */}
            <div className="px-6 py-3.5 border-b border-[#1a2436] bg-[#0c121e] flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates, variables, or tags (e.g. review, sql, debug)..."
                  className="w-full pl-9 pr-4 py-2 bg-[#111823] border border-[#1e293b] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      selectedCategory === cat.value
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs'
                        : 'bg-[#111823] text-slate-400 hover:text-slate-200 border border-[#1e293b] hover:border-[#2a3a52]'
                    }`}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Template Cards Grid */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3.5 no-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                  <Sparkles className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                  <p className="text-xs">Loading prompt templates...</p>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 border border-dashed border-[#1e293b] rounded-2xl">
                  <SlidersHorizontal className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm font-medium text-slate-400">No prompt templates match your criteria</p>
                  <p className="text-xs text-slate-500 mt-1">Try clearing your search query or switch categories</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex flex-col justify-between p-4 rounded-xl bg-[#111823]/80 hover:bg-[#141d2b] border border-[#1e293b] hover:border-emerald-500/40 transition-all shadow-sm group"
                    >
                      <div>
                        {/* Top Metadata */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase border ${
                              tpl.category === 'Security'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : tpl.category === 'Architecture'
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : tpl.category === 'Debugging'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : tpl.category === 'Quality'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : tpl.category === 'Productivity'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}
                          >
                            {tpl.category}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {!tpl.isBuiltin && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                Custom
                              </span>
                            )}
                            <button
                              onClick={(e) => handleCopy(tpl.id, tpl.prompt, e)}
                              title="Copy prompt text"
                              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#1c2738] transition-colors"
                            >
                              {copiedId === tpl.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {!tpl.isBuiltin && (
                              <button
                                onClick={(e) => handleDelete(tpl.id, e)}
                                title="Delete custom template"
                                className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Title & Description */}
                        <h3 className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                          {tpl.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {tpl.description}
                        </p>

                        {/* Dynamic Variable Chips */}
                        {tpl.variables && tpl.variables.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-3">
                            <span className="text-[10px] text-slate-500 font-medium">Inputs:</span>
                            {tpl.variables.map((v) => (
                              <span
                                key={v}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#182333] border border-[#233145] text-cyan-300"
                              >
                                &#123;&#123;{v}&#125;&#125;
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bottom Action Footer */}
                      <div className="mt-4 pt-3 border-t border-[#1a2436] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {tpl.tags?.slice(0, 3).map((tag) => (
                            <span key={tag} className="flex items-center gap-0.5 text-[10px] text-slate-500">
                              <Tag className="w-2.5 h-2.5" />
                              {tag}
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={() => handleStartTemplate(tpl)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-all cursor-pointer group-hover:border-emerald-500/60"
                        >
                          <span>{tpl.variables && tpl.variables.length > 0 ? 'Configure' : 'Use Template'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Variable Pre-Fill Wizard */}
        {activeTab === 'explore' && configuringTemplate && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto no-scrollbar space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1a2436]">
              <div>
                <button
                  onClick={() => setConfiguringTemplate(null)}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 mb-1"
                >
                  &larr; Back to library
                </button>
                <h3 className="text-base font-bold text-white">{configuringTemplate.title}</h3>
                <p className="text-xs text-slate-400">{configuringTemplate.description}</p>
              </div>

              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                {configuringTemplate.category}
              </span>
            </div>

            {/* Input Variables Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3.5 bg-[#0e1421] p-4 rounded-xl border border-[#1e293b]">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                  Define Prompt Variables
                </h4>
                {configuringTemplate.variables?.map((v) => (
                  <div key={v} className="space-y-1">
                    <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                      <span className="font-mono text-cyan-300">&#123;&#123;{v}&#125;&#125;</span>
                      <span className="text-[10px] text-slate-500">Required</span>
                    </label>
                    {v.toLowerCase().includes('code') || v.toLowerCase().includes('snippet') || v.toLowerCase().includes('text') ? (
                      <textarea
                        rows={4}
                        value={variableValues[v] || ''}
                        onChange={(e) =>
                          setVariableValues((prev) => ({ ...prev, [v]: e.target.value }))
                        }
                        placeholder={`Provide value for ${v}...`}
                        className="w-full px-3 py-2 bg-[#121927] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 font-mono"
                      />
                    ) : (
                      <input
                        type="text"
                        value={variableValues[v] || ''}
                        onChange={(e) =>
                          setVariableValues((prev) => ({ ...prev, [v]: e.target.value }))
                        }
                        placeholder={`e.g. TypeScript, PostgreSQL, 100k QPS...`}
                        className="w-full px-3 py-2 bg-[#121927] border border-[#1e293b] rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Real-Time Compiled Preview */}
              <div className="space-y-2 flex flex-col">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-cyan-400" />
                  Compiled Prompt Preview
                </h4>
                <div className="flex-1 p-3.5 bg-[#0b0e14] border border-[#1e293b] rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap overflow-y-auto max-h-[300px]">
                  {compiledPrompt}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1a2436]">
              <button
                onClick={() => setConfiguringTemplate(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCompiledPrompt}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Inject Prompt into Chat</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Create Custom Template */}
        {activeTab === 'create' && (
          <form onSubmit={handleSaveCustomTemplate} className="flex-1 p-6 overflow-y-auto no-scrollbar space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Template Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Distributed Lock Reviewer"
                  className="w-full px-3.5 py-2 bg-[#111823] border border-[#1e293b] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as PromptCategory)}
                  className="w-full px-3.5 py-2 bg-[#111823] border border-[#1e293b] rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/60"
                >
                  <option value="Custom">Custom Persona</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Architecture">Architecture</option>
                  <option value="Debugging">Debugging</option>
                  <option value="Security">Security &amp; Audit</option>
                  <option value="Quality">Code Quality &amp; Clean Architecture</option>
                  <option value="Productivity">Productivity</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Description</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief summary of what this persona or template accomplishes..."
                className="w-full px-3.5 py-2 bg-[#111823] border border-[#1e293b] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Prompt Body *</label>
                <span className="text-[11px] text-cyan-400 font-mono">
                  Tip: Use &#123;&#123;variable&#125;&#125; for placeholders
                </span>
              </div>
              <textarea
                rows={6}
                value={formPrompt}
                onChange={(e) => setFormPrompt(e.target.value)}
                placeholder="Act as a staff distributed systems engineer. Review the following {{language}} code with focus on {{focus_area}}:\n\n```\n{{code}}\n```"
                className="w-full px-3.5 py-2.5 bg-[#111823] border border-[#1e293b] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 font-mono leading-relaxed"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Tags (comma separated)</label>
              <input
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="e.g. concurrency, redis, etcd, architecture"
                className="w-full px-3.5 py-2 bg-[#111823] border border-[#1e293b] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1a2436]">
              <button
                type="button"
                onClick={() => setActiveTab('explore')}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Template'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
