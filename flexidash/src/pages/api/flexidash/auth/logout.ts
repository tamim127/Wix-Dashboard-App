/**
 * FlexiDash Authentication API: Logout Endpoint
 * POST /api/flexidash/auth/logout
 */

import type { APIRoute } from 'astro';
import { authorizeRequest } from '../../../../auth/middleware.ts';
import { getAuthProvider } from '../../../../auth/auth-factory.ts';
import { jsonResponse, errorResponse } from '../../../../api/response.ts';
import { recordAuditEvent } from '../../../../audit/audit-factory.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { session, context } = await authorizeRequest(request.headers);
    const provider = getAuthProvider();
    await provider.logout(session, context);

    await recordAuditEvent({
      instanceId: session.instanceId,
      actorId: session.userId,
      action: 'auth:logout',
      outcome: 'SUCCESS',
      target: session.userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return jsonResponse({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    return errorResponse(err);
  }
};

