/**
 * FlexiDash Audit Metadata Sanitizer & Redactor
 *
 * CRITICAL SECURITY INVARIANT:
 * Passwords, bearer tokens, API secrets, and sensitive authentication material
 * must NEVER be persisted in plaintext audit logs.
 */

const REDACTED_VALUE = '[REDACTED]';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /bearer/i,
  /cookie/i,
  /apiKey/i,
  /api_key/i,
  /privateKey/i,
  /creditCard/i,
  /ssn/i,
];

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const cleanObject = (obj: any, depth = 0): any => {
    if (depth > 6) return '[MAX_DEPTH_REACHED]';
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => cleanObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (isSensitiveKey(key)) {
          sanitized[key] = REDACTED_VALUE;
        } else if (typeof value === 'string' && value.startsWith('Bearer ')) {
          sanitized[key] = REDACTED_VALUE;
        } else if (typeof value === 'object') {
          sanitized[key] = cleanObject(value, depth + 1);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return obj;
  };

  return cleanObject(metadata);
}

