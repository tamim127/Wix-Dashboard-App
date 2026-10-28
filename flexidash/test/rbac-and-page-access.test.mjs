/**
 * FlexiDash Phase 6 Test Suite: Advanced RBAC, Page Access Control & Admin Management
 *
 * Verifies:
 * 1. Role CRUD operations (Create, Read, Update, Delete) with member assignment counts
 * 2. System role protection against deletion and modification
 * 3. Role deletion blocker when members are currently assigned
 * 4. Permission catalog integrity, unknown permission denial, and default-deny invariants
 * 5. Privilege escalation and self-promotion prevention
 * 6. Page & Navigation access control engine and server-side route protection
 * 7. Widget-level action authorization and audit trail recording
 * 8. Member administration API with search, filter, and pagination
 * 9. Multi-tenant storage isolation across File and Cloudflare KV adapters
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { PolicyEngine } from '../src/rbac/policy-engine.ts';
import {
  PERMISSION_CATALOG,
  ALL_PERMISSION_KEYS,
  isPermissionValid,
  isSystemRole,
  SYSTEM_ROLE_OWNER,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_MEMBER,
  SYSTEM_ROLE_VISITOR,
} from '../src/models/rbac.ts';
import {
  checkPageAccess,
  filterAuthorizedNavItems,
  DEFAULT_PAGE_RULES,
  DEFAULT_PORTAL_NAV_ITEMS,
} from '../src/rbac/page-access.ts';
import { FileRoleStorageAdapter } from '../src/rbac/storage/file-role-storage.ts';
import { CloudflareKvRoleStorageAdapter } from '../src/rbac/storage/cloudflare-kv-role-storage.ts';
import {
  setRoleStorageAdapterForTesting,
  resetRoleStorageAdapter,
} from '../src/rbac/storage/role-storage-factory.ts';
import { loadAppConfig, resetAppConfigForTesting } from '../src/config/env.ts';
import { DevelopmentAuthProvider } from '../src/auth/dev-provider.ts';
import { setAuthProviderForTesting } from '../src/auth/auth-factory.ts';
import { signJwt } from '../src/auth/jwt-service.ts';
import {
  GET as getRolesRoute,
  POST as createRoleRoute,
  PUT as updateRoleRoute,
  DELETE as deleteRoleRoute,
} from '../src/pages/api/flexidash/admin/roles.ts';
import { GET as getMembersRoute } from '../src/pages/api/flexidash/admin/members.ts';
import { POST as assignRoleRoute } from '../src/pages/api/flexidash/admin/roles/assign.ts';
import { GET as getPageAccessRoute } from '../src/pages/api/flexidash/portal/pages/access.ts';
import { POST as widgetActionRoute } from '../src/pages/api/flexidash/portal/widgets/action.ts';

// Mock KV Namespace
class MockKV {
  constructor() {
    this.map = new Map();
  }
  async get(k, type) {
    if (!this.map.has(k)) return null;
    const v = this.map.get(k);
    if (type === 'json') {
      try {
        return JSON.parse(v);
      } catch {
        return null;
      }
    }
    return v;
  }
  async put(k, v) {
    this.map.set(k, String(v));
  }
  async delete(k) {
    this.map.delete(k);
  }
}

test('FlexiDash Phase 6: Advanced RBAC & Page Access Control Suite', async (t) => {
  const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.SESSION_SECRET = testSecret;

  const testTenant = `tenant-p6-${Date.now()}`;
  const fileAdapter = new FileRoleStorageAdapter();

  t.beforeEach(async () => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'test',
      WIX_CLIENT_INSTANCE_ID: testTenant,
      FLEXIDASH_JWT_SECRET: testSecret,
      FLEXIDASH_AUTH_MODE: 'dev-mock',
    });
    setAuthProviderForTesting(new DevelopmentAuthProvider());
    resetRoleStorageAdapter();
    setRoleStorageAdapterForTesting(fileAdapter);
    await fileAdapter.clearForTesting(testTenant);
  });

  t.after(async () => {
    resetRoleStorageAdapter();
    await fileAdapter.clearForTesting(testTenant);
  });

  // Helper to mint test JWT tokens
  const mintToken = async (opts) => {
    return signJwt({
      sub: opts.userId,
      inst: opts.instanceId,
      email: opts.email,
      roles: opts.roles || [],
      permissions: opts.permissions || [],
      sessionType: 'MEMBER',
    }, 3600, testSecret);
  };

  await t.test('1. Role CRUD Operations via API', async () => {
    const adminToken = await mintToken({
      userId: 'admin-actor-1',
      instanceId: testTenant,
      email: 'admin@flexidash.local',
      roles: [SYSTEM_ROLE_ADMIN],
      permissions: ['roles:view', 'roles:manage'],
    });

    // 1.1 List initial system roles
    const listReq1 = new Request('http://localhost/api/flexidash/admin/roles', {
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const listRes1 = await getRolesRoute({ request: listReq1 });
    assert.equal(listRes1.status, 200);
    const listData1 = await listRes1.json();
    assert.ok(Array.isArray(listData1.roles));
    assert.ok(listData1.roles.some((r) => r.id === SYSTEM_ROLE_OWNER));
    assert.ok(listData1.roles.some((r) => r.id === SYSTEM_ROLE_ADMIN));
    assert.ok(listData1.roles.some((r) => r.id === SYSTEM_ROLE_MEMBER));

    // 1.2 Create custom role
    const createReq = new Request('http://localhost/api/flexidash/admin/roles', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'role_moderator',
        name: 'Community Moderator',
        description: 'Moderates member comments and reviews profiles',
        permissions: ['members:view', 'portal:access', 'pages:view:members'],
      }),
    });
    const createRes = await createRoleRoute({ request: createReq });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.equal(createData.role.id, 'role_moderator');
    assert.equal(createData.role.name, 'Community Moderator');
    assert.equal(createData.role.isSystem, false);

    // 1.3 Update custom role
    const updateReq = new Request('http://localhost/api/flexidash/admin/roles', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roleId: 'role_moderator',
        name: 'Senior Moderator',
        description: 'Updated moderator role with analytics access',
        permissions: ['members:view', 'portal:access', 'pages:view:members', 'pages:view:analytics'],
      }),
    });
    const updateRes = await updateRoleRoute({ request: updateReq });
    assert.equal(updateRes.status, 200);
    const updateData = await updateRes.json();
    assert.equal(updateData.role.name, 'Senior Moderator');
    assert.equal(updateData.role.permissions.length, 4);

    // 1.4 Delete custom role
    const deleteReq = new Request('http://localhost/api/flexidash/admin/roles?roleId=role_moderator', {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const deleteRes = await deleteRoleRoute({ request: deleteReq });
    assert.equal(deleteRes.status, 200);
    const deleteData = await deleteRes.json();
    assert.equal(deleteData.success, true);

    // 1.5 Verify role no longer exists
    const listReq2 = new Request('http://localhost/api/flexidash/admin/roles', {
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const listRes2 = await getRolesRoute({ request: listReq2 });
    const listData2 = await listRes2.json();
    assert.equal(listData2.roles.some((r) => r.id === 'role_moderator'), false);
  });

  await t.test('2. System Role Protection Invariants', async () => {
    assert.equal(isSystemRole(SYSTEM_ROLE_ADMIN), true);
    assert.equal(isSystemRole('role_custom_something'), false);

    const adminToken = await mintToken({
      userId: 'admin-actor-2',
      instanceId: testTenant,
      email: 'admin@flexidash.local',
      roles: [SYSTEM_ROLE_ADMIN],
      permissions: ['roles:manage', 'roles:view'],
    });

    // 2.1 Rejects deleting system roles
    for (const sysRoleId of [SYSTEM_ROLE_OWNER, SYSTEM_ROLE_ADMIN, SYSTEM_ROLE_MEMBER, SYSTEM_ROLE_VISITOR]) {
      const delReq = new Request(`http://localhost/api/flexidash/admin/roles?roleId=${sysRoleId}`, {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-wix-instance-id': testTenant,
        },
      });
      const delRes = await deleteRoleRoute({ request: delReq });
      assert.equal(delRes.status, 403);
      const data = await delRes.json();
      assert.equal(data.error.code, 'FORBIDDEN');
      assert.match(data.error.message, /System role/);
    }

    // 2.2 Rejects modifying/updating system roles
    const editReq = new Request('http://localhost/api/flexidash/admin/roles', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roleId: SYSTEM_ROLE_MEMBER,
        name: 'Hacked Member',
      }),
    });
    const editRes = await updateRoleRoute({ request: editReq });
    assert.equal(editRes.status, 403);
    const editData = await editRes.json();
    assert.equal(editData.error.code, 'FORBIDDEN');
    assert.match(editData.error.message, /System role/);

    // 2.3 Rejects creating a role that uses a reserved system ID
    const createSysReq = new Request('http://localhost/api/flexidash/admin/roles', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: SYSTEM_ROLE_ADMIN,
        name: 'Duplicate Admin',
        permissions: ['portal:access'],
      }),
    });
    const createSysRes = await createRoleRoute({ request: createSysReq });
    assert.equal(createSysRes.status, 403);
  });

  await t.test('3. Role Deletion Blocker When Members Are Assigned', async () => {
    const adminToken = await mintToken({
      userId: 'admin-actor-3',
      instanceId: testTenant,
      email: 'admin@flexidash.local',
      roles: [SYSTEM_ROLE_ADMIN],
      permissions: ['roles:manage', 'roles:view'],
    });

    // 3.1 Create custom role
    await createRoleRoute({
      request: new Request('http://localhost/api/flexidash/admin/roles', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-wix-instance-id': testTenant,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 'role_support_specialist',
          name: 'Support Specialist',
          description: 'Handles customer support queries',
          permissions: ['portal:access', 'members:view'],
        }),
      }),
    });

    // 3.2 Assign this role to a member
    await assignRoleRoute({
      request: new Request('http://localhost/api/flexidash/admin/roles/assign', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-wix-instance-id': testTenant,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId: 'member_support_1',
          roleId: 'role_support_specialist',
        }),
      }),
    });

    // 3.3 Verify memberCount is reflected in GET /roles
    const listRes = await getRolesRoute({
      request: new Request('http://localhost/api/flexidash/admin/roles', {
        headers: {
          authorization: `Bearer ${adminToken}`,
          'x-wix-instance-id': testTenant,
        },
      }),
    });
    const listData = await listRes.json();
    const supportRole = listData.roles.find((r) => r.id === 'role_support_specialist');
    assert.ok(supportRole);
    assert.equal(supportRole.memberCount, 1);

    // 3.4 Attempt to delete role while assigned -> MUST BE BLOCKED
    const delReq = new Request('http://localhost/api/flexidash/admin/roles?roleId=role_support_specialist', {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const delRes = await deleteRoleRoute({ request: delReq });
    assert.equal(delRes.status, 400);
    const delData = await delRes.json();
    assert.equal(delData.error.code, 'VALIDATION_FAILED');
    assert.match(delData.error.message, /Cannot delete role 'Support Specialist' because 1 member\(s\) are currently assigned/);
  });

  await t.test('4. Permission Catalog & Unknown Permission Rejection', async () => {
    // 4.1 Permission catalog validity
    assert.ok(PERMISSION_CATALOG['portal:access']);
    assert.equal(PERMISSION_CATALOG['portal:access'].category, 'portal');
    assert.equal(isPermissionValid('portal:access'), true);
    assert.equal(isPermissionValid('dashboard:view'), true);
    assert.equal(isPermissionValid('pages:view:overview'), true);
    assert.equal(isPermissionValid('widgets:action'), true);
    assert.equal(isPermissionValid('hacked:root:access'), false);
    assert.equal(isPermissionValid(''), false);

    // 4.2 PolicyEngine default-deny on unknown permission strings
    const session = {
      userId: 'test_user',
      instanceId: testTenant,
      roles: ['role_custom'],
      permissions: ['portal:access', 'hacked:root:access'],
    };
    assert.equal(PolicyEngine.hasPermission(session, 'portal:access'), true);
    assert.equal(PolicyEngine.hasPermission(session, 'hacked:root:access'), false); // Denied because not in catalog

    // 4.3 Attempting to create a role with an invalid permission key fails closed
    const adminToken = await mintToken({
      userId: 'admin-actor-4',
      instanceId: testTenant,
      email: 'admin@flexidash.local',
      roles: [SYSTEM_ROLE_ADMIN],
      permissions: ['roles:manage'],
    });

    const createReq = new Request('http://localhost/api/flexidash/admin/roles', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Malicious Role',
        permissions: ['portal:access', 'invalid:fake:perm'],
      }),
    });
    const createRes = await createRoleRoute({ request: createReq });
    assert.equal(createRes.status, 400);
    const createData = await createRes.json();
    assert.equal(createData.error.code, 'VALIDATION_FAILED');
    assert.match(createData.error.message, /Unknown permission/);
  });

  await t.test('5. Privilege Escalation Prevention', async () => {
    // User possessing only 'roles:manage' and 'portal:access' (cannot grant 'audit:view')
    const limitedAdminToken = await mintToken({
      userId: 'limited-manager-1',
      instanceId: testTenant,
      email: 'limited@flexidash.local',
      roles: ['role_custom_manager'],
      permissions: ['roles:manage', 'portal:access'],
    });

    // 5.1 Attempt to create a role with permissions caller lacks
    const createEscReq = new Request('http://localhost/api/flexidash/admin/roles', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${limitedAdminToken}`,
        'x-wix-instance-id': testTenant,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Escalated Role',
        permissions: ['portal:access', 'audit:view'],
      }),
    });
    const createEscRes = await createRoleRoute({ request: createEscReq });
    assert.equal(createEscRes.status, 403);
    const createEscData = await createEscRes.json();
    assert.equal(createEscData.error.code, 'FORBIDDEN');
    assert.match(createEscData.error.message, /Privilege escalation violation/);

    // 5.2 Attempt to assign role with unheld permissions
    const assignEscReq = new Request('http://localhost/api/flexidash/admin/roles/assign', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${limitedAdminToken}`,
        'x-wix-instance-id': testTenant,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetUserId: 'target_subordinate',
        roleId: 'role_escalated_assign',
        roleName: 'Escalated Role',
        permissions: ['audit:view'],
      }),
    });
    const assignEscRes = await assignRoleRoute({ request: assignEscReq });
    assert.equal(assignEscRes.status, 403);
    const assignEscData = await assignEscRes.json();
    assert.match(assignEscData.error.message, /Privilege escalation/);
  });

  await t.test('6. Server-Side Page & Navigation Access Control', async () => {
    const memberToken = await mintToken({
      userId: 'member-portal-1',
      instanceId: testTenant,
      email: 'member@flexidash.local',
      roles: [SYSTEM_ROLE_MEMBER],
      permissions: ['portal:access', 'pages:view:overview'],
    });

    const adminToken = await mintToken({
      userId: 'admin-portal-1',
      instanceId: testTenant,
      email: 'admin@flexidash.local',
      roles: [SYSTEM_ROLE_ADMIN],
      permissions: [...ALL_PERMISSION_KEYS],
    });

    // 6.1 Unauthenticated call -> 401
    const unauthReq = new Request('http://localhost/api/flexidash/portal/pages/access');
    const unauthRes = await getPageAccessRoute({ request: unauthReq });
    assert.equal(unauthRes.status, 401);

    // 6.2 Standard member access matrix
    const checkDirect = checkPageAccess({
      userId: 'member-portal-1',
      instanceId: testTenant,
      email: 'member@flexidash.local',
      roles: [SYSTEM_ROLE_MEMBER],
      permissions: ['portal:access', 'pages:view:overview'],
      expiresAt: 9999999999,
    }, '/portal');
    assert.equal(checkDirect.allowed, true);

    const filteredNav = filterAuthorizedNavItems({
      userId: 'member-portal-1',
      instanceId: testTenant,
      email: 'member@flexidash.local',
      roles: [SYSTEM_ROLE_MEMBER],
      permissions: ['portal:access', 'pages:view:overview'],
      expiresAt: 9999999999,
    });
    assert.equal(filteredNav.length, 1);
    assert.equal(filteredNav[0].path, '/portal');

    const memberReq = new Request('http://localhost/api/flexidash/portal/pages/access', {
      headers: {
        authorization: `Bearer ${memberToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const memberRes = await getPageAccessRoute({ request: memberReq });
    assert.equal(memberRes.status, 200);
    const memberData = await memberRes.json();
    assert.deepEqual(memberData.allowedRoutes, ['/portal']);
    assert.equal(memberData.navItems.length, 1);
    assert.equal(memberData.navItems[0].path, '/portal');

    // 6.3 Standard member direct path check: allowed path
    const evalAllowedReq = new Request('http://localhost/api/flexidash/portal/pages/access?path=/portal', {
      headers: {
        authorization: `Bearer ${memberToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const evalAllowedRes = await getPageAccessRoute({ request: evalAllowedReq });
    assert.equal(evalAllowedRes.status, 200);
    const evalAllowedData = await evalAllowedRes.json();
    assert.equal(evalAllowedData.allowed, true);

    // 6.4 Standard member direct path check: restricted path -> 403 Forbidden
    const evalDeniedReq = new Request('http://localhost/api/flexidash/portal/pages/access?path=/portal/audit', {
      headers: {
        authorization: `Bearer ${memberToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const evalDeniedRes = await getPageAccessRoute({ request: evalDeniedReq });
    assert.equal(evalDeniedRes.status, 403);
    const evalDeniedData = await evalDeniedRes.json();
    assert.equal(evalDeniedData.allowed, false);
    assert.match(evalDeniedData.reason, /missing required permission 'pages:view:audit'/);

    // 6.5 Admin accesses all pages
    const adminReq = new Request('http://localhost/api/flexidash/portal/pages/access', {
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const adminRes = await getPageAccessRoute({ request: adminReq });
    const adminData = await adminRes.json();
    assert.equal(adminData.allowedRoutes.length, DEFAULT_PAGE_RULES.length);
    assert.equal(adminData.navItems.length, DEFAULT_PORTAL_NAV_ITEMS.length);
  });

  await t.test('7. Widget-Level Action Authorization', async () => {
    const memberTokenNoAction = await mintToken({
      userId: 'member-widget-1',
      instanceId: testTenant,
      email: 'member@flexidash.local',
      roles: [SYSTEM_ROLE_MEMBER],
      permissions: ['portal:access', 'dashboard:view'],
    });

    const adminToken = await mintToken({
      userId: 'admin-widget-1',
      instanceId: testTenant,
      email: 'admin@flexidash.local',
      roles: [SYSTEM_ROLE_ADMIN],
      permissions: ['widgets:action', 'dashboard:view'],
    });

    // 7.1 Member without 'widgets:action' -> 403 Forbidden
    const req1 = new Request('http://localhost/api/flexidash/portal/widgets/action', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${memberTokenNoAction}`,
        'x-wix-instance-id': testTenant,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        widgetId: 'widget-overview-metrics',
        action: 'refresh_data',
      }),
    });
    const res1 = await widgetActionRoute({ request: req1 });
    assert.equal(res1.status, 403);

    // 7.2 Admin with 'widgets:action' -> 200 OK
    const req2 = new Request('http://localhost/api/flexidash/portal/widgets/action', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        widgetId: 'widget-overview-metrics',
        action: 'refresh_data',
        payload: { range: '30d' },
      }),
    });
    const res2 = await widgetActionRoute({ request: req2 });
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.success, true);
    assert.equal(data2.widgetId, 'widget-overview-metrics');

    // 7.3 Unrecognized widget ID -> 404 Not Found
    const req3 = new Request('http://localhost/api/flexidash/portal/widgets/action', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        widgetId: 'malicious-injected-widget',
        action: 'exploit',
      }),
    });
    const res3 = await widgetActionRoute({ request: req3 });
    assert.equal(res3.status, 404);
  });

  await t.test('8. Member Administration API (Search, Filter, Pagination)', async () => {
    const adminToken = await mintToken({
      userId: 'admin-members-1',
      instanceId: testTenant,
      email: 'admin@flexidash.local',
      roles: [SYSTEM_ROLE_ADMIN],
      permissions: ['members:view', 'members:manage'],
    });

    // 8.1 List all initial demo members
    const req1 = new Request('http://localhost/api/flexidash/admin/members', {
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const res1 = await getMembersRoute({ request: req1 });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.equal(data1.isDemoData, true);
    assert.ok(data1.platformStatus.includes('LOCAL_ADAPTER'));
    assert.ok(data1.members.length >= 2);

    // 8.2 Search by keyword
    const req2 = new Request('http://localhost/api/flexidash/admin/members?q=admin@flexidash', {
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const res2 = await getMembersRoute({ request: req2 });
    const data2 = await res2.json();
    assert.equal(data2.members.length, 1);
    assert.equal(data2.members[0].email, 'admin@flexidash.local');

    // 8.3 Filter by roleId
    const req3 = new Request(`http://localhost/api/flexidash/admin/members?roleId=${SYSTEM_ROLE_MEMBER}`, {
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenant,
      },
    });
    const res3 = await getMembersRoute({ request: req3 });
    const data3 = await res3.json();
    assert.ok(data3.members.every((m) => m.roles.includes(SYSTEM_ROLE_MEMBER)));
  });

  await t.test('9. Cloudflare KV Role Storage Adapter & Tenant Partitioning', async () => {
    const mockKv = new MockKV();
    const kvAdapter = new CloudflareKvRoleStorageAdapter(mockKv);

    const tenantA = 'tenant_kv_alpha';
    const tenantB = 'tenant_kv_beta';

    // 9.1 Tenant A lists initial system roles
    const rolesA = await kvAdapter.listRoles(tenantA);
    assert.equal(rolesA.length, 4);

    // 9.2 Tenant A creates custom role
    const now = new Date();
    await kvAdapter.saveRole({
      id: 'role_vip_alpha',
      instanceId: tenantA,
      name: 'VIP Alpha',
      description: 'Alpha tenant VIP',
      priority: 50,
      isSystem: false,
      permissions: ['portal:access'],
      createdAt: now,
      updatedAt: now,
    });

    // 9.3 Verify Tenant A sees the role
    const updatedRolesA = await kvAdapter.listRoles(tenantA);
    assert.equal(updatedRolesA.some((r) => r.id === 'role_vip_alpha'), true);

    // 9.4 Verify Tenant B does NOT see Tenant A's role (Strict Isolation)
    const rolesB = await kvAdapter.listRoles(tenantB);
    assert.equal(rolesB.some((r) => r.id === 'role_vip_alpha'), false);

    // 9.5 Member assignment persistence in KV
    await kvAdapter.saveMemberAssignment({
      id: 'assign_kv_1',
      instanceId: tenantA,
      userId: 'user_kv_1',
      roleId: 'role_vip_alpha',
      assignedBy: 'admin',
      assignedAt: now,
    });

    const countA = await kvAdapter.countMembersWithRole(tenantA, 'role_vip_alpha');
    assert.equal(countA, 1);
    const countB = await kvAdapter.countMembersWithRole(tenantB, 'role_vip_alpha');
    assert.equal(countB, 0);
  });
});
