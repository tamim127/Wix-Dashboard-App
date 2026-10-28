/**
 * FlexiDash Portal Layout API: Layout Discovery, Customization & Persistence
 * GET /api/flexidash/portal/layout — Retrieve permitted layout & widgets
 * POST /api/flexidash/portal/layout — Persist validated custom or site layout
 * PUT /api/flexidash/portal/layout — Idempotent update alias
 */

import type { APIRoute } from 'astro';
import { authorizeRequest } from '../../../../auth/middleware.ts';
import { jsonResponse, errorResponse } from '../../../../api/response.ts';
import { getLayoutStorageAdapter } from '../../../../layout/storage/storage-factory.ts';
import {
  validateLayout,
  getPermittedWidgets,
  WIDGET_REGISTRY,
  createDefaultSiteLayout,
} from '../../../../layout/registry.ts';
import type { DashboardLayout } from '../../../../layout/types.ts';
import {
  ValidationError,
  ForbiddenError,
  TenantMismatchError,
} from '../../../../errors/app-error.ts';
import { SYSTEM_ROLE_ADMIN, SYSTEM_ROLE_OWNER } from '../../../../models/rbac.ts';
import { recordAuditEvent } from '../../../../audit/audit-factory.ts';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const { session } = await authorizeRequest(request.headers, 'portal:access');
    const storage = getLayoutStorageAdapter();

    // 1. Fetch persistent layout: user-specific first, falling back to site default
    let layout = await storage.getLayout(session.instanceId, session.userId);

    if (!layout) {
      layout = createDefaultSiteLayout(session.instanceId);
      await storage.saveLayout(layout);
    }

    // 2. Server-side permission filter: filter visible widgets by session permissions
    const permSet = new Set(session.permissions);
    const isAdmin = session.roles.includes(SYSTEM_ROLE_ADMIN) || session.roles.includes(SYSTEM_ROLE_OWNER);

    const filteredWidgets = layout.widgets.filter((w) => {
      const def = WIDGET_REGISTRY[w.widgetId];
      if (!def) return false;
      // Admins see all widgets; standard members must have the required permission
      return isAdmin || permSet.has(def.requiredPermission);
    });

    const permittedRegistry = getPermittedWidgets(session.permissions);

    // Provide widgets array with both id and widgetId for compatibility with tests & UI
    const exposedWidgets = filteredWidgets.map((w) => {
      const def = WIDGET_REGISTRY[w.widgetId];
      return {
        id: w.widgetId,
        widgetId: w.widgetId,
        instanceId: w.instanceId,
        title: def?.title || w.widgetId,
        category: def?.category || 'analytics',
        requiredPermission: def?.requiredPermission || 'dashboard:view',
        size: w.size,
        order: w.order,
        visible: w.visible,
        config: w.config,
      };
    });

    return jsonResponse({
      instanceId: session.instanceId,
      userId: session.userId,
      roles: session.roles,
      widgets: exposedWidgets,
      layout: {
        ...layout,
        widgets: filteredWidgets,
      },
      availableWidgets: permittedRegistry,
      isCustomized: Boolean(layout.userId),
    });
  } catch (err) {
    return errorResponse(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { session } = await authorizeRequest(request.headers, 'dashboard:view');

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const rawLayout = (body.layout || body) as DashboardLayout;
    if (!rawLayout || typeof rawLayout !== 'object') {
      throw new ValidationError('Invalid layout payload');
    }

    // Security check 1: Enforce tenant isolation
    if (rawLayout.instanceId && rawLayout.instanceId.toLowerCase() !== session.instanceId.toLowerCase()) {
      throw new TenantMismatchError('Cannot save layout targeting another tenant');
    }
    rawLayout.instanceId = session.instanceId;

    // Security check 2: Enforce layout ownership boundaries
    const isSavingSiteDefault = !rawLayout.userId;
    const isOwnerOrAdmin = session.roles.includes(SYSTEM_ROLE_OWNER) || session.roles.includes(SYSTEM_ROLE_ADMIN);

    if (isSavingSiteDefault && !isOwnerOrAdmin && !session.permissions.includes('dashboard:publish')) {
      throw new ForbiddenError('Only site administrators can update the site-level default layout');
    }

    if (!isSavingSiteDefault) {
      // User-specific layout must match caller's userId unless admin
      if (rawLayout.userId !== session.userId && !isOwnerOrAdmin) {
        throw new ForbiddenError('Users cannot overwrite another member’s personalized layout');
      }
    }

    // Security check 3: Server-side validation of every widget against WIDGET_REGISTRY & permissions
    const validatedLayout = validateLayout(rawLayout, session.permissions);

    // Persist using active storage adapter
    const storage = getLayoutStorageAdapter();
    await storage.saveLayout(validatedLayout);

    await recordAuditEvent({
      instanceId: session.instanceId,
      actorId: session.userId,
      action: 'layout:save',
      outcome: 'SUCCESS',
      target: isSavingSiteDefault ? 'site_default' : `user:${rawLayout.userId}`,
      metadata: {
        isSavingSiteDefault,
        widgetCount: validatedLayout.widgets.length,
      },
    });

    return jsonResponse({
      success: true,
      message: isSavingSiteDefault ? 'Site default layout saved' : 'User layout saved',
      layout: validatedLayout,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

export const PUT: APIRoute = POST;
