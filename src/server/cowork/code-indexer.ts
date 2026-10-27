import fs from 'node:fs';
import path from 'node:path';
import { Workspace } from '../types';
import { workspaceManager } from './workspace-manager';

export interface CodeChunk {
  id: string;
  filePath: string;
  fileName: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  symbolName?: string;
  symbolType?: 'function' | 'class' | 'interface' | 'variable' | 'block';
  symbols?: Array<{ name: string; type?: 'function' | 'class' | 'interface' | 'variable' | 'block'; line: number }>;
  tokens: string[];
}

export interface CodeSearchResult {
  filePath: string;
  fileName: string;
  lineStart: number;
  lineEnd: number;
  score: number;
  confidence: number;
  snippet: string;
  symbolName?: string;
  symbolType?: string;
  matchedTokens: string[];
}

export interface IndexSummary {
  workspaceId: string;
  indexedFiles: number;
  totalChunks: number;
  durationMs: number;
  lastIndexedAt: string;
}

interface WorkspaceIndexState {
  chunks: CodeChunk[];
  docFrequencies: Map<string, number>;
  avgDocLen: number;
  mtimeMap: Map<string, number>;
  summary: IndexSummary;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.cache',
  '.turbo',
  'out',
  'workspaces',
]);

const SENSITIVE_FILE_REGEX = /^(\.env|\.pem|\.key|id_rsa|credentials\.json)/i;

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.cs',
  '.html',
  '.css',
  '.scss',
  '.json',
  '.md',
  '.sql',
  '.yaml',
  '.yml',
  '.sh',
]);

const STOPWORDS = new Set([
  'the',
  'and',
  'or',
  'if',
  'else',
  'for',
  'while',
  'do',
  'in',
  'of',
  'at',
  'by',
  'from',
  'up',
  'to',
  'with',
  'about',
  'into',
  'over',
  'after',
  'this',
  'that',
  'these',
  'those',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'const',
  'let',
  'var',
  'function',
  'return',
  'export',
  'import',
  'class',
  'interface',
  'type',
  'default',
  'async',
  'await',
  'null',
  'undefined',
  'true',
  'false',
]);

/**
 * Splits camelCase, snake_case, and code symbols into individual lowercase search tokens.
 */
export function tokenizeCode(text: string): string[] {
  if (!text) return [];

  // Split on punctuation, non-alphanumeric, and whitespace
  const rawWords = text.replace(/[^a-zA-Z0-9_$]/g, ' ').split(/\s+/);
  const tokens: string[] = [];

  for (const word of rawWords) {
    if (!word || word.length < 2) continue;

    // Split camelCase or PascalCase: "authenticateUser" -> ["authenticate", "user"]
    const subWords = word
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .toLowerCase()
      .split(' ');

    for (const sub of subWords) {
      if (sub.length >= 2 && !STOPWORDS.has(sub)) {
        tokens.push(sub);
      }
    }

    const lowerWord = word.toLowerCase();
    if (lowerWord.length >= 2 && !STOPWORDS.has(lowerWord) && !tokens.includes(lowerWord)) {
      tokens.push(lowerWord);
    }
  }

  return tokens;
}

/**
 * Production Codebase Indexer supporting BM25 lexical & semantic retrieval.
 */
export class CodebaseIndexer {
  private cache = new Map<string, WorkspaceIndexState>();

