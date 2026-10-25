/**
 * Cortex AI - ReDoS (Regular Expression Denial of Service) Security Validator
 *
 * Implements static complexity analysis and runtime safeguards against
 * catastrophic backtracking patterns (CWE-1333) and unbounded regex loops (CWE-835).
 */

export const MAX_REGEX_PATTERN_LENGTH = 500;
export const MAX_REGEX_EXECUTION_MS = 2000;

export interface RegexValidationResult {
  safe: boolean;
  reason?: string;
}

/**
 * Catastrophic backtracking patterns containing nested repetition quantifiers.
 */
const CATASTROPHIC_PATTERNS: RegExp[] = [
  // Group with quantifier followed by outer quantifier, e.g. (a+)+, (a*)*, (a+)*, (a?)+
  /\([^)]*[*+?]\)[*+?{]/,
  // Character class with quantifier followed by outer quantifier, e.g. ([a-z]+)+, ([\w]+)*
  /\(\[[^\]]+\][*+?]\)[*+?{]/,
  // Double quantifiers directly adjacent, e.g. a++, a**
  /[*+?]{2,}/,
  // Nested groups with quantifiers, e.g. ((a+)+)
  /\(\([^)]+\)[*+?]\)[*+?]/,
  // Alternation with quantifiers inside outer quantifier, e.g. (a|b+)+ or (a+|b)+
  /\([^)]*\|[^)]*[*+?][^)]*\)[*+?{]/,
  /\([^)]*[*+?][^)]*\|[^)]*\)[*+?{]/,
];

/**
 * Validates a user-supplied regular expression pattern against ReDoS vectors.
 */
export function validateSafeRegex(pattern: string): RegexValidationResult {
  if (typeof pattern !== 'string') {
    return { safe: false, reason: 'Regular expression pattern must be a string.' };
  }

  if (pattern.length === 0) {
    return { safe: false, reason: 'Regular expression pattern cannot be empty.' };
  }

  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    return {
      safe: false,
      reason: `Regular expression pattern exceeds maximum length of ${MAX_REGEX_PATTERN_LENGTH} characters.`,
    };
  }

  // Verify balanced parentheses and group nesting depth
  let depth = 0;
  let maxDepth = 0;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      i++; // Skip escaped character
      continue;
    }
    if (ch === '(') {
      depth++;
      if (depth > maxDepth) maxDepth = depth;
    } else if (ch === ')') {
      depth--;
      if (depth < 0) {
        return { safe: false, reason: 'Unbalanced parentheses in regular expression.' };
      }
    }
  }

  if (depth !== 0) {
    return { safe: false, reason: 'Unbalanced parentheses in regular expression.' };
  }

  if (maxDepth > 4) {
    return {
      safe: false,
      reason: `Regular expression exceeds maximum group nesting depth (${maxDepth} > 4).`,
    };
  }

  // Check for known catastrophic backtracking patterns
  for (const regex of CATASTROPHIC_PATTERNS) {
    if (regex.test(pattern)) {
      return {
        safe: false,
        reason: 'Potentially vulnerable regular expression pattern detected (nested repetition or catastrophic backtracking risk).',
      };
    }
  }

  // Check for literal overlapping alternations with outer quantifier, e.g. (a|aa)+
  const alternationMatch = pattern.match(/\(([^|()]+)\|([^|()]+)\)[*+]/);
  if (alternationMatch) {
    const alt1 = alternationMatch[1];
    const alt2 = alternationMatch[2];
    if (alt1.startsWith(alt2) || alt2.startsWith(alt1)) {
      return {
        safe: false,
        reason: 'Potentially vulnerable regular expression pattern detected (overlapping alternation with repetition quantifier).',
      };
    }
  }

  // Verify syntax compiles cleanly
  try {
    new RegExp(pattern);
  } catch (err: any) {
    return { safe: false, reason: `Invalid regular expression syntax: ${err.message}` };
  }

  return { safe: true };
}
