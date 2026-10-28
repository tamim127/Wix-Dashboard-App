import test from 'node:test';
import assert from 'node:assert/strict';
import { FlexiDashApiClient, ApiClientError } from '../src/client/api-client.ts';
import { sessionManager } from '../src/client/session-manager.ts';
import { POST as loginRoute } from '../src/pages/api/flexidash/auth/login.ts';
import { POST as registerRoute } from '../src/pages/api/flexidash/auth/register.ts';
import { POST as logoutRoute } from '../src/pages/api/flexidash/auth/logout.ts';
import { GET as layoutRoute } from '../src/pages/api/flexidash/portal/layout.ts';
import { POST as assignRoleRoute } from '../src/pages/api/flexidash/admin/roles/assign.ts';
import { DevelopmentAuthProvider } from '../src/auth/dev-provider.ts';
import { setAuthProviderForTesting } from '../src/auth/auth-factory.ts';
import { loadAppConfig, resetAppConfigForTesting } from '../src/config/env.ts';
import { toInstanceId } from '../src/models/identity.ts';

test('Typed API Client & Session Integration Suite', async (t) => {
  const instanceId = toInstanceId('api-client-test-instance');

  // Create an in-process bridge routing fetch calls directly to the Astro route handlers
  const inProcessFetch = async (url, options = {}) => {
    const parsedUrl = new URL(url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const req = new Request(url, options);

    if (pathname === '/api/flexidash/auth/login' && options.method === 'POST') {
      return loginRoute({ request: req });
    }
    if (pathname === '/api/flexidash/auth/register' && options.method === 'POST') {
      return registerRoute({ request: req });
    }
    if (pathname === '/api/flexidash/auth/logout' && options.method === 'POST') {
      return logoutRoute({ request: req });
    }
    if (pathname === '/api/flexidash/portal/layout' && (options.method === 'GET' || !options.method)) {
      return layoutRoute({ request: req });
    }
    if (pathname === '/api/flexidash/admin/roles/assign' && options.method === 'POST') {
      return assignRoleRoute({ request: req });
    }

    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  t.beforeEach(() => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'test',
      WIX_CLIENT_INSTANCE_ID: instanceId,
      FLEXIDASH_JWT_SECRET: 'api-client-secret-key-at-least-32-chars-long!',
      FLEXIDASH_AUTH_MODE: 'dev-mock',
    });
    setAuthProviderForTesting(new DevelopmentAuthProvider());
    sessionManager.clearSession();
  });

  await t.test('login() - successful login updates SessionManager and returns session data', async () => {
    const client = new FlexiDashApiClient({
      fetchFn: inProcessFetch,
      instanceId,
    });

    const res = await client.login({
      email: 'admin@flexidash.local',
      password: 'AdminPassword123!',
    });

    assert.equal(res.success, true);
    assert.ok(res.token);
    assert.equal(res.session.email, 'admin@flexidash.local');

    // Verify SessionManager was automatically updated
    assert.equal(sessionManager.isAuthenticated(), true);
    assert.equal(sessionManager.getToken(), res.token);
    assert.equal(sessionManager.getSession()?.email, 'admin@flexidash.local');
  });

  await t.test('login() - failed login throws ApiClientError and does NOT set session', async () => {
    const client = new FlexiDashApiClient({
      fetchFn: inProcessFetch,
      instanceId,
    });

    await assert.rejects(
      async () => {
        await client.login({
          email: 'admin@flexidash.local',
          password: 'IncorrectPassword!',
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.errorCode, 'UNAUTHORIZED');
        return true;
      }
    );

    assert.equal(sessionManager.isAuthenticated(), false);
    assert.equal(sessionManager.getToken(), null);
  });

  await t.test('register() - validation failure throws ApiClientError with status 400', async () => {
    const client = new FlexiDashApiClient({
      fetchFn: inProcessFetch,
      instanceId,
    });

    await assert.rejects(
      async () => {
        await client.register({
          email: 'newuser@example.com',
          password: '123', // Too short (< 8 chars)
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.errorCode, 'VALIDATION_FAILED');
        return true;
      }
    );

    assert.equal(sessionManager.isAuthenticated(), false);
  });

  await t.test('register() - successful registration stores session in SessionManager', async () => {
    const client = new FlexiDashApiClient({
      fetchFn: inProcessFetch,
      instanceId,
    });

    const res = await client.register({
      email: 'clientreg@example.com',
      password: 'StrongPassword123!',
    });

    assert.equal(res.success, true);
    assert.ok(res.token);
    assert.equal(res.session.email, 'clientreg@example.com');
    assert.equal(sessionManager.isAuthenticated(), true);
  });

  await t.test('getPortalLayout() - unauthenticated request fails closed with 401', async () => {
    const client = new FlexiDashApiClient({
      fetchFn: inProcessFetch,
      instanceId,
    });

    // Ensure session is cleared
    sessionManager.clearSession();

    await assert.rejects(
      async () => {
        await client.getPortalLayout();
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  await t.test('getPortalLayout() - authenticated admin retrieves all role-permitted widgets', async () => {
    const client = new FlexiDashApiClient({
      fetchFn: inProcessFetch,
      instanceId,
    });

    // Authenticate first
    await client.login({
      email: 'admin@flexidash.local',
      password: 'AdminPassword123!',
    });

    const layout = await client.getPortalLayout();
    assert.ok(layout.widgets.length >= 5);
    assert.ok(layout.widgets.some((w) => w.id === 'widget-audit-log'));
    assert.equal(layout.layout.columns, 4);
  });

  await t.test('assignRole() - admin successfully assigns custom role to another user', async () => {
    const client = new FlexiDashApiClient({
      fetchFn: inProcessFetch,
      instanceId,
    });

    await client.login({
      email: 'admin@flexidash.local',
      password: 'AdminPassword123!',
    });

    const res = await client.assignRole({
      targetUserId: 'target-member-888',
      roleId: 'role_vip',
      roleName: 'VIP Client',
      permissions: ['dashboard:view', 'portal:access'],
    });

    assert.equal(res.success, true);
    assert.equal(res.assignment.targetUserId, 'target-member-888');
    assert.equal(res.assignment.roleId, 'role_vip');
  });

  await t.test('assignRole() - surfaces 403 error on self-promotion violation', async () => {
    const client = new FlexiDashApiClient({
      fetchFn: inProcessFetch,
      instanceId,
    });

    const loginRes = await client.login({
      email: 'admin@flexidash.local',
      password: 'AdminPassword123!',
    });

    await assert.rejects(
      async () => {
        await client.assignRole({
          targetUserId: loginRes.session.userId, // Self-promotion attempt
          roleId: 'role_custom_elevated',
          roleName: 'Elevated Role',
        });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.errorCode, 'FORBIDDEN');
        assert.match(err.message, /Self-promotion/);
        return true;
      }
    );
  });

  await t.test('logout() - purges in-memory session token on logout', async () => {
    const client = new FlexiDashApiClient({
      fetchFn: inProcessFetch,
      instanceId,
    });

    await client.login({
      email: 'admin@flexidash.local',
      password: 'AdminPassword123!',
    });
    assert.equal(sessionManager.isAuthenticated(), true);

    const logoutRes = await client.logout();
    assert.equal(logoutRes.success, true);
    assert.equal(sessionManager.isAuthenticated(), false);
    assert.equal(sessionManager.getToken(), null);
    assert.equal(sessionManager.getSession(), null);
  });

  await t.test('network and malformed error handling', async () => {
    // Client pointing to an endpoint that throws a simulated network error
    const brokenFetch = async () => {
      throw new Error('Connection refused');
    };

    const client = new FlexiDashApiClient({
      fetchFn: brokenFetch,
      instanceId,
    });

    await assert.rejects(
      async () => {
        await client.login({ email: 'a@b.com', password: 'password123' });
      },
      (err) => {
        assert.ok(err instanceof ApiClientError);
        assert.equal(err.errorCode, 'NETWORK_ERROR');
        assert.equal(err.statusCode, 0);
        return true;
      }
    );
  });

  await t.test('SessionManager subscription notification lifecycle', () => {
    let capturedSession = undefined;
    const unsubscribe = sessionManager.subscribe((s) => {
      capturedSession = s;
    });

    assert.equal(capturedSession, null);

    const dummySession = {
      userId: 'usr-123',
      instanceId,
      roles: ['role_member'],
      permissions: ['dashboard:view'],
      email: 'subtest@example.com',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    sessionManager.setSession('dummy-token', dummySession);
    assert.equal(capturedSession?.email, 'subtest@example.com');

    sessionManager.clearSession();
    assert.equal(capturedSession, null);

    unsubscribe();
  });
});

