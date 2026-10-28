/**
 * FlexiDash Authentication API: Login Endpoint
 * POST /api/flexidash/auth/login
 */

import type { APIRoute } from 'astro';
import { getAuthProvider } from '../../../../auth/auth-factory.ts';
import { getAppConfig } from '../../../../config/env.ts';
import { toInstanceId } from '../../../../models/identity.ts';
import { jsonResponse, errorResponse } from '../../../../api/response.ts';
import { ValidationError, UnauthorizedError, RateLimitExceededError } from '../../../../errors/app-error.ts';
import type { AuthContext } from '../../../../auth/types.ts';
import { recordAuditEvent } from '../../../../audit/audit-factory.ts';
import { getRateLimiter } from '../../../../security/rate-limiter.ts';
import { validateEmail, validatePassword } from '../../../../security/validation.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let instanceId = toInstanceId('00000000-0000-0000-0000-000000000000');
  let attemptTarget = 'unknown';
  let context: AuthContext = { instanceId };

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const { email, password } = body;
    const cleanEmail = validateEmail(email);
    const cleanPassword = validatePassword(password, 6);
    attemptTarget = cleanEmail;

    const config = getAppConfig();
    const instanceHeader = request.headers.get('x-wix-instance-id');
    instanceId = toInstanceId(instanceHeader || config.wixClientInstanceId);

    context = {
      instanceId,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    };

    // Rate limiting: 10 attempts per minute per tenant+IP/email
    const rateLimitKey = `login:${instanceId}:${context.ipAddress || cleanEmail}`;
    const rateLimit = await getRateLimiter().check(rateLimitKey, 10, 60);
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      throw new RateLimitExceededError(
        'Too many failed login attempts. Please wait before trying again.',
        { retryAfter: Math.max(1, retryAfter) }
      );
    }

    const provider = getAuthProvider();
    const result = await provider.login({ email: cleanEmail, password: cleanPassword }, context);

    if (!result.success || !result.flexidashJwt) {
      await recordAuditEvent({
        instanceId,
        action: 'auth:login_failure',
        outcome: 'FAILURE',
        target: cleanEmail,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { reason: result.errorMessage || 'Invalid credentials' },
      });
      throw new UnauthorizedError(result.errorMessage || 'Invalid credentials');
    }

    await recordAuditEvent({
      instanceId,
      actorId: result.session?.userId,
      action: 'auth:login',
      outcome: 'SUCCESS',
      target: cleanEmail,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { roles: result.session?.roles },
    });

    return jsonResponse({
      success: true,
      token: result.flexidashJwt,
      session: result.session,
    });
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) {
      await recordAuditEvent({
        instanceId,
        action: 'auth:login_failure',
        outcome: 'FAILURE',
        target: attemptTarget,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: { error: err instanceof Error ? err.message : 'Unknown error' },
      });
    }
    return errorResponse(err);
  }
};

