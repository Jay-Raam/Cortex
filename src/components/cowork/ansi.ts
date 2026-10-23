/**
 * Universal high-performance ANSI escape sequence parser.
 * Converts terminal escape sequences into safely styled HTML elements.
 */
export function parseAnsiToHtml(text: string): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\x1b\[0?m/g, '</span>')
    .replace(/\x1b\[1m/g, '<span class="font-bold text-white">')
    .replace(/\x1b\[31m/g, '<span class="text-rose-400 font-semibold">')
    .replace(/\x1b\[32m/g, '<span class="text-emerald-400 font-semibold">')
    .replace(/\x1b\[33m/g, '<span class="text-amber-300 font-semibold">')
    .replace(/\x1b\[34m/g, '<span class="text-sky-400 font-semibold">')
    .replace(/\x1b\[35m/g, '<span class="text-purple-400 font-semibold">')
    .replace(/\x1b\[36m/g, '<span class="text-cyan-400 font-semibold">')
    .replace(/\x1b\[90m/g, '<span class="text-slate-500">')
    .replace(/\x1b\[[0-9;]*m/g, ''); // strip any remaining ANSI codes safely
}
