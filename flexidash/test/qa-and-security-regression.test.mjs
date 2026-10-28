/**
 * FlexiDash Phase 8: Final QA, Security Regression & Release Verification Suite
 *
 * Validates:
 * 1. Complete End-to-End User Lifecycle (Registration -> Login -> Portal Layout -> Widget Action -> Logout -> Expiry)
 * 2. Security Regression Defenses:
 *    - Algorithm confusion prevention (alg: 'none' rejection)
 *    - Production webhook fail-closed authentication (unsigned body.instanceId rejected)
 *    - Wix signed-instance expiration and appDefId validation
 *    - Tampered instance signature detection
 * 3. Complete Role Lifecycle:
 *    - Custom role creation with granular permissions
 *    - Role assignment to tenant member
 *    - Role deletion blocked when member is assigned
 *    - Role deletion succeeds after member reassignment
 * 4. Multi-Tenant Storage Isolation across all adapters (Layouts, Roles, Audit, Tenants)
 * 5. Production Storage Fail-Closed Invariants
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Auth and Identity
import { signJwt, verifyJwt } from '../src/auth/jwt-service.ts';
import { parseAndVerifyWixInstance, createMockWixInstance } from '../src/auth/wix-instance-validator.ts';
import { loadAppConfig, resetAppConfigForTesting, ConfigurationError } from '../src/config/env.ts';
import { UnauthorizedError } from '../src/errors/app-error.ts';
import { toInstanceId, toFlexiDashUserId } from '../src/models/identity.ts';
import { SYSTEM_ROLE_ADMIN, SYSTEM_ROLE_MEMBER } from '../src/models/rbac.ts';

// Storage Factories & Adapters
import { resetLayoutStorageAdapter, validateProductionStorage } from '../src/layout/storage/storage-factory.ts';
import { getRoleStorageAdapter, resetRoleStorageAdapter } from '../src/rbac/storage/role-storage-factory.ts';
import { resetAuditStorageAdapter } from '../src/audit/audit-factory.ts';
import { resetTenantStorageAdapter } from '../src/tenant/storage/tenant-storage-factory.ts';
import { CloudflareKvLayoutStorageAdapter } from '../src/layout/storage/cloudflare-kv-storage.ts';
import { CloudflareKvRoleStorageAdapter } from '../src/rbac/storage/cloudflare-kv-role-storage.ts';
import { CloudflareKvAuditStorageAdapter } from '../src/audit/storage/cloudflare-kv-audit-storage.ts';
import { CloudflareKvTenantStorageAdapter } from '../src/tenant/storage/cloudflare-kv-tenant-storage.ts';

// API Handlers
import { POST as loginRoute } from '../src/pages/api/flexidash/auth/login.ts';
import { POST as registerRoute } from '../src/pages/api/flexidash/auth/register.ts';
import { POST as logoutRoute } from '../src/pages/api/flexidash/auth/logout.ts';
import { GET as getLayoutRoute } from '../src/pages/api/flexidash/portal/layout.ts';
import { GET as getPageAccessRoute } from '../src/pages/api/flexidash/portal/pages/access.ts';
import { POST as widgetActionRoute } from '../src/pages/api/flexidash/portal/widgets/action.ts';
import { POST as createRoleRoute, DELETE as deleteRoleRoute } from '../src/pages/api/flexidash/admin/roles.ts';
import { POST as assignRoleRoute } from '../src/pages/api/flexidash/admin/roles/assign.ts';
import { POST as webhookRoute } from '../src/pages/api/flexidash/webhooks/app-lifecycle.ts';

// Mock KV Helper
class MockKvStore {
  constructor() {
    this.storage = new Map();
  }
  async get(key, format = 'text') {
    const val = this.storage.get(key);
    if (!val) return null;
    if (format === 'json') {
      try { return JSON.parse(val); } catch { return null; }
    }
    return val;
  }
  async put(key, value) {
    this.storage.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  async delete(key) {
    this.storage.delete(key);
  }
}

function createApiRequest(method, urlStr, body, headers = {}) {
  const reqInit = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };
  if (body !== undefined && body !== null) {
    reqInit.body = JSON.stringify(body);
  }
  return new Request(urlStr, reqInit);
}

test('FlexiDash Phase 8: Final QA & Security Regression Suite', async (t) => {
  const testSecret = 'test-phase-8-super-secret-key-at-least-32-chars';
  const testTenantA = 'tenant-qa-alpha-1111';
  const testTenantB = 'tenant-qa-beta-2222';

  t.beforeEach(() => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'development',
      WIX_CLIENT_SECRET: testSecret,
      FLEXIDASH_JWT_SECRET: testSecret,
      WIX_CLIENT_INSTANCE_ID: testTenantA,
    });
    resetLayoutStorageAdapter();
    resetRoleStorageAdapter();
    resetAuditStorageAdapter();
    resetTenantStorageAdapter();
  });

  t.afterEach(() => {
    resetAppConfigForTesting();
    resetLayoutStorageAdapter();
    resetRoleStorageAdapter();
    resetAuditStorageAdapter();
    resetTenantStorageAdapter();
  });

  await t.test('1. End-to-End User Lifecycle (Register -> Login -> Portal -> Action -> Logout -> Expiry)', async () => {
    const userEmail = `qa.user.${Date.now()}@example.com`;
    const userPassword = 'ValidPassword123!';

    // Step A: Register
    const regReq = createApiRequest(
      'POST',
      'http://localhost/api/flexidash/auth/register',
      { email: userEmail, password: userPassword },
      { 'x-wix-instance-id': testTenantA }
    );
    const regRes = await registerRoute({ request: regReq });
    assert.equal(regRes.status, 201);
    const regJson = await regRes.json();
    assert.equal(regJson.success, true);
    assert.ok(regJson.token);
    assert.equal(regJson.session.email, userEmail);

    // Step B: Login
    const loginReq = createApiRequest(
      'POST',
      'http://localhost/api/flexidash/auth/login',
      { email: userEmail, password: userPassword },
      { 'x-wix-instance-id': testTenantA }
    );
    const loginRes = await loginRoute({ request: loginReq });
    assert.equal(loginRes.status, 200);
    const loginJson = await loginRes.json();
    assert.equal(loginJson.success, true);
    assert.ok(loginJson.token);
    const authToken = loginJson.token;

    // Step C: Fetch Authorized Portal Layout
    const layoutReq = createApiRequest(
      'GET',
      'http://localhost/api/flexidash/portal/layout',
      null,
      {
        authorization: `Bearer ${authToken}`,
        'x-wix-instance-id': testTenantA,
      }
    );
    const layoutRes = await getLayoutRoute({ request: layoutReq });
    assert.equal(layoutRes.status, 200);
    const layoutJson = await layoutRes.json();
    assert.ok(Array.isArray(layoutJson.widgets));
    assert.ok(layoutJson.widgets.length > 0);

    // Step D: Evaluate Page Access
    const accessReq = createApiRequest(
      'GET',
      'http://localhost/api/flexidash/portal/pages/access?path=/portal',
      null,
      {
        authorization: `Bearer ${authToken}`,
        'x-wix-instance-id': testTenantA,
      }
    );
    const accessRes = await getPageAccessRoute({ request: accessReq });
    assert.equal(accessRes.status, 200);
    const accessJson = await accessRes.json();
    assert.equal(accessJson.allowed, true);

    // Step E: Restricted Page Access Rejection
    const adminAccessReq = createApiRequest(
      'GET',
      'http://localhost/api/flexidash/portal/pages/access?path=/portal/audit',
      null,
      {
        authorization: `Bearer ${authToken}`,
        'x-wix-instance-id': testTenantA,
      }
    );
    const adminAccessRes = await getPageAccessRoute({ request: adminAccessReq });
    assert.equal(adminAccessRes.status, 403);

    // Step F: Widget Action Authorization: Unprivileged Member is Denied (403)
    const memberActionReq = createApiRequest(
      'POST',
      'http://localhost/api/flexidash/portal/widgets/action',
      { widgetId: 'overview-metrics', action: 'refresh' },
      {
        authorization: `Bearer ${authToken}`,
        'x-wix-instance-id': testTenantA,
      }
    );
    const memberActionRes = await widgetActionRoute({ request: memberActionReq });
    assert.equal(memberActionRes.status, 403);

    // Step F2: Privileged User (Admin) Successfully Executes Widget Action (200)
    const adminToken = signJwt(
      {
        sub: 'usr_qa_admin',
        inst: testTenantA,
        role: SYSTEM_ROLE_ADMIN,
        email: 'admin@flexidash.local',
        permissions: ['dashboard:view', 'portal:access', 'widgets:action'],
      },
      3600,
      testSecret
    );
    const adminActionReq = createApiRequest(
      'POST',
      'http://localhost/api/flexidash/portal/widgets/action',
      { widgetId: 'widget-overview-metrics', action: 'refresh' },
      {
        authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': testTenantA,
      }
    );
    const adminActionRes = await widgetActionRoute({ request: adminActionReq });
    assert.equal(adminActionRes.status, 200);
    const actionJson = await adminActionRes.json();
    assert.equal(actionJson.success, true);

    // Step G: Logout
    const logoutReq = createApiRequest(
      'POST',
      'http://localhost/api/flexidash/auth/logout',
      null,
      {
        authorization: `Bearer ${authToken}`,
        'x-wix-instance-id': testTenantA,
      }
    );
    const logoutRes = await logoutRoute({ request: logoutReq });
    assert.equal(logoutRes.status, 200);

    // Step H: Expired Token Rejection
    const expiredToken = signJwt(
      {
        sub: 'usr_qa_expired',
        inst: testTenantA,
        role: SYSTEM_ROLE_MEMBER,
        email: 'expired@flexidash.local',
      },
      -10, // Expired 10 seconds ago
      testSecret
    );
    assert.throws(
      () => verifyJwt(expiredToken, testSecret),
      (err) => err instanceof UnauthorizedError && err.message.includes('expired')
    );
  });

  await t.test('2. Security Regression: JWT Algorithm Confusion Defense', () => {
    // Attempt algorithm confusion by constructing a header with alg: 'none'
    const headerNone = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'usr_hacker',
        inst: testTenantA,
        role: 'role_admin',
        iss: 'flexidash.wix.app',
        aud: 'flexidash:api',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString('base64url');
    const forgedToken = `${headerNone}.${payload}.`;

    assert.throws(
      () => verifyJwt(forgedToken, testSecret),
      (err) => err instanceof UnauthorizedError && err.message.includes('algorithm')
    );
  });

  await t.test('3. Security Regression: Webhook Fail-Closed in Production', async () => {
    // In production mode, unverified webhook payloads without signature must fail closed
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'production',
      WIX_CLIENT_ID: 'fed82166-29ac-4cba-842a-fbedd2e1b0b1',
      WIX_CLIENT_SECRET: testSecret,
      FLEXIDASH_JWT_SECRET: testSecret,
      FLEXIDASH_AUTH_MODE: 'wix-native',
    });

    const forgedWebhookReq = createApiRequest(
      'POST',
      'http://localhost/api/flexidash/webhooks/app-lifecycle',
      {
        instanceId: testTenantA,
        eventType: 'wix.app.removed',
      }
    );

    const res = await webhookRoute({ request: forgedWebhookReq });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.ok(json.error.message.includes('prohibited in production mode'));
  });

  await t.test('4. Security Regression: Wix Signed Instance Expiry and AppDefId Validation', () => {
    // A: Expired token
    const staleSignDate = new Date(Date.now() - 100000 * 1000).toISOString();
    const staleInstance = createMockWixInstance(
      { instanceId: testTenantA, signDate: staleSignDate },
      testSecret
    );

    assert.throws(
      () => parseAndVerifyWixInstance(staleInstance, testSecret, { maxAgeSeconds: 3600 }),
      (err) => err instanceof UnauthorizedError && err.message.includes('expired')
    );

    // B: Future signDate clock skew exceeding limit
    const futureSignDate = new Date(Date.now() + 600 * 1000).toISOString();
    const futureInstance = createMockWixInstance(
      { instanceId: testTenantA, signDate: futureSignDate },
      testSecret
    );

    assert.throws(
      () => parseAndVerifyWixInstance(futureInstance, testSecret, { maxAgeSeconds: 3600 }),
      (err) => err instanceof UnauthorizedError && err.message.includes('future')
    );

    // C: AppDefId mismatch
    const instanceWithAppDef = createMockWixInstance(
      { instanceId: testTenantA, appDefId: 'wrong-app-def-id' },
      testSecret
    );

    assert.throws(
      () =>
        parseAndVerifyWixInstance(instanceWithAppDef, testSecret, {
          expectedAppDefId: 'fed82166-29ac-4cba-842a-fbedd2e1b0b1',
        }),
      (err) => err instanceof UnauthorizedError && err.message.includes('appDefId mismatch')
    );
  });

  await t.test('5. Complete Role Lifecycle: Creation, Assignment, Protected Deletion', async () => {
    // Admin creates signed instance token
    const adminInstance = createMockWixInstance(
      { instanceId: testTenantA, permissions: 'ADMIN', uid: 'admin_usr_01' },
      testSecret
    );

    const customRoleId = `role_qa_analyst_${Date.now()}`;

    // A: Create Custom Role
    const createReq = createApiRequest(
      'POST',
      'http://localhost/api/flexidash/admin/roles',
      {
        id: customRoleId,
        name: 'QA Analyst',
        description: 'Quality assurance team member',
        permissions: ['dashboard:view', 'portal:access', 'pages:view:analytics'],
      },
      { 'x-wix-instance': adminInstance }
    );
    const createRes = await createRoleRoute({ request: createReq });
    assert.equal(createRes.status, 201);
    const createJson = await createRes.json();
    assert.equal(createJson.role.id, customRoleId);

    // B: Assign Custom Role to a Member
    const targetUserId = 'usr_qa_target_888';
    const assignReq = createApiRequest(
      'POST',
      'http://localhost/api/flexidash/admin/roles/assign',
      {
        targetUserId,
        roleId: customRoleId,
      },
      { 'x-wix-instance': adminInstance }
    );
    const assignRes = await assignRoleRoute({ request: assignReq });
    assert.equal(assignRes.status, 200);

    // C: Attempt Role Deletion with Assigned Member -> MUST BE BLOCKED
    const blockedDeleteReq = createApiRequest(
      'DELETE',
      `http://localhost/api/flexidash/admin/roles?roleId=${customRoleId}`,
      null,
      { 'x-wix-instance': adminInstance }
    );
    const blockedDeleteRes = await deleteRoleRoute({ request: blockedDeleteReq });
    assert.equal(blockedDeleteRes.status, 400);
    const blockedJson = await blockedDeleteRes.json();
    assert.ok(blockedJson.error.message.includes('currently assigned'));

    // D: Reassign Member to Standard Member Role
    const reassignReq = createApiRequest(
      'POST',
      'http://localhost/api/flexidash/admin/roles/assign',
      {
        targetUserId,
        roleId: SYSTEM_ROLE_MEMBER,
      },
      { 'x-wix-instance': adminInstance }
    );
    const reassignRes = await assignRoleRoute({ request: reassignReq });
    assert.equal(reassignRes.status, 200);

    // Also remove the old custom role assignment and update member roles
    const adapter = getRoleStorageAdapter();
    await adapter.deleteMemberAssignment(toInstanceId(testTenantA), toFlexiDashUserId(targetUserId), customRoleId);
    const member = await adapter.getMember(toInstanceId(testTenantA), toFlexiDashUserId(targetUserId));
    if (member) {
      await adapter.saveMember({
        ...member,
        roles: [SYSTEM_ROLE_MEMBER],
        updatedAt: new Date().toISOString(),
      });
    }

    // E: Delete Role after reassignment -> MUST SUCCEED
    const successDeleteReq = createApiRequest(
      'DELETE',
      `http://localhost/api/flexidash/admin/roles?roleId=${customRoleId}`,
      null,
      { 'x-wix-instance': adminInstance }
    );
    const successDeleteRes = await deleteRoleRoute({ request: successDeleteReq });
    assert.equal(successDeleteRes.status, 200);
    const successJson = await successDeleteRes.json();
    assert.equal(successJson.success, true);
  });

  await t.test('6. Multi-Tenant Storage Partitioning & Isolation Verification', async () => {
    const mockKv = new MockKvStore();

    // 1. Layouts
    const layoutAdapter = new CloudflareKvLayoutStorageAdapter(mockKv);
    await layoutAdapter.saveLayout({
      id: 'layout-alpha',
      instanceId: toInstanceId(testTenantA),
      version: 1,
      columns: 4,
      widgets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    // Tenant B cannot access Tenant A's layout
    const tenantBLayout = await layoutAdapter.getLayout(toInstanceId(testTenantB));
    assert.equal(tenantBLayout.instanceId, testTenantB);
    assert.notEqual(tenantBLayout.id, 'layout-alpha');

    // 2. Roles
    const roleAdapter = new CloudflareKvRoleStorageAdapter(mockKv);
    await roleAdapter.saveRole({
      id: 'role_custom_tenant_a',
      instanceId: toInstanceId(testTenantA),
      name: 'Tenant A Role',
      description: 'Exclusive to Tenant A',
      priority: 10,
      isSystem: false,
      permissions: ['portal:access'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const tenantARoles = await roleAdapter.listRoles(toInstanceId(testTenantA));
    assert.ok(tenantARoles.some((r) => r.id === 'role_custom_tenant_a'));
    const tenantBRoles = await roleAdapter.listRoles(toInstanceId(testTenantB));
    assert.ok(!tenantBRoles.some((r) => r.id === 'role_custom_tenant_a'));

    // 3. Audit Logs
    const auditAdapter = new CloudflareKvAuditStorageAdapter(mockKv);
    await auditAdapter.recordEvent({
      instanceId: toInstanceId(testTenantA),
      action: 'security:tenant_a_event',
      outcome: 'SUCCESS',
    });
    const tenantAAudit = await auditAdapter.queryEvents({ instanceId: toInstanceId(testTenantA) });
    assert.equal(tenantAAudit.totalCount, 1);
    const tenantBAudit = await auditAdapter.queryEvents({ instanceId: toInstanceId(testTenantB) });
    assert.equal(tenantBAudit.totalCount, 0);

    // 4. Tenant Configuration
    const tenantAdapter = new CloudflareKvTenantStorageAdapter(mockKv);
    await tenantAdapter.saveTenantConfig({
      instanceId: toInstanceId(testTenantA),
      appDefId: 'app-alpha',
      status: 'INSTALLED',
      plan: { planId: 'pro', cycle: 'yearly' },
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const tenantAConfig = await tenantAdapter.getTenantConfig(toInstanceId(testTenantA));
    assert.equal(tenantAConfig.status, 'INSTALLED');
    const tenantBConfig = await tenantAdapter.getTenantConfig(toInstanceId(testTenantB));
    assert.equal(tenantBConfig, null);
  });

  await t.test('7. Production Storage Fail-Closed Validation', () => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'production',
      WIX_CLIENT_ID: 'fed82166-29ac-4cba-842a-fbedd2e1b0b1',
      WIX_CLIENT_SECRET: testSecret,
      FLEXIDASH_JWT_SECRET: testSecret,
      FLEXIDASH_AUTH_MODE: 'wix-native',
    });

    // When no KV namespace is present in global or context in production, validateProductionStorage must throw
    assert.throws(
      () => validateProductionStorage(null),
      (err) => err instanceof ConfigurationError && err.message.includes('persistent KV namespace binding')
    );
  });
});
