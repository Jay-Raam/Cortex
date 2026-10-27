import path from 'node:path';
import fs from 'node:fs';
import { Workspace } from '../types';
import { workspaceManager } from './workspace-manager';
import { safeExecGit } from '../security/git-security';

export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ReviewCategory =
  | 'security'
  | 'code_quality'
  | 'performance'
  | 'maintainability'
  | 'test_coverage';

export type ReviewApprovalStatus =
  | 'approved'
  | 'changes_requested'
  | 'needs_security_review';

export interface ReviewFinding {
  id: string;
  category: ReviewCategory;
  severity: ReviewSeverity;
  cwe?: string;
  ruleTitle: string;
  filePath: string;
  lineNumber?: number;
  message: string;
  suggestion?: string;
  diffSnippet?: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface FileDiff {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
  addedLinesCount: number;
  deletedLinesCount: number;
}

export interface PrReviewReport {
  status: ReviewApprovalStatus;
  overallScore: number;
  totalFindings: number;
  findingsCountBySeverity: Record<ReviewSeverity, number>;
  summary: string;
  findings: ReviewFinding[];
  filesReviewedCount: number;
  markdownReport: string;
  timestamp: string;
}

/**
 * Parses unified diff string into structured FileDiff objects.
 */
export function parseUnifiedDiff(rawDiff: string): FileDiff[] {
  if (!rawDiff || rawDiff.trim().length === 0) {
    return [];
  }

  const files: FileDiff[] = [];
  const lines = rawDiff.split(/\r?\n/);
  let currentFile: Partial<FileDiff> | null = null;
  let currentHunk: DiffHunk | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git ')) {
      if (currentFile && currentFile.newPath) {
        if (currentHunk) currentFile.hunks!.push(currentHunk);
        files.push(currentFile as FileDiff);
      }

      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      currentFile = {
        oldPath: match ? match[1] : '',
        newPath: match ? match[2] : '',
        hunks: [],
        addedLinesCount: 0,
        deletedLinesCount: 0,
      };
      currentHunk = null;
    } else if (line.startsWith('--- a/')) {
      if (currentFile) currentFile.oldPath = line.substring(6);
    } else if (line.startsWith('+++ b/')) {
      if (currentFile) currentFile.newPath = line.substring(6);
    } else if (line.startsWith('@@ ')) {
      if (currentFile) {
        if (currentHunk) currentFile.hunks!.push(currentHunk);

        const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        currentHunk = {
          header: line,
          oldStart: match ? parseInt(match[1], 10) : 1,
          oldLines: match && match[2] ? parseInt(match[2], 10) : 1,
          newStart: match ? parseInt(match[3], 10) : 1,
          newLines: match && match[4] ? parseInt(match[4], 10) : 1,
          lines: [],
        };
      }
    } else if (currentHunk && currentFile) {
      currentHunk.lines.push(line);
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentFile.addedLinesCount = (currentFile.addedLinesCount || 0) + 1;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentFile.deletedLinesCount = (currentFile.deletedLinesCount || 0) + 1;
      }
    }
  }

  if (currentFile && currentFile.newPath) {
    if (currentHunk) currentFile.hunks!.push(currentHunk);
    files.push(currentFile as FileDiff);
  }

  return files;
}

/**
 * Production-grade Automated Pull Request Reviewer & Security Auditing Agent.
 */
export class PrReviewer {
  /**
   * Reviews a unified diff or extracts diff directly from the workspace repository.
   */
  async reviewWorkspaceDiff(
    workspace: Workspace,
    options: {
      rawDiff?: string;
      baseBranch?: string;
      targetBranch?: string;
    } = {}
  ): Promise<PrReviewReport> {
    let diff = options.rawDiff;

    if (!diff) {
      const wsRoot = workspaceManager.getWorkspaceRoot(workspace);
      const isGit = fs.existsSync(path.join(wsRoot, '.git'));

      if (isGit) {
        try {
          const base = options.baseBranch || 'origin/main';
          // Try git diff base...HEAD or fallback to working tree diff
          const diffRes = await safeExecGit(['diff', `${base}...HEAD`], { cwd: wsRoot });
          if (diffRes.stdout && diffRes.stdout.trim().length > 0) {
            diff = diffRes.stdout;
          } else {
            const headDiff = await safeExecGit(['diff', 'HEAD'], { cwd: wsRoot });
            diff = headDiff.stdout;
          }
        } catch {
          // If branch diff fails, grab working tree diff
          try {
            const fallbackDiff = await safeExecGit(['diff'], { cwd: wsRoot });
            diff = fallbackDiff.stdout;
          } catch {
            diff = '';
          }
        }
      }
    }

    return this.evaluateDiff(diff || '');
  }

