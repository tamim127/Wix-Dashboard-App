/**
 * FlexiDash Default-Deny RBAC Policy Engine
 *
 * Evaluates subjects, roles, and permissions strictly on the server.
 * Guarantees that client-side UI visibility states cannot bypass authorization.
 */

import type { AuthSession } from '../models/session.ts';
import type { PermissionKey, Role } from '../models/rbac.ts';
import type { FlexiDashUserId, InstanceId } from '../models/identity.ts';
import { SYSTEM_ROLE_ADMIN, SYSTEM_ROLE_OWNER, isPermissionValid, isSystemRole } from '../models/rbac.ts';
import { ForbiddenError, TenantMismatchError, ValidationError } from '../errors/app-error.ts';

export class PolicyEngine {
  /**
   * Evaluates whether a session possesses a specific permission.
   * Default-deny: Returns false if session, permissions, or permission key are invalid or missing.
   */
  public static hasPermission(session: AuthSession | null | undefined, permission: PermissionKey | string): boolean {
    if (!session || !session.permissions || !Array.isArray(session.permissions)) {
      return false;
    }

    // Fail closed if the queried permission is unknown to the permission catalog
    if (!isPermissionValid(permission)) {
      return false;
    }

    // Site Owners and Admins possess full administrative permission override
    const userRoles = Array.isArray(session.roles) ? session.roles : [];
    if (userRoles.includes(SYSTEM_ROLE_OWNER) || userRoles.includes(SYSTEM_ROLE_ADMIN)) {
      return true;
    }

    return session.permissions.includes(permission);
  }

  /**
   * Asserts that a session possesses a required permission, throwing ForbiddenError if not.
   */
  public static assertPermission(session: AuthSession | null | undefined, permission: PermissionKey | string): void {
    if (!this.hasPermission(session, permission)) {
      throw new ForbiddenError(`Missing required permission: '${permission}'`, {
        requiredPermission: permission,
        userRoles: session?.roles || [],
      });
    }
  }

  /**
   * Evaluates whether a session has any of the specified roles.
   */
  public static hasAnyRole(session: AuthSession | null | undefined, allowedRoles: string[]): boolean {
    if (!session || !session.roles || !Array.isArray(session.roles)) {
      return false;
    }
    return allowedRoles.some((role) => session.roles.includes(role));
  }

  /**
   * Enforces strict multi-tenant isolation.
   * Fails closed if the session's instanceId does not match the target installation context.
   */
  public static assertTenantAccess(session: AuthSession, targetInstanceId: InstanceId): void {
    if (!session.instanceId || !targetInstanceId) {
      throw new TenantMismatchError('Missing tenant context in session or target');
    }

    if (session.instanceId.toLowerCase() !== targetInstanceId.toLowerCase()) {
      throw new TenantMismatchError('Cross-tenant resource access strictly prohibited', {
        sessionInstance: session.instanceId,
        targetInstance: targetInstanceId,
      });
    }
  }

  /**
   * Prevents self-promotion and unauthorized privilege escalation.
   * Standard members cannot assign roles to themselves or others.
   * Assigners cannot grant permissions they do not possess.
   */
  public static assertCanAssignRole(
    callerSession: AuthSession,
    targetUserId: FlexiDashUserId,
    roleToAssign: Role
  ): void {
    // 1. Caller must have roles:manage permission
    this.assertPermission(callerSession, 'roles:manage');

    // 2. Caller must belong to the same tenant as the role
    this.assertTenantAccess(callerSession, roleToAssign.instanceId);

    // 3. Prevention of self-promotion: A user cannot grant themselves a new role
    if (callerSession.userId === targetUserId) {
      // Unless they are already a Site Owner
      if (!callerSession.roles.includes(SYSTEM_ROLE_OWNER)) {
        throw new ForbiddenError('Self-promotion violation: users cannot modify their own role assignments');
      }
    }

    // 4. Prevention of admin/owner creation by non-owners
    if (roleToAssign.id === SYSTEM_ROLE_OWNER && !callerSession.roles.includes(SYSTEM_ROLE_OWNER)) {
      throw new ForbiddenError('Only an existing Site Owner can assign the Site Owner role');
    }

    // 5. Prevention of privilege escalation: assigner cannot grant permissions they lack
    if (!callerSession.roles.includes(SYSTEM_ROLE_OWNER) && !callerSession.roles.includes(SYSTEM_ROLE_ADMIN)) {
      const callerPerms = new Set(callerSession.permissions || []);
      const unheldPermissions = roleToAssign.permissions.filter((p) => !callerPerms.has(p));
      if (unheldPermissions.length > 0) {
        throw new ForbiddenError(
          `Privilege escalation violation: cannot assign role containing unheld permissions (${unheldPermissions.join(', ')})`
        );
      }
    }
  }

  /**
   * Asserts caller can perform management actions (create, update, delete) on a role.
   * Protects system roles from modification or deletion.
   * Prevents granting permissions caller does not possess.
   */
  public static assertCanManageRole(
    callerSession: AuthSession,
    targetRole: Pick<Role, 'id' | 'instanceId' | 'isSystem' | 'permissions'>,
    action: 'create' | 'update' | 'delete'
  ): void {
    // 1. Caller must have roles:manage permission
    this.assertPermission(callerSession, 'roles:manage');

    // 2. Multi-tenant boundary
    this.assertTenantAccess(callerSession, targetRole.instanceId);

    // 3. System role protection
    if ((action === 'delete' || action === 'update') && (targetRole.isSystem || isSystemRole(targetRole.id))) {
      throw new ForbiddenError(`System role '${targetRole.id}' is protected and cannot be ${action === 'delete' ? 'deleted' : 'modified'}`);
    }

    // 4. Validate permissions and prevent privilege escalation on create/update
    if (action === 'create' || action === 'update') {
      if (targetRole.permissions && Array.isArray(targetRole.permissions)) {
        for (const perm of targetRole.permissions) {
          if (!isPermissionValid(perm)) {
            throw new ValidationError(`Invalid permission key: '${perm}'`);
          }
        }

        // Caller cannot grant permissions they do not possess unless they have full admin override
        if (!callerSession.roles.includes(SYSTEM_ROLE_OWNER) && !callerSession.roles.includes(SYSTEM_ROLE_ADMIN)) {
          const callerPerms = new Set(callerSession.permissions || []);
          const unheld = targetRole.permissions.filter((p) => !callerPerms.has(p));
          if (unheld.length > 0) {
            throw new ForbiddenError(
              `Privilege escalation violation: cannot grant permissions you do not possess (${unheld.join(', ')})`
            );
          }
        }
      }
    }
  }
}
