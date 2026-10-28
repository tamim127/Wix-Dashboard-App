import test from 'node:test';
import assert from 'node:assert/strict';
import { DevelopmentAuthProvider } from '../src/auth/dev-provider.ts';
import { loadAppConfig, resetAppConfigForTesting } from '../src/config/env.ts';
import { toInstanceId } from '../src/models/identity.ts';
import { SYSTEM_ROLE_ADMIN, SYSTEM_ROLE_MEMBER } from '../src/models/rbac.ts';
import { UnauthorizedError } from '../src/errors/app-error.ts';

test('Authentication Provider Suite (Dev Adapter)', async (t) => {
  const instanceA = toInstanceId('inst-site-a');
  const instanceB = toInstanceId('inst-site-b');

  t.beforeEach(() => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'test',
      FLEXIDASH_AUTH_MODE: 'dev-mock',
      WIX_CLIENT_INSTANCE_ID: 'inst-site-a',
    });
  });

  await t.test('successfully logs in pre-seeded admin user', async () => {
    const provider = new DevelopmentAuthProvider();
    const result = await provider.login(
      { email: 'admin@flexidash.local', password: 'AdminPassword123!' },
      { instanceId: instanceA }
    );

    assert.equal(result.success, true);
    assert.ok(result.session);
    assert.ok(result.flexidashJwt);
    assert.equal(result.session.roles.includes(SYSTEM_ROLE_ADMIN), true);
  });

  await t.test('rejects login with invalid password', async () => {
    const provider = new DevelopmentAuthProvider();
    await assert.rejects(
      async () => {
        await provider.login(
          { email: 'admin@flexidash.local', password: 'WrongPassword!' },
          { instanceId: instanceA }
        );
      },
      UnauthorizedError
    );
  });

  await t.test('registers new member and permits login', async () => {
    const provider = new DevelopmentAuthProvider();
    const regResult = await provider.register(
      { email: 'newuser@example.com', password: 'SecurePassword123!' },
      { instanceId: instanceA }
    );

    assert.equal(regResult.success, true);
    assert.ok(regResult.session);
    assert.equal(regResult.session.roles.includes(SYSTEM_ROLE_MEMBER), true);

    // Verify login works
    const loginResult = await provider.login(
      { email: 'newuser@example.com', password: 'SecurePassword123!' },
      { instanceId: instanceA }
    );
    assert.equal(loginResult.success, true);
  });

  await t.test('enforces tenant isolation: user registered in Site A cannot login to Site B', async () => {
    const provider = new DevelopmentAuthProvider();
    await provider.register(
      { email: 'tenantuser@example.com', password: 'SecurePassword123!' },
      { instanceId: instanceA }
    );

    // Attempt login targeting Site B
    await assert.rejects(
      async () => {
        await provider.login(
          { email: 'tenantuser@example.com', password: 'SecurePassword123!' },
          { instanceId: instanceB }
        );
      },
      UnauthorizedError,
      'User registered in Site A must not be authenticated in Site B'
    );
  });

  await t.test('resolves session from valid JWT and rejects token from different tenant', async () => {
    const provider = new DevelopmentAuthProvider();
    const loginResult = await provider.login(
      { email: 'admin@flexidash.local', password: 'AdminPassword123!' },
      { instanceId: instanceA }
    );

    // Valid resolve
    const session = await provider.resolveSession(loginResult.flexidashJwt, { instanceId: instanceA });
    assert.ok(session);
    assert.equal(session.email, 'admin@flexidash.local');

    // Mismatched tenant context resolve
    const mismatchedSession = await provider.resolveSession(loginResult.flexidashJwt, { instanceId: instanceB });
    assert.equal(mismatchedSession, null, 'Session must not resolve when presented in different tenant context');
  });
});
