import React, { useState } from 'react';
import { Copy, Check, RefreshCw, FileText, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Message } from '../server/types';
import { CognivoLogo } from './CognivoLogo';

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
      className={`py-4 px-4 md:px-5 transition-colors ${
        isAssistant
          ? 'bg-white'
          : 'bg-[#F8F9FA] rounded-2xl border border-[#E5E7EB] my-2'
      }`}
    >
      <div className="max-w-3xl mx-auto flex gap-3.5">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isAssistant ? (
            <div className="w-7 h-7 rounded-lg bg-[#FFF7ED] border border-[#FFEDD5] flex items-center justify-center">
              <CognivoLogo size={18} />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600">
              <User className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 min-w-0">
          {/* Metadata header */}
          <div className="flex items-center gap-2 mb-1.5 text-xs text-slate-400">
            <span className="font-semibold text-slate-900">
              {isAssistant ? 'Cortex' : 'You'}
            </span>
            {message.modelUsed && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#FF6B00] text-[11px] font-medium">{message.modelUsed}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Attachments (if any) */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-700"
                >
                  <FileText className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span className="truncate max-w-[180px]">{att.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({(att.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Render formatted content */}
          <div className="text-sm text-slate-800 leading-relaxed font-sans">
            {isAssistant ? (
              <div className="markdown-body">
                <MarkdownRenderer content={message.content} />
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 bg-[#FF6B00] animate-pulse align-middle" />
                )}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-slate-900">
                {message.content}
              </div>
            )}
          </div>

          {/* Assistant Action Bar */}
          {isAssistant && !isStreaming && (
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
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

// Markdown Renderer in light Cognivo aesthetic
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-xl font-bold text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold text-slate-900 mt-4 mb-2">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold text-[#FF6B00] mt-3 mb-1.5">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold text-slate-800 mt-2 mb-1">
            {children}
          </h4>
        ),
        p: ({ children }) => (
          <p className="mb-2.5 leading-relaxed text-slate-800 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside pl-5 space-y-1 mb-3 text-slate-800 marker:text-[#FF6B00]">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside pl-5 space-y-1 mb-3 text-slate-800 marker:text-[#FF6B00]">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed pl-0.5">
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-900">
            {children}
          </strong>
        ),
        em: ({ children }) => (
          <em className="italic text-slate-700">
            {children}
          </em>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-[#FF6B00] pl-3.5 py-1 my-2.5 text-slate-700 italic bg-[#FFF7ED]/60 rounded-r">
            {children}
          </blockquote>
        ),
        hr: () => (
          <hr className="border-t border-slate-200 my-4" />
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF6B00] hover:text-[#EA580C] underline underline-offset-2 transition-colors font-medium"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3 border border-slate-200 rounded-lg shadow-2xs">
            <table className="w-full text-xs text-left border-collapse bg-white">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-slate-50 text-slate-900 border-b border-slate-200 font-semibold">
            {children}
          </thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-slate-100">
            {children}
          </tbody>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 font-semibold text-slate-900">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-slate-700">
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
                className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[#EA580C] font-mono text-[12px] font-medium"
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
    <div className="my-3 rounded-xl border border-slate-200 bg-[#0F172A] overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#1E293B] border-b border-slate-700/60 text-xs text-slate-300">
        <span className="font-mono text-[11px] text-[#F97316] font-semibold">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 text-xs font-mono text-slate-100 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};