  /**
   * Scans a workspace directory and builds or updates the search index.
   */
  async indexWorkspace(workspace: Workspace): Promise<IndexSummary> {
    const startTime = Date.now();
    const wsRoot = workspaceManager.getWorkspaceRoot(workspace);

    let state = this.cache.get(workspace.id);
    if (!state) {
      state = {
        chunks: [],
        docFrequencies: new Map(),
        avgDocLen: 0,
        mtimeMap: new Map(),
        summary: {
          workspaceId: workspace.id,
          indexedFiles: 0,
          totalChunks: 0,
          durationMs: 0,
          lastIndexedAt: new Date().toISOString(),
        },
      };
    }

    const files = this.collectFiles(wsRoot);
    const newMtimeMap = new Map<string, number>();
    const retainedChunks: CodeChunk[] = [];
    const filesToChunk: string[] = [];

    for (const relPath of files) {
      const fullPath = path.join(wsRoot, relPath);
      try {
        const stats = fs.statSync(fullPath);
        const mtime = stats.mtimeMs;
        newMtimeMap.set(relPath, mtime);

        const prevMtime = state.mtimeMap.get(relPath);
        if (prevMtime && prevMtime === mtime) {
          // File has not changed, retain existing chunks
          const existing = state.chunks.filter((c) => c.filePath === relPath);
          retainedChunks.push(...existing);
        } else {
          filesToChunk.push(relPath);
        }
      } catch {}
    }

    // Chunk modified or new files
    const newlyChunked: CodeChunk[] = [];
    for (const relPath of filesToChunk) {
      const fullPath = path.join(wsRoot, relPath);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const chunks = this.chunkFile(relPath, content);
        newlyChunked.push(...chunks);
      } catch {}
    }

    const allChunks = [...retainedChunks, ...newlyChunked];

    // Compute document frequencies and average length for BM25
    const docFrequencies = new Map<string, number>();
    let totalLen = 0;

    for (const chunk of allChunks) {
      totalLen += chunk.tokens.length;
      const seenInDoc = new Set(chunk.tokens);
      for (const token of seenInDoc) {
        docFrequencies.set(token, (docFrequencies.get(token) || 0) + 1);
      }
    }

    const avgDocLen = allChunks.length > 0 ? totalLen / allChunks.length : 1;
    const durationMs = Date.now() - startTime;

    const summary: IndexSummary = {
      workspaceId: workspace.id,
      indexedFiles: files.length,
      totalChunks: allChunks.length,
      durationMs,
      lastIndexedAt: new Date().toISOString(),
    };

    state.chunks = allChunks;
    state.docFrequencies = docFrequencies;
    state.avgDocLen = avgDocLen;
    state.mtimeMap = newMtimeMap;
    state.summary = summary;

    this.cache.set(workspace.id, state);

