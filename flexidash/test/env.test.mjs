import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppConfig, resetAppConfigForTesting, ConfigurationError } from '../src/config/env.ts';

test('Environment Configuration Suite', async (t) => {
  t.beforeEach(() => {
    resetAppConfigForTesting();
  });

  await t.test('loads default development configuration safely', () => {
    const config = loadAppConfig({
      NODE_ENV: 'development',
      WIX_CLIENT_ID: 'test-client-id',
      WIX_CLIENT_SECRET: 'test-client-secret',
    });

    assert.equal(config.nodeEnv, 'development');
    assert.equal(config.authMode, 'dev-mock');
    assert.equal(config.wixClientId, 'test-client-id');
    assert.ok(config.jwtSecret.length > 0);
  });

  await t.test('CRITICAL SECURITY INVARIANT: fails closed if dev-mock is requested in production', () => {
    assert.throws(
      () => {
        loadAppConfig({
          NODE_ENV: 'production',
          FLEXIDASH_AUTH_MODE: 'dev-mock',
          WIX_CLIENT_ID: 'prod-client-id',
          WIX_CLIENT_SECRET: 'prod-secret',
        });
      },
      ConfigurationError,
      'Must reject dev-mock in production environment'
    );
  });

  await t.test('requires WIX_CLIENT_ID and WIX_CLIENT_SECRET in production', () => {
    assert.throws(
      () => {
        loadAppConfig({
          NODE_ENV: 'production',
          WIX_CLIENT_ID: '',
          WIX_CLIENT_SECRET: '',
        });
      },
      ConfigurationError
    );
  });
});
