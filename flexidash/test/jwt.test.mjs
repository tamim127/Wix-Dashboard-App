import test from 'node:test';
import assert from 'node:assert/strict';
import { signJwt, verifyJwt } from '../src/auth/jwt-service.ts';
import { loadAppConfig, resetAppConfigForTesting } from '../src/config/env.ts';
import { UnauthorizedError } from '../src/errors/app-error.ts';

test('FlexiDash JWT Service Suite', async (t) => {
  t.beforeEach(() => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'test',
      FLEXIDASH_JWT_SECRET: 'test-secret-key-at-least-32-characters-long!',
      FLEXIDASH_JWT_ISSUER: 'test.flexidash.app',
      FLEXIDASH_JWT_AUDIENCE: 'test:api',
      FLEXIDASH_JWT_EXPIRES_IN: '3600',
    });
  });

  await t.test('generates and verifies authentic JWT successfully', () => {
    const token = signJwt({
      sub: 'user-1234',
      inst: 'inst-5678',
      roles: ['role_member'],
      email: 'user@example.com',
    });

    const verified = verifyJwt(token);
    assert.equal(verified.sub, 'user-1234');
    assert.equal(verified.inst, 'inst-5678');
    assert.deepEqual(verified.roles, ['role_member']);
    assert.equal(verified.email, 'user@example.com');
  });

  await t.test('rejects tampered JWT signature', () => {
    const token = signJwt({
      sub: 'user-1234',
      inst: 'inst-5678',
      roles: ['role_member'],
      email: 'user@example.com',
    });

    const parts = token.split('.');
    // Alter first signature char to guarantee byte change without trailing base64 padding ambiguity
    const tamperedSig = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSig}`;

    assert.throws(
      () => {
        verifyJwt(tamperedToken);
      },
      UnauthorizedError,
      'Must reject tampered signature'
    );
  });

  await t.test('rejects expired JWT token', () => {
    // Generate token with 0 seconds duration (instantly expired)
    const token = signJwt(
      {
        sub: 'user-1234',
        inst: 'inst-5678',
        roles: ['role_member'],
        email: 'user@example.com',
      },
      -10 // Expired 10 seconds ago
    );

    assert.throws(
      () => {
        verifyJwt(token);
      },
      UnauthorizedError,
      'Must reject expired token'
    );
  });

  await t.test('rejects token signed with wrong secret', () => {
    const token = signJwt({
      sub: 'user-1234',
      inst: 'inst-5678',
      roles: ['role_member'],
      email: 'user@example.com',
    });

    assert.throws(
      () => {
        verifyJwt(token, 'attacker-secret-key-different-secret');
      },
      UnauthorizedError,
      'Must reject token when validated with wrong secret'
    );
  });
});
