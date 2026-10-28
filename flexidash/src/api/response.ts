/**
 * FlexiDash Standardized HTTP API Response Utilities
 */

import { AppError } from '../errors/app-error.ts';

export function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    const extraHeaders: Record<string, string> = {};
    if (error.statusCode === 429 && typeof error.details?.retryAfter === 'number') {
      extraHeaders['Retry-After'] = String(error.details.retryAfter);
    }
    return jsonResponse(error.toJSON(), error.statusCode, extraHeaders);
  }

  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd
    ? 'An unexpected internal error occurred'
    : error instanceof Error
      ? error.message
      : 'An unexpected internal error occurred';

  if (isProd) {
    console.error('[InternalError]', error);
  }

  return jsonResponse(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    },
    500
  );
}

