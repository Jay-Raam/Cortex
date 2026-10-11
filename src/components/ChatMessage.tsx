import React, { useState } from 'react';
import { Copy, Check, RefreshCw, FileText, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Message } from '../server/types';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onRegenerate?: () => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isStreaming,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`py-6 px-4 md:px-6 transition-colors ${
        isAssistant ? 'bg-[#0b1017] border-y border-[#182333]/50' : 'bg-transparent'
      }`}
    >
      <div className="max-w-3xl mx-auto flex gap-4">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isAssistant ? (
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Bot className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-[#1c2738] border border-[#2b3a4f] flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          {/* Metadata header */}
          <div className="flex items-center gap-2 mb-1.5 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">
              {isAssistant ? 'Cortex Assistant' : 'You'}
            </span>
            {message.modelUsed && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-emerald-400/90 text-[11px]">{message.modelUsed}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-[11px] font-mono tabular-nums">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Attachments (if any) */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-[#141d29] border border-[#233145] rounded-md text-xs text-slate-300"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="truncate max-w-[180px]">{att.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({(att.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Render formatted content */}
          <div className="text-sm text-slate-200 leading-relaxed font-sans">
            {isAssistant ? (
              <div className="markdown-body">
                <MarkdownRenderer content={message.content} />
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 bg-emerald-400 animate-pulse align-middle" />
                )}
              </div>
            ) : (
              <div className="whitespace-pre-wrap">
                {message.content}
              </div>
            )}
          </div>

          {/* Assistant Action Bar */}
          {isAssistant && !isStreaming && (
            <div className="flex items-center gap-2 mt-4 pt-2 border-t border-[#1c2738]/40">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:bg-[#141d29] rounded border border-transparent hover:border-[#243347] transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:bg-[#141d29] rounded border border-transparent hover:border-[#243347] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Regenerate</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Markdown Renderer with rich typography, HTML parsing, tables, and code snippets
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-xl font-bold text-white mt-4 mb-2 pb-1 border-b border-[#1c2738]">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold text-slate-100 mt-4 mb-2">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold text-emerald-400 mt-3 mb-1.5">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold text-slate-200 mt-2 mb-1">
            {children}
          </h4>
        ),
        p: ({ children }) => (
          <p className="mb-2.5 leading-relaxed text-slate-200 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-5 space-y-1 mb-3 text-slate-200">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-5 space-y-1 mb-3 text-slate-200">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed pl-0.5">
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-white">
            {children}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic text-slate-300">
            {children}
          </em>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-emerald-500/70 pl-3.5 py-1 my-2.5 text-slate-300 italic bg-emerald-500/5 rounded-r">
            {children}
          </blockquote>
        ),
        hr: () => (
          <hr className="border-t border-[#1e2c3d] my-4" />
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3 border border-[#233145] rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-[#121a26] text-slate-200 border-b border-[#233145]">
            {children}
          </thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-[#1e2b3c]">
            {children}
          </tbody>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 font-semibold text-slate-200">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-slate-300">
            {children}
          </td>
        ),
        pre: ({ children }) => <>{children}</>,
        code({ className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');
          const isInline = !match && !codeString.includes('\n');

          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-[#131c27] border border-[#233145] text-emerald-300 font-mono text-[12px]"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <CodeSnippet
              code={codeString}
              language={match ? match[1] : 'code'}
            />
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

const CodeSnippet: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg border border-[#233145] bg-[#080d13] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#101722] border-b border-[#233145] text-xs text-slate-400">
        <span className="font-mono text-[11px] text-emerald-400">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};