    return summary;
  }

  /**
   * Searches the indexed codebase using BM25 scoring with symbol boost.
   */
  async search(
    workspace: Workspace,
    query: string,
    topK = 10
  ): Promise<CodeSearchResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    let state = this.cache.get(workspace.id);
    if (!state || state.chunks.length === 0) {
      await this.indexWorkspace(workspace);
      state = this.cache.get(workspace.id);
    }

    if (!state || state.chunks.length === 0) {
      return [];
    }

    const queryTokens = tokenizeCode(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const N = state.chunks.length;
    const k1 = 1.2;
    const b = 0.75;
    const avgLen = state.avgDocLen || 1;

    const scored: Array<{
      chunk: CodeChunk;
      score: number;
      matchedTokens: string[];
    }> = [];

    for (const chunk of state.chunks) {
      let score = 0;
      const matchedTokens: string[] = [];
      const chunkLen = chunk.tokens.length || 1;

      // Count term frequencies in this chunk
      const tfMap = new Map<string, number>();
      for (const token of chunk.tokens) {
        tfMap.set(token, (tfMap.get(token) || 0) + 1);
      }

      let matchedSymbolName = chunk.symbolName;
      let matchedSymbolType = chunk.symbolType;

      for (const qToken of queryTokens) {
        const tf = tfMap.get(qToken) || 0;
        if (tf > 0) {
          matchedTokens.push(qToken);
          const df = state.docFrequencies.get(qToken) || 1;
          const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
          const num = tf * (k1 + 1);
          const denom = tf + k1 * (1 - b + b * (chunkLen / avgLen));
          score += idf * (num / denom);

          // Boost if query matches any symbol declared in this chunk
          for (const s of (chunk.symbols || [])) {
            if (s.name.toLowerCase().includes(qToken)) {
              matchedSymbolName = s.name;
              matchedSymbolType = s.type;
              score += 3.5;
            }
          }

          // Boost if query matches file name
          if (chunk.fileName.toLowerCase().includes(qToken)) {
            score += 1.5;
          }
        }
      }

      if (score > 0) {
        scored.push({
          chunk: {
            ...chunk,
            symbolName: matchedSymbolName,
            symbolType: matchedSymbolType,
          },
          score,
          matchedTokens: Array.from(new Set(matchedTokens)),
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const maxScore = scored.length > 0 ? scored[0].score : 1;
    const clampedLimit = Math.max(1, Math.min(topK, 50));

    return scored.slice(0, clampedLimit).map(({ chunk, score, matchedTokens }) => {
      const confidence = Math.min(1.0, Math.round((score / maxScore) * 100) / 100);
      return {
        filePath: chunk.filePath,
        fileName: chunk.fileName,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
        score: Math.round(score * 100) / 100,
        confidence,
        snippet: chunk.content,
        symbolName: chunk.symbolName,
        symbolType: chunk.symbolType,
        matchedTokens,
      };
    });
  }

  /**
   * Chunks a single file into logical symbol blocks and windowed chunks.
   */
  chunkFile(filePath: string, content: string): CodeChunk[] {
    const lines = content.split(/\r?\n/);
    const fileName = path.basename(filePath);
    const chunks: CodeChunk[] = [];

    // Extract symbols across all lines
    const symbols: Array<{ name: string; type: CodeChunk['symbolType']; line: number }> = [];

    const funcRegex = /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/;
    const arrowFuncRegex = /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(/;
    const classRegex = /(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/;
    const ifaceRegex = /(?:export\s+)?interface\s+([a-zA-Z0-9_$]+)/;
    const pyDefRegex = /def\s+([a-zA-Z0-9_]+)\s*\(/;
    const goFuncRegex = /func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const matchFunc = line.match(funcRegex) || line.match(pyDefRegex) || line.match(goFuncRegex);
      const matchArrow = line.match(arrowFuncRegex);
      const matchClass = line.match(classRegex);
      const matchIface = line.match(ifaceRegex);

      if (matchFunc) {
        symbols.push({ name: matchFunc[1], type: 'function', line: i + 1 });
      } else if (matchArrow) {
        symbols.push({ name: matchArrow[1], type: 'function', line: i + 1 });
      } else if (matchClass) {
        symbols.push({ name: matchClass[1], type: 'class', line: i + 1 });
      } else if (matchIface) {
        symbols.push({ name: matchIface[1], type: 'interface', line: i + 1 });
      }
    }

    // Windowed chunking with 40 lines per chunk and 10 lines overlap
    const windowSize = 40;
    const overlap = 10;
    const step = windowSize - overlap;

    for (let start = 0; start < lines.length; start += step) {
      const end = Math.min(lines.length, start + windowSize);
      const chunkLines = lines.slice(start, end);
      const chunkContent = chunkLines.join('\n').trim();

      if (chunkContent.length > 0) {
        const chunkSymbols = symbols.filter((s) => s.line >= start + 1 && s.line <= end);
        const primarySymbol = chunkSymbols[0] || symbols.filter((s) => s.line <= end).pop();

        const symbolNamesText = symbols.map((s) => s.name).join(' ');
        const tokens = tokenizeCode(chunkContent + ' ' + fileName + ' ' + symbolNamesText);
        chunks.push({
          id: `${filePath}_${start + 1}_${end}`,
          filePath,
          fileName,
          lineStart: start + 1,
          lineEnd: end,
          content: chunkContent,
          symbolName: primarySymbol?.name,
          symbolType: primarySymbol?.type,
          symbols: chunkSymbols.length > 0 ? chunkSymbols : (primarySymbol ? [primarySymbol] : []),
          tokens,
        });
      }

      if (end >= lines.length) break;
    }

    return chunks;
  }

  /**
   * Recursively discovers all indexable source code files in a workspace directory.
   */
  private collectFiles(dir: string, baseDir = dir): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          results.push(...this.collectFiles(fullPath, baseDir));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext) && !SENSITIVE_FILE_REGEX.test(entry.name)) {
          results.push(relPath);
        }
      }
    }

    return results;
  }

  /**
   * Clears cached index for a workspace.
   */
  clearCache(workspaceId: string): void {
    this.cache.delete(workspaceId);
  }
}

export const codebaseIndexer = new CodebaseIndexer();
