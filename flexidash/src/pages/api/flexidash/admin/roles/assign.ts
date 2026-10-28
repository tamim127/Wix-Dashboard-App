/**
 * FlexiDash Admin Roles API: Role Assignment Endpoint
 * POST /api/flexidash/admin/roles/assign
 */

import type { APIRoute } from 'astro';
import { authorizeRequest } from '../../../../../auth/middleware.ts';
import { PolicyEngine } from '../../../../../rbac/policy-engine.ts';
import { toFlexiDashUserId } from '../../../../../models/identity.ts';
import { jsonResponse, errorResponse } from '../../../../../api/response.ts';
import { ValidationError, ForbiddenError, NotFoundError } from '../../../../../errors/app-error.ts';
import type { Role, PermissionKey } from '../../../../../models/rbac.ts';
import { recordAuditEvent } from '../../../../../audit/audit-factory.ts';
import { sanitizeString } from '../../../../../security/validation.ts';
import { getRoleStorageAdapter } from '../../../../../rbac/storage/role-storage-factory.ts';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let activeSession: any = null;
  let targetUserIdentifier: string = 'unknown';

  try {
    const { session, context } = await authorizeRequest(request.headers, 'roles:manage');
    activeSession = session;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const { targetUserId, roleId, roleName, permissions } = body;
    const cleanTargetUserId = sanitizeString(targetUserId, 'targetUserId', 128);
    const cleanRoleId = sanitizeString(roleId, 'roleId', 64);
    targetUserIdentifier = cleanTargetUserId;

    const typedTargetUserId = toFlexiDashUserId(cleanTargetUserId);

    const adapter = getRoleStorageAdapter();
    const existingRole = await adapter.getRole(session.instanceId, cleanRoleId);

    let targetRole: Role;
    const now = new Date();

    if (existingRole) {
      targetRole = existingRole;
    } else {
      targetRole = {
        id: cleanRoleId,
        instanceId: session.instanceId,
        name: typeof roleName === 'string' ? sanitizeString(roleName, 'roleName', 128) : cleanRoleId,
        description: 'Assigned role',
        priority: 10,
        isSystem: false,
        permissions: Array.isArray(permissions) ? (permissions as PermissionKey[]) : [],
        createdAt: now,
        updatedAt: now,
      };
    }

    // Server-side authorization check preventing self-promotion and unauthorized elevation
    // (Evaluated first to guarantee default-deny on self-promotion)
    PolicyEngine.assertCanAssignRole(session, typedTargetUserId, targetRole);

    const hasPermissionsArray = Array.isArray(permissions) && permissions.length > 0;

    // If role does not exist in adapter and no role definition metadata was provided, reject nonexistent role
    if (!existingRole && !roleName && !hasPermissionsArray) {
      throw new NotFoundError('Role', cleanRoleId);
    }

    if (!existingRole) {
      await adapter.saveRole(targetRole);
    }

    // Persist assignment in storage adapter
    await adapter.saveMemberAssignment({
      id: `assign_${session.instanceId}_${typedTargetUserId}_${targetRole.id}`,
      instanceId: session.instanceId,
      userId: typedTargetUserId,
      roleId: targetRole.id,
      assignedBy: session.userId,
      assignedAt: now,
    });

    await recordAuditEvent({
      instanceId: session.instanceId,
      actorId: session.userId,
      action: 'rbac:role_assign',
      outcome: 'SUCCESS',
      target: typedTargetUserId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        roleId: targetRole.id,
        roleName: targetRole.name,
        assignedBy: session.userId,
      },
    });

    return jsonResponse({
      success: true,
      assignment: {
        instanceId: session.instanceId,
        targetUserId: typedTargetUserId,
        roleId: targetRole.id,
        assignedBy: session.userId,
        assignedAt: now.toISOString(),
      },
    });
  } catch (err) {
    if (activeSession) {
      await recordAuditEvent({
        instanceId: activeSession.instanceId,
        actorId: activeSession.userId,
        action: 'rbac:role_assign_failure',
        outcome: err instanceof ForbiddenError ? 'DENIED' : 'FAILURE',
        target: targetUserIdentifier,
        metadata: {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
    return errorResponse(err);
  }
};

