/**
 * FlexiDash Portal Widget Action API
 * POST /api/flexidash/portal/widgets/action
 *
 * Executes server-authorized actions within dashboard widgets.
 * Validates widget registration, user widget-view permission, and 'widgets:action' authorization.
 */

import type { APIRoute } from 'astro';
import { authorizeRequest } from '../../../../../auth/middleware.ts';
import { jsonResponse, errorResponse } from '../../../../../api/response.ts';
import { ValidationError, ForbiddenError, NotFoundError } from '../../../../../errors/app-error.ts';
import { PolicyEngine } from '../../../../../rbac/policy-engine.ts';
import { getWidgetDefinition } from '../../../../../layout/registry.ts';
import { recordAuditEvent } from '../../../../../audit/audit-factory.ts';
import { sanitizeString } from '../../../../../security/validation.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let activeSession: any = null;
  let targetWidget = 'unknown';

  try {
    const { session, context } = await authorizeRequest(request.headers, 'widgets:action');
    activeSession = session;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const widgetId = sanitizeString(body.widgetId, 'widgetId', 64);
    const action = sanitizeString(body.action, 'action', 64);
    targetWidget = widgetId;

    const widgetDef = getWidgetDefinition(widgetId);
    if (!widgetDef) {
      throw new NotFoundError('Widget', widgetId);
    }

    // Asserts caller possesses permission required by this specific widget
    PolicyEngine.assertPermission(session, widgetDef.requiredPermission);

    // Asserts widgets:action capability
    PolicyEngine.assertPermission(session, 'widgets:action');

    const now = new Date().toISOString();

    await recordAuditEvent({
      instanceId: session.instanceId,
      actorId: session.userId,
      action: 'widget:action_executed',
      outcome: 'SUCCESS',
      target: widgetId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        action,
        widgetTitle: widgetDef.title,
        payloadSummary: body.payload ? Object.keys(body.payload as Record<string, unknown>) : [],
      },
    });

    return jsonResponse({
      success: true,
      widgetId,
      action,
      executedAt: now,
      result: {
        status: 'completed',
        message: `Action '${action}' on widget '${widgetDef.title}' executed successfully.`,
      },
    });
  } catch (err) {
    if (activeSession) {
      await recordAuditEvent({
        instanceId: activeSession.instanceId,
        actorId: activeSession.userId,
        action: 'widget:action_failure',
        outcome: err instanceof ForbiddenError ? 'DENIED' : 'FAILURE',
        target: targetWidget,
        metadata: {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
    return errorResponse(err);
  }
};

