/**
 * FlexiDash Portal Layout API: Reset to Site Default
 * POST /api/flexidash/portal/layout/reset
 */

import type { APIRoute } from 'astro';
import { authorizeRequest } from '../../../../../auth/middleware.ts';
import { jsonResponse, errorResponse } from '../../../../../api/response.ts';
import { getLayoutStorageAdapter } from '../../../../../layout/storage/storage-factory.ts';
import { recordAuditEvent } from '../../../../../audit/audit-factory.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { session } = await authorizeRequest(request.headers, 'dashboard:view');
    const storage = getLayoutStorageAdapter();

    // Delete user custom layout if one exists
    await storage.deleteLayout(session.instanceId, session.userId);

    // Fetch site default layout
    const defaultLayout = await storage.getLayout(session.instanceId);

    await recordAuditEvent({
      instanceId: session.instanceId,
      actorId: session.userId,
      action: 'layout:reset',
      outcome: 'SUCCESS',
      target: session.userId,
      metadata: {
        resetBy: session.userId,
      },
    });

    return jsonResponse({
      success: true,
      message: 'Layout successfully reset to site default',
      layout: defaultLayout,
    });
  } catch (err) {
    return errorResponse(err);
  }
};
