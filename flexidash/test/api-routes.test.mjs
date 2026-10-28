import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as loginRoute } from '../src/pages/api/flexidash/auth/login.ts';
import { POST as registerRoute } from '../src/pages/api/flexidash/auth/register.ts';
import { POST as logoutRoute } from '../src/pages/api/flexidash/auth/logout.ts';
import { GET as layoutRoute } from '../src/pages/api/flexidash/portal/layout.ts';
import { POST as assignRoleRoute } from '../src/pages/api/flexidash/admin/roles/assign.ts';
import { DevelopmentAuthProvider } from '../src/auth/dev-provider.ts';
import { setAuthProviderForTesting } from '../src/auth/auth-factory.ts';
import { loadAppConfig, resetAppConfigForTesting } from '../src/config/env.ts';
import { toInstanceId } from '../src/models/identity.ts';

test('API Route Handlers Suite', async (t) => {
  const instanceId = toInstanceId('api-test-instance-123');

  t.beforeEach(() => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'test',
      WIX_CLIENT_INSTANCE_ID: instanceId,
      FLEXIDASH_JWT_SECRET: 'api-test-secret-at-least-32-chars-long!',
      FLEXIDASH_AUTH_MODE: 'dev-mock',
    });
    setAuthProviderForTesting(new DevelopmentAuthProvider());
  });

  await t.test('POST /api/auth/login - authenticates valid admin user', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        email: 'admin@flexidash.local',
        password: 'AdminPassword123!',
      }),
    });

    const res = await loginRoute({ request: req });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.token);
    assert.equal(data.session.email, 'admin@flexidash.local');
    assert.ok(data.session.roles.includes('role_admin'));
  });

  await t.test('POST /api/auth/login - rejects missing email and password', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    });

    const res = await loginRoute({ request: req });
    assert.equal(res.status, 400);

    const data = await res.json();
    assert.equal(data.error.code, 'VALIDATION_FAILED');
  });

  await t.test('POST /api/auth/login - rejects incorrect password', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        email: 'admin@flexidash.local',
        password: 'WrongPassword!',
      }),
    });

    const res = await loginRoute({ request: req });
    assert.equal(res.status, 401);

    const data = await res.json();
    assert.equal(data.error.code, 'UNAUTHORIZED');
  });

  await t.test('POST /api/auth/register - registers new user with 201 Created', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        email: 'newuser@example.com',
        password: 'ValidPassword123!',
      }),
    });

    const res = await registerRoute({ request: req });
    assert.equal(res.status, 201);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.token);
    assert.equal(data.session.email, 'newuser@example.com');
  });

  await t.test('POST /api/auth/register - rejects short password', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        email: 'badpw@example.com',
        password: 'short',
      }),
    });

    const res = await registerRoute({ request: req });
    assert.equal(res.status, 400);

    const data = await res.json();
    assert.equal(data.error.code, 'VALIDATION_FAILED');
  });

  await t.test('POST /api/auth/logout - handles valid authorized session logout', async () => {
    // First login to get a token
    const loginReq = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        email: 'admin@flexidash.local',
        password: 'AdminPassword123!',
      }),
    });
    const loginRes = await loginRoute({ request: loginReq });
    const { token } = await loginRes.json();

    const logoutReq = new Request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'x-wix-instance-id': instanceId,
      },
    });

    const res = await logoutRoute({ request: logoutReq });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
  });

  await t.test('GET /api/portal/layout - admin sees all widgets; unauthenticated gets 401', async () => {
    // Unauthenticated request
    const unauthReq = new Request('http://localhost/api/portal/layout', {
      method: 'GET',
    });
    const unauthRes = await layoutRoute({ request: unauthReq });
    assert.equal(unauthRes.status, 401);

    // Authenticated admin request
    const loginReq = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        email: 'admin@flexidash.local',
        password: 'AdminPassword123!',
      }),
    });
    const loginRes = await loginRoute({ request: loginReq });
    const { token } = await loginRes.json();

    const authReq = new Request('http://localhost/api/portal/layout', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        'x-wix-instance-id': instanceId,
      },
    });
    const authRes = await layoutRoute({ request: authReq });
    assert.equal(authRes.status, 200);

    const data = await authRes.json();
    assert.ok(data.widgets.length >= 5);
    assert.ok(data.widgets.some((w) => w.id === 'widget-audit-log'));
  });

  await t.test('GET /api/portal/layout - standard member only sees permitted widgets', async () => {
    const loginReq = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        email: 'member@flexidash.local',
        password: 'MemberPassword123!',
      }),
    });
    const loginRes = await loginRoute({ request: loginReq });
    const { token } = await loginRes.json();

    const authReq = new Request('http://localhost/api/portal/layout', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        'x-wix-instance-id': instanceId,
      },
    });
    const authRes = await layoutRoute({ request: authReq });
    assert.equal(authRes.status, 200);

    const data = await authRes.json();
    // Member does not have audit:view permission
    assert.ok(!data.widgets.some((w) => w.id === 'widget-audit-log'));
    // Member has dashboard:view permission
    assert.ok(data.widgets.some((w) => w.id === 'widget-overview-metrics'));
  });

  await t.test('POST /api/admin/roles/assign - admin can assign custom role to another user', async () => {
    const loginReq = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        email: 'admin@flexidash.local',
        password: 'AdminPassword123!',
      }),
    });
    const loginRes = await loginRoute({ request: loginReq });
    const { token } = await loginRes.json();

    const assignReq = new Request('http://localhost/api/admin/roles/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        targetUserId: 'dev-user-target-456',
        roleId: 'role-content-editor',
        roleName: 'Content Editor',
        permissions: ['dashboard:view', 'dashboard:edit'],
      }),
    });

    const res = await assignRoleRoute({ request: assignReq });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.assignment.roleId, 'role-content-editor');
  });

  await t.test('POST /api/admin/roles/assign - blocks self-promotion attempt', async () => {
    const loginReq = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        email: 'admin@flexidash.local',
        password: 'AdminPassword123!',
      }),
    });
    const loginRes = await loginRoute({ request: loginReq });
    const { token, session } = await loginRes.json();

    const selfAssignReq = new Request('http://localhost/api/admin/roles/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-wix-instance-id': instanceId,
      },
      body: JSON.stringify({
        targetUserId: session.userId, // Same user attempting self-elevation
        roleId: 'role-super-elevation',
        roleName: 'Super Elevation',
        permissions: ['dashboard:publish'],
      }),
    });

    const res = await assignRoleRoute({ request: selfAssignReq });
    assert.equal(res.status, 403);

    const data = await res.json();
    assert.equal(data.error.code, 'FORBIDDEN');
  });
});
