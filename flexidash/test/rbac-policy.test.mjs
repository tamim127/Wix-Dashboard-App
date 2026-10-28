import test from 'node:test';
import assert from 'node:assert/strict';
import { PolicyEngine } from '../src/rbac/policy-engine.ts';
import {
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OWNER,
  SYSTEM_ROLE_MEMBER,
  DEFAULT_MEMBER_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS,
} from '../src/models/rbac.ts';
import { toFlexiDashUserId, toInstanceId } from '../src/models/identity.ts';
import { ForbiddenError, TenantMismatchError } from '../src/errors/app-error.ts';

test('RBAC Policy Engine & Default-Deny Suite', async (t) => {
  const instanceA = toInstanceId('inst-site-a');
  const instanceB = toInstanceId('inst-site-b');

  const memberSession = {
    userId: toFlexiDashUserId('user-member-1'),
    instanceId: instanceA,
    roles: [SYSTEM_ROLE_MEMBER],
    permissions: DEFAULT_MEMBER_PERMISSIONS,
    email: 'member@test.local',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  const adminSession = {
    userId: toFlexiDashUserId('user-admin-1'),
    instanceId: instanceA,
    roles: [SYSTEM_ROLE_ADMIN],
    permissions: DEFAULT_ADMIN_PERMISSIONS,
    email: 'admin@test.local',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  const ownerSession = {
    userId: toFlexiDashUserId('user-owner-1'),
    instanceId: instanceA,
    roles: [SYSTEM_ROLE_OWNER],
    permissions: DEFAULT_ADMIN_PERMISSIONS,
    email: 'owner@test.local',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  await t.test('default-deny: unauthenticated or empty session returns false', () => {
    assert.equal(PolicyEngine.hasPermission(null, 'dashboard:view'), false);
    assert.equal(PolicyEngine.hasPermission(undefined, 'dashboard:view'), false);
    assert.equal(PolicyEngine.hasPermission({ roles: [], permissions: [] }, 'dashboard:view'), false);
  });

  await t.test('evaluates standard member permissions correctly', () => {
    assert.equal(PolicyEngine.hasPermission(memberSession, 'dashboard:view'), true);
    assert.equal(PolicyEngine.hasPermission(memberSession, 'portal:access'), true);
    // Disallowed permissions for standard members
    assert.equal(PolicyEngine.hasPermission(memberSession, 'dashboard:edit'), false);
    assert.equal(PolicyEngine.hasPermission(memberSession, 'roles:manage'), false);
  });

  await t.test('assertPermission throws ForbiddenError on missing permission', () => {
    assert.throws(
      () => {
        PolicyEngine.assertPermission(memberSession, 'roles:manage');
      },
      ForbiddenError,
      'Must reject unauthorized action with ForbiddenError'
    );
  });

  await t.test('admin and owner sessions have full administrative permission override', () => {
    assert.equal(PolicyEngine.hasPermission(adminSession, 'roles:manage'), true);
    assert.equal(PolicyEngine.hasPermission(ownerSession, 'roles:manage'), true);
    assert.equal(PolicyEngine.hasPermission(ownerSession, 'integrations:manage'), true);
  });

  await t.test('multi-tenant isolation: assertTenantAccess rejects cross-tenant access', () => {
    // Same tenant access passes
    assert.doesNotThrow(() => {
      PolicyEngine.assertTenantAccess(memberSession, instanceA);
    });

    // Cross-tenant access throws TenantMismatchError
    assert.throws(
      () => {
        PolicyEngine.assertTenantAccess(memberSession, instanceB);
      },
      TenantMismatchError,
      'Must fail closed when accessing another tenant'
    );
  });

  await t.test('self-promotion prevention: standard member cannot assign roles', () => {
    const roleToAssign = {
      id: 'role_vip',
      instanceId: instanceA,
      name: 'VIP',
      description: 'VIP role',
      priority: 10,
      isSystem: false,
      permissions: ['dashboard:view'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    assert.throws(
      () => {
        PolicyEngine.assertCanAssignRole(memberSession, memberSession.userId, roleToAssign);
      },
      ForbiddenError,
      'Standard member must be prevented from self-assigning roles'
    );
  });

  await t.test('admin can assign custom role to another member, but non-owner cannot assign Site Owner role', () => {
    const targetUserId = toFlexiDashUserId('user-target-123');
    const customRole = {
      id: 'role_custom',
      instanceId: instanceA,
      name: 'Custom',
      description: 'Custom role',
      priority: 5,
      isSystem: false,
      permissions: ['dashboard:view'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Admin assigning custom role passes
    assert.doesNotThrow(() => {
      PolicyEngine.assertCanAssignRole(adminSession, targetUserId, customRole);
    });

    // Admin assigning Site Owner role throws
    const ownerRole = {
      id: SYSTEM_ROLE_OWNER,
      instanceId: instanceA,
      name: 'Site Owner',
      description: 'Site Owner role',
      priority: 100,
      isSystem: true,
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    assert.throws(
      () => {
        PolicyEngine.assertCanAssignRole(adminSession, targetUserId, ownerRole);
      },
      ForbiddenError,
      'Admin cannot assign Site Owner role'
    );

    // Site Owner assigning Site Owner role passes
    assert.doesNotThrow(() => {
      PolicyEngine.assertCanAssignRole(ownerSession, targetUserId, ownerRole);
    });
  });
});
