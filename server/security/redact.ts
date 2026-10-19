/** Removes secrets and personal data from objects before they are logged or audited. */

const SECRET_KEY = /pass(word)?|secret|token|api[-_]?key|authori[sz]ation|cookie|private[-_]?key|client[-_]?secret|credential|signature|hmac/i;
const PII_KEY = /^(e-?mail|phone|telephone|first[-_]?name|last[-_]?name|full[-_]?name|address|message|comment_body|company_contact)$/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function redact<T>(value: T, depth = 0): T {
  if (depth > 6) return '[depth]' as T;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return (value.length > 2000 ? `${value.slice(0, 2000)}…` : value) as T;
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => redact(v, depth + 1)) as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) out[k] = v ? '[redacted]' : v;
      else if (PII_KEY.test(k)) out[k] = v ? '[personal data removed]' : v;
      else out[k] = redact(v, depth + 1);
    }
    return out as T;
  }
  return value;
}

/** Masks e-mail addresses inside free text (e.g. error messages from third parties). */
export function maskEmails(s: string): string {
  return s.replace(EMAIL, '[email]');
}

/** Error text safe for storage and display: no secrets in URLs, no e-mail addresses, bounded length. */
export function safeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return maskEmails(raw)
    .replace(/(access_token|api_key|key|token|signature)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]')
    .slice(0, 500);
}