  /**
   * Evaluates a unified diff string and executes dual-pass quality and security analysis.
   */
  evaluateDiff(rawDiff: string): PrReviewReport {
    const fileDiffs = parseUnifiedDiff(rawDiff);
    const findings: ReviewFinding[] = [];

    for (const file of fileDiffs) {
      const addedLinesWithNumbers: Array<{ lineNum: number; content: string }> = [];

      for (const hunk of file.hunks) {
        let currentLine = hunk.newStart;
        for (const line of hunk.lines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            addedLinesWithNumbers.push({
              lineNum: currentLine,
              content: line.substring(1),
            });
            currentLine++;
          } else if (!line.startsWith('-')) {
            currentLine++;
          }
        }
      }

      // 1. Security Audit Pass
      this.auditSecurity(file.newPath, addedLinesWithNumbers, findings);

      // 2. Code Quality Pass
      this.auditQuality(file.newPath, addedLinesWithNumbers, findings);
    }

    // Compute metrics
    const findingsCountBySeverity: Record<ReviewSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const f of findings) {
      findingsCountBySeverity[f.severity] = (findingsCountBySeverity[f.severity] || 0) + 1;
    }

    let score = 100;
    score -= findingsCountBySeverity.critical * 30;
    score -= findingsCountBySeverity.high * 15;
    score -= findingsCountBySeverity.medium * 5;
    score -= findingsCountBySeverity.low * 2;
    score -= findingsCountBySeverity.info * 1;
    score = Math.max(0, Math.min(100, score));

    let status: ReviewApprovalStatus = 'approved';
    if (findingsCountBySeverity.critical > 0) {
      status = 'needs_security_review';
    } else if (findingsCountBySeverity.high > 0 || score < 75) {
      status = 'changes_requested';
    }

    const summary = this.generateSummary(status, score, findings.length, fileDiffs.length, findingsCountBySeverity);
    const markdownReport = this.generateMarkdownReport(
      status,
      score,
      summary,
      findings,
      fileDiffs
    );

    return {
      status,
      overallScore: score,
      totalFindings: findings.length,
      findingsCountBySeverity,
      summary,
      findings,
      filesReviewedCount: fileDiffs.length,
      markdownReport,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Pass 1: Security Audit Rule Evaluator (OWASP / CWE patterns).
   */
  private auditSecurity(
    filePath: string,
    addedLines: Array<{ lineNum: number; content: string }>,
    findings: ReviewFinding[]
  ): void {
    for (const { lineNum, content } of addedLines) {
      // Rule 1: Command Injection (CWE-78)
      if (
        (/(?:exec|execSync|spawn)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+|[a-zA-Z0-9_]+)/i.test(content)) &&
        !/safeExec|require\(['"]child_process['"]\)|import\s/i.test(content)
      ) {
        findings.push({
          id: `sec_cmd_inject_${filePath}_${lineNum}`,
          category: 'security',
          severity: 'critical',
          cwe: 'CWE-78: OS Command Injection',
          ruleTitle: 'Unsanitized Shell Execution with String Interpolation or Variable',
          filePath,
          lineNumber: lineNum,
          message: 'Passing untrusted command expressions or variables directly to shell execution functions can enable arbitrary Remote Code Execution.',
          suggestion: 'Replace shell execution with safe argument arrays using execFile or safeExecGit({ shell: false }).',
          diffSnippet: content,
        });
      }

      // Rule 2: SQL Injection (CWE-89)
      if (
        /(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+.*(?:['"]\s*\+|\$\{[a-zA-Z0-9_]+\})/i.test(content) &&
        !/prepare|parameterized/i.test(content)
      ) {
        findings.push({
          id: `sec_sqli_${filePath}_${lineNum}`,
          category: 'security',
          severity: 'high',
          cwe: 'CWE-89: SQL Injection',
          ruleTitle: 'Raw String Concatenation in Database Query',
          filePath,
          lineNumber: lineNum,
          message: 'Constructing SQL query strings via raw concatenation exposes database records to SQL injection attacks.',
          suggestion: 'Use parameterized queries, prepared statements, or ORM parameter binding.',
          diffSnippet: content,
        });
      }

      // Rule 3: Cross-Site Scripting (CWE-79)
      if (
        (/dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/i.test(content) ||
          /\.innerHTML\s*=\s*/i.test(content) ||
          /document\.write\s*\(/i.test(content)) &&
        !/sanitize|DOMPurify|escapeHtml/i.test(content)
      ) {
        findings.push({
          id: `sec_xss_${filePath}_${lineNum}`,
          category: 'security',
          severity: 'high',
          cwe: 'CWE-79: Cross-Site Scripting (XSS)',
          ruleTitle: 'Unsanitized Direct HTML Rendering',
          filePath,
          lineNumber: lineNum,
          message: 'Injecting raw HTML directly into the DOM without sanitization allows execution of malicious JavaScript payloads.',
          suggestion: 'Sanitize HTML input using DOMPurify or safe markdown schema before rendering.',
          diffSnippet: content,
        });
      }

      // Rule 4: Hardcoded Credentials & API Keys (CWE-798)
      const secretMatch =
        content.match(/(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]([a-zA-Z0-9_=-]{16,})['"]/i) ||
        content.match(/(?:ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|sk-or-[a-zA-Z0-9_-]{48})/);

      if (secretMatch && !/process\.env|mock|placeholder|dummy|example/i.test(content)) {
        findings.push({
          id: `sec_secret_${filePath}_${lineNum}`,
          category: 'security',
          severity: 'critical',
          cwe: 'CWE-798: Hardcoded Credentials',
          ruleTitle: 'High-Entropy Secret or Token Hardcoded in Source',
          filePath,
          lineNumber: lineNum,
          message: 'Hardcoded secrets and API keys committed to source control can be extracted by attackers.',
          suggestion: 'Load credentials dynamically from environment variables (process.env) or secret stores.',
          diffSnippet: content.slice(0, 80),
        });
      }

      // Rule 5: Path Traversal (CWE-22)
      if (
        /fs\.(?:readFile|readFileSync|createReadStream)\s*\(\s*(?:req\.params|req\.query|req\.body)/i.test(content) &&
        !/path\.resolve|canonicalize|validate/i.test(content)
      ) {
        findings.push({
          id: `sec_path_${filePath}_${lineNum}`,
          category: 'security',
          severity: 'high',
          cwe: 'CWE-22: Path Traversal',
          ruleTitle: 'Unvalidated Request Path in Filesystem Operation',
          filePath,
          lineNumber: lineNum,
          message: 'Directly passing untrusted user input to filesystem APIs allows arbitrary file access and directory traversal.',
          suggestion: 'Validate paths with path.resolve and enforce strict workspace boundary checks.',
          diffSnippet: content,
        });
      }

      // Rule 6: ReDoS Vulnerability (CWE-1333)
      if (/new\s+RegExp\s*\([^)]*\([a-zA-Z0-9_.]+\+[)]\+/i.test(content)) {
        findings.push({
          id: `sec_redos_${filePath}_${lineNum}`,
          category: 'security',
          severity: 'medium',
          cwe: 'CWE-1333: Regular Expression Denial of Service',
          ruleTitle: 'Catastrophic Backtracking Regular Expression Pattern',
          filePath,
          lineNumber: lineNum,
          message: 'Nested quantifiers in regular expressions can cause exponential CPU exhaustion when evaluating adversarial input.',
          suggestion: 'Simplify regex expression and validate with safe regex bounds.',
          diffSnippet: content,
        });
      }

      // Rule 7: Dynamic Code Evaluation (CWE-94)
      if (/(?:eval|Function)\s*\([^)]+\)/i.test(content)) {
        findings.push({
          id: `sec_eval_${filePath}_${lineNum}`,
          category: 'security',
          severity: 'critical',
          cwe: 'CWE-94: Code Injection',
          ruleTitle: 'Dynamic Code Evaluation via eval or Function Constructor',
          filePath,
          lineNumber: lineNum,
          message: 'Executing dynamically evaluated code can lead to arbitrary code execution and sandbox escapes.',
          suggestion: 'Refactor code to avoid dynamic eval and constructor invocations.',
          diffSnippet: content,
        });
      }
    }
  }

  /**
   * Pass 2: Code Quality and Maintainability Evaluator.
   */
  private auditQuality(
    filePath: string,
    addedLines: Array<{ lineNum: number; content: string }>,
    findings: ReviewFinding[]
  ): void {
    for (const { lineNum, content } of addedLines) {
      // Empty Catch Block
      if (/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(content)) {
        findings.push({
          id: `qual_catch_${filePath}_${lineNum}`,
          category: 'code_quality',
          severity: 'medium',
          ruleTitle: 'Empty Catch Block Silently Suppressing Errors',
          filePath,
          lineNumber: lineNum,
          message: 'Empty catch blocks swallow runtime exceptions, making debugging and production recovery difficult.',
          suggestion: 'Log the trapped error or rethrow a standardized application error.',
          diffSnippet: content,
        });
      }

      // TODO/FIXME Technical Debt Marker
      if (/\/\/\s*(?:TODO|FIXME|HACK):/i.test(content)) {
        findings.push({
          id: `qual_todo_${filePath}_${lineNum}`,
          category: 'maintainability',
          severity: 'info',
          ruleTitle: 'Unresolved Technical Debt Marker (TODO / FIXME)',
          filePath,
          lineNumber: lineNum,
          message: 'A technical debt marker was committed. Verify whether this requires an issue tracker ticket.',
          suggestion: 'Resolve the outstanding debt or track it in a dedicated GitHub Issue.',
          diffSnippet: content,
        });
      }

      // Accidental console.log
      if (/console\.log\s*\(/i.test(content) && !filePath.includes('test') && !filePath.includes('cli')) {
        findings.push({
          id: `qual_console_${filePath}_${lineNum}`,
          category: 'code_quality',
          severity: 'low',
          ruleTitle: 'Console Debug Statement in Production Code',
          filePath,
          lineNumber: lineNum,
          message: 'Raw console.log statements can pollute stdout logs and may degrade runtime throughput.',
          suggestion: 'Remove debug console.log or use a structured logging utility.',
          diffSnippet: content,
        });
      }
    }
  }

  private generateSummary(
    status: ReviewApprovalStatus,
    score: number,
    totalFindings: number,
    filesCount: number,
    bySeverity: Record<ReviewSeverity, number>
  ): string {
    const statusMap = {
      approved: '✅ Approved for Merge',
      changes_requested: '⚠️ Changes Requested (Quality/Security Standards Not Met)',
      needs_security_review: '🛑 Blocked (Critical Security Findings Detected)',
    };

    return [
      `Review Decision: ${statusMap[status]}.`,
      `Quality & Security Score: ${score}/100.`,
      `Analyzed ${filesCount} file(s) with ${totalFindings} finding(s):`,
      `[Critical: ${bySeverity.critical}, High: ${bySeverity.high}, Medium: ${bySeverity.medium}, Low: ${bySeverity.low}, Info: ${bySeverity.info}].`,
    ].join(' ');
  }

  private generateMarkdownReport(
    status: ReviewApprovalStatus,
    score: number,
    summary: string,
    findings: ReviewFinding[],
    fileDiffs: FileDiff[]
  ): string {
    const badge =
      status === 'approved'
        ? '🟢 **PASSED / APPROVED**'
        : status === 'changes_requested'
        ? '🟠 **CHANGES REQUESTED**'
        : '🔴 **SECURITY AUDIT BLOCKED**';

    const lines: string[] = [
      `# Cortex AI — Pull Request Quality & Security Audit`,
      ``,
      `### Review Status: ${badge} | Score: **${score}/100**`,
      ``,
      `> ${summary}`,
      ``,
      `---`,
      ``,
      `### Files Evaluated (${fileDiffs.length})`,
    ];

    if (fileDiffs.length === 0) {
      lines.push(`_No file changes detected in provided diff._`);
    } else {
      for (const f of fileDiffs) {
        lines.push(`- \`${f.newPath}\` (+${f.addedLinesCount} / -${f.deletedLinesCount})`);
      }
    }

    lines.push(``, `---`, ``, `### Audit Findings (${findings.length})`, ``);

    if (findings.length === 0) {
      lines.push(`🎉 **Zero security vulnerabilities or quality violations detected. Code is ready for merge!**`);
    } else {
      lines.push(
        `| Severity | Category | Rule & CWE | File : Line | Remediation |`,
        `| :---: | :---: | :--- | :--- | :--- |`
      );

      for (const f of findings) {
        const sevEmoji = {
          critical: '🔴 Critical',
          high: '🟠 High',
          medium: '🟡 Medium',
          low: '🔵 Low',
          info: '⚪ Info',
        }[f.severity];

        lines.push(
          `| ${sevEmoji} | ${f.category} | **${f.ruleTitle}**<br>${f.cwe || ''} | \`${f.filePath}:${f.lineNumber || '?'}\` | ${f.suggestion || f.message} |`
        );
      }
    }

    return lines.join('\n');
  }
}

export const prReviewer = new PrReviewer();
