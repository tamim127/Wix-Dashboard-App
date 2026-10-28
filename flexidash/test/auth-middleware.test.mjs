import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBearerToken, authorizeRequest } from '../src/auth/middleware.ts';
import { DevelopmentAuthProvider } from '../src/auth/dev-provider.ts';
import { setAuthProviderForTesting } from '../src/auth/auth-factory.ts';
import { loadAppConfig, resetAppConfigForTesting } from '../src/config/env.ts';
import { toInstanceId } from '../src/models/identity.ts';
import { UnauthorizedError, ForbiddenError, TenantMismatchError } from '../src/errors/app-error.ts';

test('Backend Authorization Middleware Suite', async (t) => {
  const instanceA = toInstanceId('inst-site-a');
  const instanceB = toInstanceId('inst-site-b');

  t.beforeEach(() => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'test',
      FLEXIDASH_AUTH_MODE: 'dev-mock',
      WIX_CLIENT_INSTANCE_ID: 'inst-site-a',
    });
    setAuthProviderForTesting(new DevelopmentAuthProvider());
  });

  t.afterEach(() => {
    setAuthProviderForTesting(null);
  });

  await t.test('extractBearerToken extracts token from standard and case-insensitive headers', () => {
    assert.equal(extractBearerToken('Bearer my-secret-token'), 'my-secret-token');
    assert.equal(extractBearerToken('bearer my-secret-token'), 'my-secret-token');
    assert.equal(extractBearerToken('Basic user:pass'), null);
    assert.equal(extractBearerToken(''), null);
    assert.equal(extractBearerToken(null), null);
    assert.equal(extractBearerToken(undefined), null);
  });

  await t.test('authorizeRequest throws UnauthorizedError when Authorization header is missing', async () => {
    await assert.rejects(
      async () => {
        await authorizeRequest({});
      },
      UnauthorizedError,
      'Must reject unauthenticated request'
    );
  });

  await t.test('authorizeRequest passes and returns verified session for valid token', async () => {
    const provider = new DevelopmentAuthProvider();
    setAuthProviderForTesting(provider);

    const loginRes = await provider.login(
      { email: 'admin@flexidash.local', password: 'AdminPassword123!' },
      { instanceId: instanceA }
    );

    const headers = {
      authorization: `Bearer ${loginRes.flexidashJwt}`,
      'x-wix-instance-id': instanceA,
    };

    const reqContext = await authorizeRequest(headers, 'dashboard:view');
    assert.ok(reqContext.session);
    assert.equal(reqContext.session.email, 'admin@flexidash.local');
    assert.equal(reqContext.context.instanceId, instanceA);
  });

  await t.test('authorizeRequest enforces permission check and rejects unauthorized role', async () => {
    const provider = new DevelopmentAuthProvider();
    setAuthProviderForTesting(provider);

    // Standard member doesn't have roles:manage permission
    const loginRes = await provider.login(
      { email: 'member@flexidash.local', password: 'MemberPassword123!' },
      { instanceId: instanceA }
    );

    const headers = {
      authorization: `Bearer ${loginRes.flexidashJwt}`,
      'x-wix-instance-id': instanceA,
    };

    await assert.rejects(
      async () => {
        await authorizeRequest(headers, 'roles:manage');
      },
      ForbiddenError,
      'Must reject member attempting to access roles:manage'
    );
  });

  await t.test('authorizeRequest enforces tenant matching: rejects token presented with mismatched instance header', async () => {
    const provider = new DevelopmentAuthProvider();
    setAuthProviderForTesting(provider);

    const loginRes = await provider.login(
      { email: 'admin@flexidash.local', password: 'AdminPassword123!' },
      { instanceId: instanceA }
    );

    const headers = {
      authorization: `Bearer ${loginRes.flexidashJwt}`,
      'x-wix-instance-id': instanceB, // Tampered or spoofed header
    };

    await assert.rejects(
      async () => {
        await authorizeRequest(headers);
      },
      TenantMismatchError,
      'Must reject token when instance ID does not match session instance ID'
    );
  });
});
