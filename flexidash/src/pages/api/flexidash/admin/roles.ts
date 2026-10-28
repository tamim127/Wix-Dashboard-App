/**
 * FlexiDash Admin Roles CRUD API
 *
 * GET /api/flexidash/admin/roles - List roles with member counts
 * POST /api/flexidash/admin/roles - Create custom role
 * PUT /api/flexidash/admin/roles - Update custom role
 * DELETE /api/flexidash/admin/roles - Delete custom role
 */

import type { APIRoute } from 'astro';
import { authorizeRequest } from '../../../../auth/middleware.ts';
import { jsonResponse, errorResponse } from '../../../../api/response.ts';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../../../errors/app-error.ts';
import { PolicyEngine } from '../../../../rbac/policy-engine.ts';
import { getRoleStorageAdapter } from '../../../../rbac/storage/role-storage-factory.ts';
import { recordAuditEvent } from '../../../../audit/audit-factory.ts';
import { sanitizeString } from '../../../../security/validation.ts';
import type { Role, PermissionKey } from '../../../../models/rbac.ts';
import { isSystemRole, isPermissionValid } from '../../../../models/rbac.ts';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const { session } = await authorizeRequest(request.headers, 'roles:view');
    const adapter = getRoleStorageAdapter();

    const roles = await adapter.listRoles(session.instanceId);
    const { members } = await adapter.listMembers(session.instanceId, { limit: 1000 });
    const assignments = await adapter.getMemberAssignments(session.instanceId);

    const rolesWithMeta = roles.map((r) => {
      const assignedUserIds = new Set(assignments.filter((a) => a.roleId === r.id).map((a) => a.userId));
      const directCount = members.filter((m) => m.roles.includes(r.id)).length;
      const totalSet = new Set(members.filter((m) => m.roles.includes(r.id)).map((m) => m.userId));
      for (const u of assignedUserIds) totalSet.add(u);
      return {
        ...r,
        memberCount: Math.max(directCount, totalSet.size),
      };
    });

    return jsonResponse({
      instanceId: session.instanceId,
      roles: rolesWithMeta,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

export const POST: APIRoute = async ({ request }) => {
  let activeSession: any = null;
  let targetRoleId = 'unknown';

  try {
    const { session, context } = await authorizeRequest(request.headers, 'roles:manage');
    activeSession = session;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const name = sanitizeString(body.name, 'name', 128);
    const description = typeof body.description === 'string'
      ? sanitizeString(body.description, 'description', 256)
      : '';
    const rawId = typeof body.id === 'string' ? sanitizeString(body.id, 'id', 64) : undefined;
    const permissions = Array.isArray(body.permissions) ? (body.permissions as PermissionKey[]) : [];

    // Derive role ID
    const roleId = rawId || `role_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
    targetRoleId = roleId;

    if (isSystemRole(roleId)) {
      throw new ForbiddenError(`Cannot create custom role using reserved system ID '${roleId}'`);
    }

    // Validate permissions
    for (const perm of permissions) {
      if (!isPermissionValid(perm)) {
        throw new ValidationError(`Unknown permission key: '${perm}'`);
      }
    }

    const adapter = getRoleStorageAdapter();
    const existing = await adapter.getRole(session.instanceId, roleId);
    if (existing) {
      throw new ConflictError(`Role with ID '${roleId}' already exists in tenant`);
    }

    const now = new Date();
    const newRole: Role = {
      id: roleId,
      instanceId: session.instanceId,
      name,
      description,
      priority: typeof body.priority === 'number' ? body.priority : 10,
      isSystem: false,
      permissions,
      createdAt: now,
      updatedAt: now,
    };

    // Policy check for creation & privilege escalation
    PolicyEngine.assertCanManageRole(session, newRole, 'create');

    const saved = await adapter.saveRole(newRole);

    await recordAuditEvent({
      instanceId: session.instanceId,
      actorId: session.userId,
      action: 'rbac:role_create',
      outcome: 'SUCCESS',
      target: saved.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        roleName: saved.name,
        permissionsCount: saved.permissions.length,
      },
    });

    return jsonResponse({ success: true, role: saved }, 201);
  } catch (err) {
    if (activeSession) {
      await recordAuditEvent({
        instanceId: activeSession.instanceId,
        actorId: activeSession.userId,
        action: 'rbac:role_create_failure',
        outcome: err instanceof ForbiddenError ? 'DENIED' : 'FAILURE',
        target: targetRoleId,
        metadata: {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
    return errorResponse(err);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  let activeSession: any = null;
  let targetRoleId = 'unknown';

  try {
    const { session, context } = await authorizeRequest(request.headers, 'roles:manage');
    activeSession = session;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    const roleId = sanitizeString(body.roleId, 'roleId', 64);
    targetRoleId = roleId;

    const adapter = getRoleStorageAdapter();
    const existingRole = await adapter.getRole(session.instanceId, roleId);
    if (!existingRole) {
      throw new NotFoundError('Role', roleId);
    }

    // System role protection check
    PolicyEngine.assertCanManageRole(session, existingRole, 'update');

    const updatedPermissions = Array.isArray(body.permissions)
      ? (body.permissions as PermissionKey[])
      : existingRole.permissions;

    // Validate permissions
    for (const perm of updatedPermissions) {
      if (!isPermissionValid(perm)) {
        throw new ValidationError(`Unknown permission key: '${perm}'`);
      }
    }

    const updatedRole: Role = {
      ...existingRole,
      name: typeof body.name === 'string' ? sanitizeString(body.name, 'name', 128) : existingRole.name,
      description: typeof body.description === 'string'
        ? sanitizeString(body.description, 'description', 256)
        : existingRole.description,
      priority: typeof body.priority === 'number' ? body.priority : existingRole.priority,
      permissions: updatedPermissions,
      updatedAt: new Date(),
    };

    // Assert privilege escalation invariants
    PolicyEngine.assertCanManageRole(session, updatedRole, 'update');

    const saved = await adapter.saveRole(updatedRole);

    await recordAuditEvent({
      instanceId: session.instanceId,
      actorId: session.userId,
      action: 'rbac:role_update',
      outcome: 'SUCCESS',
      target: saved.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        roleName: saved.name,
        permissionsCount: saved.permissions.length,
      },
    });

    return jsonResponse({ success: true, role: saved });
  } catch (err) {
    if (activeSession) {
      await recordAuditEvent({
        instanceId: activeSession.instanceId,
        actorId: activeSession.userId,
        action: 'rbac:role_update_failure',
        outcome: err instanceof ForbiddenError ? 'DENIED' : 'FAILURE',
        target: targetRoleId,
        metadata: {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
    return errorResponse(err);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  let activeSession: any = null;
  let targetRoleId = 'unknown';

  try {
    const { session, context } = await authorizeRequest(request.headers, 'roles:manage');
    activeSession = session;

    const url = new URL(request.url);
    let roleId = url.searchParams.get('roleId');

    if (!roleId && request.headers.get('content-type')?.includes('application/json')) {
      try {
        const body = await request.json();
        roleId = body.roleId;
      } catch {
        // Fallback to query
      }
    }

    if (!roleId) {
      throw new ValidationError('roleId query parameter or body property is required');
    }

    const cleanRoleId = sanitizeString(roleId, 'roleId', 64);
    targetRoleId = cleanRoleId;

    const adapter = getRoleStorageAdapter();
    const existingRole = await adapter.getRole(session.instanceId, cleanRoleId);
    if (!existingRole) {
      throw new NotFoundError('Role', cleanRoleId);
    }

    // Protect system roles
    PolicyEngine.assertCanManageRole(session, existingRole, 'delete');

    // Safety check: block deletion if members are still assigned
    const memberCount = await adapter.countMembersWithRole(session.instanceId, cleanRoleId);
    if (memberCount > 0) {
      throw new ValidationError(
        `Cannot delete role '${existingRole.name}' because ${memberCount} member(s) are currently assigned to it. Please reassign members first.`
      );
    }

    const deleted = await adapter.deleteRole(session.instanceId, cleanRoleId);

    await recordAuditEvent({
      instanceId: session.instanceId,
      actorId: session.userId,
      action: 'rbac:role_delete',
      outcome: 'SUCCESS',
      target: cleanRoleId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        roleName: existingRole.name,
      },
    });

    return jsonResponse({
      success: deleted,
      message: `Role '${existingRole.name}' deleted successfully`,
    });
  } catch (err) {
    if (activeSession) {
      await recordAuditEvent({
        instanceId: activeSession.instanceId,
        actorId: activeSession.userId,
        action: 'rbac:role_delete_failure',
        outcome: err instanceof ForbiddenError ? 'DENIED' : 'FAILURE',
        target: targetRoleId,
        metadata: {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
    return errorResponse(err);
  }
};
