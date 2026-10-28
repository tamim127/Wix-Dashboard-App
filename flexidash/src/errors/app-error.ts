/**
 * FlexiDash Standardized Application Errors
 *
 * Provides structured error codes, HTTP status mapping, and sanitized error serialization.
 */

export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public abstract readonly errorCode: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    (Error as unknown as { captureStackTrace?: (target: object, fn: unknown) => void }).captureStackTrace?.(this, this.constructor);
  }

  public toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.errorCode,
        message: this.message,
        details: this.sanitizeDetails(this.details),
      },
    };
  }

  private sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!details) return undefined;
    const sensitiveKeys = ['password', 'secret', 'token', 'authorization', 'cookie', 'jwt'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}

export class UnauthorizedError extends AppError {
  public readonly statusCode = 401;
  public readonly errorCode = 'UNAUTHORIZED';

  constructor(message = 'Authentication required to access this resource', details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class ForbiddenError extends AppError {
  public readonly statusCode = 403;
  public readonly errorCode = 'FORBIDDEN';

  constructor(message = 'You do not have permission to perform this action', details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class TenantMismatchError extends AppError {
  public readonly statusCode = 403;
  public readonly errorCode = 'TENANT_MISMATCH';

  constructor(message = 'Access to resources outside the verified installation context is prohibited', details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  public readonly errorCode = 'NOT_FOUND';

  constructor(resourceName: string, id?: string) {
    super(`${resourceName} ${id ? `with identifier '${id}' ` : ''}was not found`, { resourceName, id });
  }
}

export class ValidationError extends AppError {
  public readonly statusCode = 400;
  public readonly errorCode = 'VALIDATION_FAILED';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class IdentityMappingError extends AppError {
  public readonly statusCode = 422;
  public readonly errorCode = 'IDENTITY_MAPPING_FAILED';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class RateLimitExceededError extends AppError {
  public readonly statusCode = 429;
  public readonly errorCode = 'RATE_LIMIT_EXCEEDED';

  constructor(message = 'Too many requests. Please slow down and try again later.', details?: Record<string, unknown>) {
    super(message, details);
  }
}

export class ConflictError extends AppError {
  public readonly statusCode = 409;
  public readonly errorCode = 'CONFLICT';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}
