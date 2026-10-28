/**
 * FlexiDash Wix App Lifecycle Webhook Endpoint
 * POST /api/flexidash/webhooks/app-lifecycle
 *
 * Receives and processes official Wix app lifecycle events:
 * - App Installed (wix.app.installed)
 * - App Uninstalled (wix.app.removed)
 * - Paid Plan Changed (wix.app.plan_changed)
 */

import type { APIRoute } from 'astro';
import { jsonResponse, errorResponse } from '../../../../api/response.ts';
import { ValidationError, UnauthorizedError, RateLimitExceededError } from '../../../../errors/app-error.ts';
import { AppLifecycleService } from '../../../../tenant/lifecycle-service.ts';
import { parseAndVerifyWixInstance } from '../../../../auth/wix-instance-validator.ts';
import { getAppConfig } from '../../../../config/env.ts';
import { toInstanceId } from '../../../../models/identity.ts';
import { sanitizeString } from '../../../../security/validation.ts';
import { getRateLimiter } from '../../../../security/rate-limiter.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    // 0. Rate limiting: 60 requests per minute per IP
    const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = await getRateLimiter().check(`webhook:${clientIp}`, 60, 60);
    if (!rateLimit.allowed) {
      const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      throw new RateLimitExceededError(
        'Webhook rate limit exceeded. Too many lifecycle requests.',
        { retryAfter: Math.max(1, retryAfter) }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const config = getAppConfig();

    // 1. Resolve instance authentication
    // Check either direct signed instance header, body instanceToken, or verified webhook signature
    const instanceHeader = request.headers.get('x-wix-instance') || (typeof body.instanceToken === 'string' ? body.instanceToken : null);

    let instanceIdStr: string | null = null;

    if (instanceHeader) {
      const verified = parseAndVerifyWixInstance(instanceHeader, config.wixClientSecret || config.jwtSecret);
      instanceIdStr = verified.instanceId;
    } else if (body.instanceId && typeof body.instanceId === 'string') {
      // Production fail-closed security: unverified body.instanceId is strictly prohibited in production
      if (config.nodeEnv === 'production') {
        throw new UnauthorizedError(
          'Unsigned webhook requests with raw instanceId are strictly prohibited in production mode. Provide a signed x-wix-instance header or instanceToken.'
        );
      }
      instanceIdStr = sanitizeString(body.instanceId, 'instanceId', 64);
    } else {
      throw new UnauthorizedError("Missing verified 'instanceId' context in webhook request");
    }

    const typedInstanceId = toInstanceId(instanceIdStr);
    const eventType = String(body.eventType || body.eventName || body.event || 'wix.app.installed').toLowerCase();

    let result: unknown = null;

    switch (eventType) {
      case 'wix.app.installed':
      case 'appinstalled':
      case 'app_installed': {
        const config = await AppLifecycleService.handleAppInstalled({
          instanceId: typedInstanceId,
          appDefId: typeof body.appDefId === 'string' ? body.appDefId : undefined,
          planId: typeof body.planId === 'string' ? body.planId : 'free',
          siteDisplayName: typeof body.siteDisplayName === 'string' ? body.siteDisplayName : undefined,
          siteUrl: typeof body.siteUrl === 'string' ? body.siteUrl : undefined,
        });
        result = { status: 'installed', config };
        break;
      }

      case 'wix.app.removed':
      case 'wix.app.uninstalled':
      case 'appuninstalled':
      case 'app_removed': {
        const config = await AppLifecycleService.handleAppUninstalled({
          instanceId: typedInstanceId,
          appDefId: typeof body.appDefId === 'string' ? body.appDefId : undefined,
        });
        result = { status: 'uninstalled', config };
        break;
      }

      case 'wix.app.plan_changed':
      case 'apppaidplanchanged':
      case 'plan_changed': {
        const planId = typeof body.planId === 'string' ? body.planId : 'standard';
        const config = await AppLifecycleService.handlePlanChanged({
          instanceId: typedInstanceId,
          planId,
        });
        result = { status: 'plan_updated', config };
        break;
      }

      default:
        throw new ValidationError(`Unsupported lifecycle event type: '${eventType}'`);
    }

    return jsonResponse({
      success: true,
      event: eventType,
      instanceId: typedInstanceId,
      result,
    });
  } catch (err) {
    return errorResponse(err);
  }
};
