import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

/**
 * Strict schema for safe GitHub Flavored Markdown (GFM) and code highlighting.
 * Permits styling and code block classes while strictly blocking XSS attack vectors.
 */
export const safeMarkdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    span: [...(defaultSchema.attributes?.span || []), 'className'],
    div: [...(defaultSchema.attributes?.div || []), 'className'],
    th: [...(defaultSchema.attributes?.th || []), 'align', 'className'],
    td: [...(defaultSchema.attributes?.td || []), 'align', 'className'],
    a: ['href', 'title', 'target', 'rel'],
  },
  clobberPrefix: 'cortex-content-',
  clobber: ['name', 'id'],
};

/**
 * Checks whether an untrusted string contains known high-risk XSS injection vectors.
 */
export function containsDangerousXssVectors(content: unknown): boolean {
  if (typeof content !== 'string' || !content.trim()) return false;
  const lower = content.toLowerCase();

  const dangerousTags = [
    /<script[\s>]/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
    /<form[\s>]/i,
    /<base[\s>]/i,
    /<meta[\s>]/i,
  ];

  const dangerousAttributes = [
    /\bon[a-z]+\s*=/i, // onload=, onerror=, onclick=, etc.
    /href\s*=\s*['"]?\s*javascript:/i,
    /src\s*=\s*['"]?\s*javascript:/i,
    /data:\s*text\/html/i,
  ];

  return (
    dangerousTags.some((pattern) => pattern.test(lower)) ||
    dangerousAttributes.some((pattern) => pattern.test(lower))
  );
}

/**
 * Defense-in-depth sanitization: strips raw dangerous executable tags and attributes
 * before parsing into AST.
 */
export function sanitizeMarkdownContent(rawMarkdown: unknown): string {
  if (typeof rawMarkdown !== 'string') return '';
  if (!rawMarkdown) return '';

  return rawMarkdown
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\bon[a-z]+\s*=\s*(['"]).*?\1/gi, '') // strip onerror="..."
    .replace(/\bon[a-z]+\s*=\s*[^>\s]+/gi, '') // strip unquoted onerror=alert(1)
    .replace(/href\s*=\s*(['"])\s*javascript:.*?\1/gi, 'href="#"')
    .replace(/src\s*=\s*(['"])\s*javascript:.*?\1/gi, 'src=""');
}
