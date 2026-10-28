/**
 * FlexiDash Phase 7 Test Suite: Live Wix Integration, Installation Lifecycle & App Market Readiness
 *
 * Verifies:
 * 1. Cryptographic Wix signed instance token parsing, HMAC verification, and tampering defense
 * 2. Direct authentication via signed x-wix-instance in backend middleware
 * 3. App lifecycle webhook handling: wix.app.installed, wix.app.removed, wix.app.plan_changed
 * 4. Reinstall idempotency and tenant configuration persistence
 * 5. Multi-tenant lifecycle isolation (Tenant A actions never impact Tenant B)
 * 6. Wix CRM Member service query delegation, error resilience, and distinct identity assertions
 * 7. Production configuration fail-closed invariants and Cloudflare KV validation
 * 8. Cloudflare KV tenant configuration storage adapter persistence
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseAndVerifyWixInstance,
  createMockWixInstance,
} from '../src/auth/wix-instance-validator.ts';
import { authorizeRequest } from '../src/auth/middleware.ts';
import { AppLifecycleService } from '../src/tenant/lifecycle-service.ts';
import { POST as appLifecycleRoute } from '../src/pages/api/flexidash/webhooks/app-lifecycle.ts';
import { WixCrmMemberService } from '../src/crm/wix-crm-service.ts';
import { FileTenantStorageAdapter } from '../src/tenant/storage/file-tenant-storage.ts';
import { CloudflareKvTenantStorageAdapter } from '../src/tenant/storage/cloudflare-kv-tenant-storage.ts';
import {
  setTenantStorageAdapterForTesting,
  resetTenantStorageAdapter,
} from '../src/tenant/storage/tenant-storage-factory.ts';
import {
  validateProductionStorage,
} from '../src/layout/storage/storage-factory.ts';
import { loadAppConfig, resetAppConfigForTesting, ConfigurationError } from '../src/config/env.ts';
import { UnauthorizedError } from '../src/errors/app-error.ts';
import {
  toInstanceId,
  toWixMemberId,
  toWixContactId,
  assertDistinctIdentityTypes,
} from '../src/models/identity.ts';
import { SYSTEM_ROLE_OWNER, SYSTEM_ROLE_ADMIN } from '../src/models/rbac.ts';

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

test('FlexiDash Phase 7: Live Wix Integration & Lifecycle Suite', async (t) => {
  const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const testTenantA = toInstanceId(`tenant-p7-a-${Date.now()}`);
  const testTenantB = toInstanceId(`tenant-p7-b-${Date.now()}`);

  const tenantFileAdapter = new FileTenantStorageAdapter();

  t.beforeEach(async () => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'test',
      WIX_CLIENT_INSTANCE_ID: testTenantA,
      WIX_CLIENT_SECRET: testSecret,
      FLEXIDASH_JWT_SECRET: testSecret,
      FLEXIDASH_AUTH_MODE: 'dev-mock',
    });
    resetTenantStorageAdapter();
    setTenantStorageAdapterForTesting(tenantFileAdapter);
    await tenantFileAdapter.clearForTesting(testTenantA);
    await tenantFileAdapter.clearForTesting(testTenantB);
  });

  t.after(async () => {
    resetTenantStorageAdapter();
    await tenantFileAdapter.clearForTesting(testTenantA);
    await tenantFileAdapter.clearForTesting(testTenantB);
  });

  await t.test('1. Wix Signed Instance Token Verification & Tampering Defense', async () => {
    // 1.1 Valid signed instance
    const validInstanceToken = createMockWixInstance({
      instanceId: testTenantA,
      appDefId: 'fed82166-29ac-4cba-842a-fbedd2e1b0b1',
      uid: 'user-wix-owner-123',
      permissions: 'OWNER',
      demoMode: false,
    }, testSecret);

    const verified = parseAndVerifyWixInstance(validInstanceToken, testSecret);
    assert.equal(verified.instanceId, testTenantA);
    assert.equal(verified.uid, 'user-wix-owner-123');
    assert.equal(verified.permissions, 'OWNER');
    assert.equal(verified.demoMode, false);

    // 1.2 Signature tampering defense (flip last character of signature)
    const parts = validInstanceToken.split('.');
    const tamperedSignature = (parts[0][0] === 'a' ? 'b' : 'a') + parts[0].slice(1);
    const tamperedToken = `${tamperedSignature}.${parts[1]}`;

    assert.throws(
      () => parseAndVerifyWixInstance(tamperedToken, testSecret),
      (err) => {
        assert.ok(err instanceof UnauthorizedError);
        assert.match(err.message, /Invalid cryptographic signature/);
        return true;
      }
    );

    // 1.3 Secret mismatch defense
    assert.throws(
      () => parseAndVerifyWixInstance(validInstanceToken, 'wrong-wix-secret-key-32chars!'),
      (err) => {
        assert.ok(err instanceof UnauthorizedError);
        assert.match(err.message, /Invalid cryptographic signature/);
        return true;
      }
    );

    // 1.4 Malformed tokens
    assert.throws(() => parseAndVerifyWixInstance('', testSecret), UnauthorizedError);
    assert.throws(() => parseAndVerifyWixInstance('invalid-not-two-parts', testSecret), UnauthorizedError);
  });

  await t.test('2. Direct Authentication via x-wix-instance in Middleware', async () => {
    // 2.1 Owner signed instance grants full administrative session
    const ownerInstanceToken = createMockWixInstance({
      instanceId: testTenantA,
      uid: 'site-owner-789',
      permissions: 'OWNER',
    }, testSecret);

    const { session: ownerSession } = await authorizeRequest({
      'x-wix-instance': ownerInstanceToken,
    });

    assert.equal(ownerSession.instanceId, testTenantA);
    assert.ok(ownerSession.roles.includes(SYSTEM_ROLE_OWNER));
    assert.ok(ownerSession.permissions.includes('roles:manage'));
    assert.ok(ownerSession.permissions.includes('audit:view'));

    // 2.2 Admin signed instance grants admin role
    const adminInstanceToken = createMockWixInstance({
      instanceId: testTenantA,
      uid: 'site-admin-456',
      permissions: 'ADMIN',
    }, testSecret);

    const { session: adminSession } = await authorizeRequest({
      'x-wix-instance': adminInstanceToken,
    });

    assert.equal(adminSession.instanceId, testTenantA);
    assert.ok(adminSession.roles.includes(SYSTEM_ROLE_ADMIN));

    // 2.3 Invalid signed instance fails closed
    await assert.rejects(
      async () => {
        await authorizeRequest({ 'x-wix-instance': 'bad.signature' });
      },
      (err) => {
        assert.ok(err instanceof UnauthorizedError);
        return true;
      }
    );
  });

  await t.test('3. App Installation Lifecycle Webhook (Install, Reinstall, Plan, Uninstall)', async () => {
    const ownerToken = createMockWixInstance({
      instanceId: testTenantA,
      permissions: 'OWNER',
    }, testSecret);

    // 3.1 Handle wix.app.installed
    const installReq = new Request('http://localhost/api/flexidash/webhooks/app-lifecycle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance': ownerToken,
      },
      body: JSON.stringify({
        eventType: 'wix.app.installed',
        instanceId: testTenantA,
        planId: 'free',
        siteDisplayName: 'My Test Wix Site',
        siteUrl: 'https://mysite.wixsite.com/portal',
      }),
    });

    const installRes = await appLifecycleRoute({ request: installReq });
    assert.equal(installRes.status, 200);
    const installData = await installRes.json();
    assert.equal(installData.success, true);
    assert.equal(installData.result.config.status, 'installed');
    assert.equal(installData.result.config.planId, 'free');

    // 3.2 Idempotent Reinstall: second install event updates timestamp without destroying data
    const reinstallReq = new Request('http://localhost/api/flexidash/webhooks/app-lifecycle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance': ownerToken,
      },
      body: JSON.stringify({
        eventType: 'wix.app.installed',
        instanceId: testTenantA,
        planId: 'free',
      }),
    });

    const reinstallRes = await appLifecycleRoute({ request: reinstallReq });
    assert.equal(reinstallRes.status, 200);
    const reinstallData = await reinstallRes.json();
    assert.equal(reinstallData.result.config.status, 'installed');

    // 3.3 Paid Plan Change event
    const planReq = new Request('http://localhost/api/flexidash/webhooks/app-lifecycle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance': ownerToken,
      },
      body: JSON.stringify({
        eventType: 'wix.app.plan_changed',
        instanceId: testTenantA,
        planId: 'premium_pro',
      }),
    });

    const planRes = await appLifecycleRoute({ request: planReq });
    assert.equal(planRes.status, 200);
    const planData = await planRes.json();
    assert.equal(planData.result.config.planId, 'premium_pro');

    // 3.4 Uninstallation event
    const uninstallReq = new Request('http://localhost/api/flexidash/webhooks/app-lifecycle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wix-instance': ownerToken,
      },
      body: JSON.stringify({
        eventType: 'wix.app.removed',
        instanceId: testTenantA,
      }),
    });

    const uninstallRes = await appLifecycleRoute({ request: uninstallReq });
    assert.equal(uninstallRes.status, 200);
    const uninstallData = await uninstallRes.json();
    assert.equal(uninstallData.result.config.status, 'uninstalled');
    assert.ok(uninstallData.result.config.uninstalledAt);
  });

  await t.test('4. Multi-Tenant Lifecycle Isolation', async () => {
    // 4.1 Install both Tenant A and Tenant B
    await AppLifecycleService.handleAppInstalled({
      instanceId: testTenantA,
      planId: 'free',
    });
    await AppLifecycleService.handleAppInstalled({
      instanceId: testTenantB,
      planId: 'vip_enterprise',
    });

    const adapter = new FileTenantStorageAdapter();
    const configA = await adapter.getTenantConfig(testTenantA);
    const configB = await adapter.getTenantConfig(testTenantB);

    assert.equal(configA?.status, 'installed');
    assert.equal(configA?.planId, 'free');
    assert.equal(configB?.status, 'installed');
    assert.equal(configB?.planId, 'vip_enterprise');

    // 4.2 Uninstall Tenant A -> MUST NOT impact Tenant B
    await AppLifecycleService.handleAppUninstalled({ instanceId: testTenantA });

    const updatedConfigA = await adapter.getTenantConfig(testTenantA);
    const updatedConfigB = await adapter.getTenantConfig(testTenantB);

    assert.equal(updatedConfigA?.status, 'uninstalled');
    assert.equal(updatedConfigB?.status, 'installed');
    assert.equal(updatedConfigB?.planId, 'vip_enterprise');
  });

  await t.test('5. Wix CRM & Member Service Integration & Fallback', async () => {
    // 5.1 When running locally without live Wix client, returns local synthetic data with explicit status
    const result = await WixCrmMemberService.getTenantMembers(testTenantA);
    assert.ok(result.members.length >= 2);
    assert.equal(result.isDemoData, true);
    assert.ok(result.platformStatus.includes('LOCAL_ADAPTER'));

    // 5.2 Identity isolation assertion: memberId vs contactId distinct check
    const memberId = toWixMemberId('wm_uuid_001');
    const contactId = toWixContactId('wc_uuid_002');
    assert.doesNotThrow(() => assertDistinctIdentityTypes(memberId, contactId));

    // Conflation violation check
    const identicalId = 'shared_uuid_999';
    assert.throws(
      () => assertDistinctIdentityTypes(toWixMemberId(identicalId), toWixContactId(identicalId)),
      /Security Violation/
    );
  });

  await t.test('6. Production Configuration Fail-Closed Invariants', async () => {
    // 6.1 In production mode, validateProductionStorage rejects missing KV bindings
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'production',
      WIX_CLIENT_ID: 'app-prod-123',
      WIX_CLIENT_SECRET: testSecret,
      FLEXIDASH_JWT_SECRET: testSecret,
      FLEXIDASH_AUTH_MODE: 'wix-native',
    });

    assert.throws(
      () => validateProductionStorage(null),
      (err) => {
        assert.ok(err instanceof ConfigurationError);
        assert.match(err.message, /In production Cloudflare Worker deployment, a persistent KV namespace/);
        return true;
      }
    );

    // 6.2 When KV binding is present in production, validation succeeds
    const mockKv = new MockKV();
    assert.doesNotThrow(() => validateProductionStorage(mockKv));

    // 6.3 Rejects dev-mock in production
    resetAppConfigForTesting();
    assert.throws(
      () => {
        loadAppConfig({
          NODE_ENV: 'production',
          WIX_CLIENT_ID: 'app-prod-123',
          WIX_CLIENT_SECRET: testSecret,
          FLEXIDASH_AUTH_MODE: 'dev-mock',
        });
      },
      (err) => {
        assert.ok(err instanceof ConfigurationError);
        assert.match(err.message, /FLEXIDASH_AUTH_MODE=dev-mock is strictly forbidden in production mode/);
        return true;
      }
    );
  });

  await t.test('7. Cloudflare KV Tenant Storage Adapter', async () => {
    const mockKv = new MockKV();
    const kvAdapter = new CloudflareKvTenantStorageAdapter(mockKv);

    const now = new Date().toISOString();
    await kvAdapter.saveTenantConfig({
      instanceId: testTenantA,
      appDefId: 'fed82166-29ac-4cba-842a-fbedd2e1b0b1',
      status: 'installed',
      installedAt: now,
      updatedAt: now,
      planId: 'enterprise',
    });

    const retrieved = await kvAdapter.getTenantConfig(testTenantA);
    assert.ok(retrieved);
    assert.equal(retrieved.status, 'installed');
    assert.equal(retrieved.planId, 'enterprise');

    // Tenant B returns null (strict partition)
    const emptyB = await kvAdapter.getTenantConfig(testTenantB);
    assert.equal(emptyB, null);

    // Delete
    await kvAdapter.deleteTenantConfig(testTenantA);
    const deleted = await kvAdapter.getTenantConfig(testTenantA);
    assert.equal(deleted, null);
  });
});
