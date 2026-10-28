/**
 * FlexiDash Admin Audit Log Query API
 * GET /api/flexidash/admin/audit — Query tamper-evident security audit trail
 *
 * RESTRICTED: Requires 'audit:view' permission and active admin/owner session.
 * Enforces strict multi-tenant boundary matching session.instanceId.
 */

import type { APIRoute } from 'astro';
import { authorizeRequest } from '../../../../auth/middleware.ts';
import { jsonResponse, errorResponse } from '../../../../api/response.ts';
import { getAuditStorageAdapter } from '../../../../audit/audit-factory.ts';
import type { AuditLogQuery, AuditOutcome } from '../../../../audit/types.ts';
import {
  validatePagination,
  validateDateString,
  sanitizeString,
} from '../../../../security/validation.ts';
import { ValidationError } from '../../../../errors/app-error.ts';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    // 1. Authorize admin/auditor session with 'audit:view'
    const { session } = await authorizeRequest(request.headers, 'audit:view');

    // 2. Parse and validate URL query parameters
    const url = new URL(request.url);
    const rawPage = url.searchParams.get('page');
    const rawLimit = url.searchParams.get('limit');
    const { page, limit } = validatePagination(rawPage, rawLimit);

    const rawActorId = url.searchParams.get('actorId');
    const actorId = rawActorId ? sanitizeString(rawActorId, 'actorId', 128) : undefined;

    const rawAction = url.searchParams.get('action');
    const action = rawAction ? sanitizeString(rawAction, 'action', 64) : undefined;

    const rawOutcome = url.searchParams.get('outcome');
    let outcome: AuditOutcome | undefined;
    if (rawOutcome) {
      const upper = rawOutcome.toUpperCase();
      if (upper !== 'SUCCESS' && upper !== 'FAILURE' && upper !== 'DENIED') {
        throw new ValidationError('outcome must be one of: SUCCESS, FAILURE, DENIED');
      }
      outcome = upper as AuditOutcome;
    }

    const startDate = validateDateString(url.searchParams.get('startDate'), 'startDate');
    const endDate = validateDateString(url.searchParams.get('endDate'), 'endDate');

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new ValidationError('startDate cannot be later than endDate');
    }

    // 3. Query audit storage partitioned strictly by tenant instanceId
    const query: AuditLogQuery = {
      instanceId: session.instanceId,
      actorId,
      action,
      outcome,
      startDate,
      endDate,
      page,
      limit,
    };

    const storage = getAuditStorageAdapter();
    const result = await storage.queryEvents(query);

    return jsonResponse({
      success: true,
      instanceId: session.instanceId,
      ...result,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

