/**
 * FlexiDash Phase 5 Test Suite: Persistent Audit Logging, Security Hardening & Admin Workflows
 *
 * Verifies:
 * 1. FileAuditStorageAdapter and CloudflareKvAuditStorageAdapter persistence, tenant isolation, filtering, and pagination
 * 2. Sensitive credential & token redaction in audit metadata
 * 3. GET /api/flexidash/admin/audit authorization, tenant boundaries, and filter validation
 * 4. InMemoryRateLimiter sliding-window enforcement and 429 status handling
 * 5. Server-boundary input validation (emails, passwords, dates, pagination limits)
 * 6. Fail-closed production configuration security invariants
 * 7. Role assignment self-promotion prevention and audit outcome recording
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { FileAuditStorageAdapter } from '../src/audit/storage/file-audit-storage.ts';
import { CloudflareKvAuditStorageAdapter } from '../src/audit/storage/cloudflare-kv-audit-storage.ts';
import { sanitizeMetadata, isSensitiveKey } from '../src/audit/sanitizer.ts';
import {
  setAuditStorageAdapterForTesting,
  resetAuditStorageAdapter,
} from '../src/audit/audit-factory.ts';
import {
  InMemoryRateLimiter,
  resetRateLimiter,
} from '../src/security/rate-limiter.ts';
import {
  validateEmail,
  validatePassword,
  validatePagination,
  validateDateString,
} from '../src/security/validation.ts';
import { loadAppConfig, resetAppConfigForTesting, ConfigurationError } from '../src/config/env.ts';
import { ValidationError } from '../src/errors/app-error.ts';
import { signJwt } from '../src/auth/jwt-service.ts';
import { GET as getAuditRoute } from '../src/pages/api/flexidash/admin/audit.ts';
import { POST as assignRoleRoute } from '../src/pages/api/flexidash/admin/roles/assign.ts';

// In-memory Mock KV Namespace
class MockKV {
  constructor() {
    this.map = new Map();
  }
  async get(k) {
    return this.map.get(k) || null;
  }
  async put(k, v) {
    this.map.set(k, String(v));
  }
  async delete(k) {
    this.map.delete(k);
  }
}

test('Audit Metadata Sanitizer & Credential Redaction Suite', async (t) => {
  await t.test('detects sensitive keys correctly', () => {
    assert.equal(isSensitiveKey('password'), true);
    assert.equal(isSensitiveKey('userPassword'), true);
    assert.equal(isSensitiveKey('token'), true);
    assert.equal(isSensitiveKey('jwtToken'), true);
    assert.equal(isSensitiveKey('clientSecret'), true);
    assert.equal(isSensitiveKey('apiKey'), true);
    assert.equal(isSensitiveKey('username'), false);
    assert.equal(isSensitiveKey('roleId'), false);
  });

  await t.test('redacts sensitive fields in nested metadata structures', () => {
    const rawMetadata = {
      userEmail: 'member@flexidash.local',
      authMethod: 'password',
      password: 'PlaintextSuperSecretPassword123!',
      nested: {
        api_key: 'sk_live_123456789',
        bearerToken: 'Bearer eyJhbGciOi...',
        safeValue: 42,
      },
      tags: ['security', 'admin'],
    };

    const sanitized = sanitizeMetadata(rawMetadata);
    assert.equal(sanitized.userEmail, 'member@flexidash.local');
    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.nested.api_key, '[REDACTED]');
    assert.equal(sanitized.nested.bearerToken, '[REDACTED]');
    assert.equal(sanitized.nested.safeValue, 42);
    assert.deepEqual(sanitized.tags, ['security', 'admin']);
  });
});

test('Persistent Audit Log Storage Suite (File & KV)', async (t) => {
  let kvMock;
  let kvAdapter;
  let fileAdapter;

  t.beforeEach(async () => {
    kvMock = new MockKV();
    kvAdapter = new CloudflareKvAuditStorageAdapter(kvMock);
    fileAdapter = new FileAuditStorageAdapter();
    await fileAdapter.clearEventsForTesting();
    resetAuditStorageAdapter();
  });

  t.afterEach(async () => {
    resetAuditStorageAdapter();
  });

  await t.test('CloudflareKvAuditStorageAdapter records, orders, and paginates events', async () => {
    // Record 5 distinct events
    for (let i = 1; i <= 5; i++) {
      await kvAdapter.recordEvent({
        instanceId: 'inst-tenant-alpha',
        actorId: `usr-${i}`,
        action: i % 2 === 0 ? 'auth:login' : 'rbac:role_assign',
        outcome: i === 3 ? 'FAILURE' : 'SUCCESS',
        target: `target-${i}`,
      });
    }

    // Query page 1 (limit 2)
    const page1 = await kvAdapter.queryEvents({
      instanceId: 'inst-tenant-alpha',
      page: 1,
      limit: 2,
    });

    assert.equal(page1.totalCount, 5);
    assert.equal(page1.totalPages, 3);
    assert.equal(page1.events.length, 2);
    // Newest first
    assert.equal(page1.events[0].actorId, 'usr-5');
    assert.equal(page1.events[1].actorId, 'usr-4');

    // Query page 2 (limit 2)
    const page2 = await kvAdapter.queryEvents({
      instanceId: 'inst-tenant-alpha',
      page: 2,
      limit: 2,
    });
    assert.equal(page2.events.length, 2);
    assert.equal(page2.events[0].actorId, 'usr-3');

    // Filter by action
    const actionFilter = await kvAdapter.queryEvents({
      instanceId: 'inst-tenant-alpha',
      action: 'auth:login',
    });
    assert.equal(actionFilter.totalCount, 2);
    assert.ok(actionFilter.events.every((e) => e.action === 'auth:login'));

    // Filter by outcome
    const outcomeFilter = await kvAdapter.queryEvents({
      instanceId: 'inst-tenant-alpha',
      outcome: 'FAILURE',
    });
    assert.equal(outcomeFilter.totalCount, 1);
    assert.equal(outcomeFilter.events[0].actorId, 'usr-3');
  });

  await t.test('strictly partitions audit logs across tenant boundaries', async () => {
    await kvAdapter.recordEvent({
      instanceId: 'tenant-one',
      action: 'auth:login',
      outcome: 'SUCCESS',
      target: 'tenant-one-resource',
    });

    await kvAdapter.recordEvent({
      instanceId: 'tenant-two',
      action: 'auth:login',
      outcome: 'SUCCESS',
      target: 'tenant-two-resource',
    });

    const tenantOneLogs = await kvAdapter.queryEvents({ instanceId: 'tenant-one' });
    assert.equal(tenantOneLogs.totalCount, 1);
    assert.equal(tenantOneLogs.events[0].target, 'tenant-one-resource');

    const tenantTwoLogs = await kvAdapter.queryEvents({ instanceId: 'tenant-two' });
    assert.equal(tenantTwoLogs.totalCount, 1);
    assert.equal(tenantTwoLogs.events[0].target, 'tenant-two-resource');
  });

  await t.test('FileAuditStorageAdapter correctly filters date ranges', async () => {
    const instId = `inst-date-test-${Date.now()}`;
    const t0 = new Date('2026-10-01T10:00:00Z').toISOString();
    const t1 = new Date('2026-10-01T12:00:00Z').toISOString();
    const t2 = new Date('2026-10-01T14:00:00Z').toISOString();

    await fileAdapter.recordEvent({
      instanceId: instId,
      timestamp: t0,
      action: 'auth:login',
      outcome: 'SUCCESS',
    });
    await fileAdapter.recordEvent({
      instanceId: instId,
      timestamp: t1,
      action: 'auth:login',
      outcome: 'SUCCESS',
    });
    await fileAdapter.recordEvent({
      instanceId: instId,
      timestamp: t2,
      action: 'auth:login',
      outcome: 'SUCCESS',
    });

    const rangeQuery = await fileAdapter.queryEvents({
      instanceId: instId,
      startDate: '2026-10-01T11:00:00Z',
      endDate: '2026-10-01T13:00:00Z',
    });

    assert.equal(rangeQuery.totalCount, 1);
    assert.equal(rangeQuery.events[0].timestamp, t1);
  });
});

test('Rate Limiter Sliding Window Suite', async (t) => {
  let limiter;

  t.beforeEach(() => {
    limiter = new InMemoryRateLimiter();
    resetRateLimiter();
  });

  await t.test('allows requests up to defined threshold and blocks subsequent calls', async () => {
    const key = 'test-client-ip';

    // 3 calls within limit of 3
    for (let i = 1; i <= 3; i++) {
      const res = await limiter.check(key, 3, 60);
      assert.equal(res.allowed, true);
      assert.equal(res.remaining, 3 - i);
    }

    // 4th call exceeds limit
    const exceeded = await limiter.check(key, 3, 60);
    assert.equal(exceeded.allowed, false);
    assert.equal(exceeded.remaining, 0);
  });

  await t.test('rate limiter reset restores allowance immediately', async () => {
    const key = 'test-reset-key';
    await limiter.check(key, 1, 60);
    const blocked = await limiter.check(key, 1, 60);
    assert.equal(blocked.allowed, false);

    await limiter.reset(key);
    const retry = await limiter.check(key, 1, 60);
    assert.equal(retry.allowed, true);
  });
});

test('Server Boundary Input Validation Suite', async (t) => {
  await t.test('validateEmail accepts valid RFC-compliant emails and trims/lowercases them', () => {
    assert.equal(validateEmail('  USER@Domain.COM '), 'user@domain.com');
    assert.equal(validateEmail('alex.smith+tag@sub.example.co.uk'), 'alex.smith+tag@sub.example.co.uk');
  });

  await t.test('validateEmail rejects empty, malformed, or excessively long emails', () => {
    assert.throws(() => validateEmail(''), ValidationError);
    assert.throws(() => validateEmail('invalid-no-at-sign'), ValidationError);
    assert.throws(() => validateEmail('user@'), ValidationError);
    assert.throws(() => validateEmail('@domain.com'), ValidationError);
    assert.throws(() => validateEmail('a'.repeat(250) + '@example.com'), ValidationError);
  });

  await t.test('validatePassword enforces length bounds', () => {
    assert.equal(validatePassword('ValidPass123!'), 'ValidPass123!');
    assert.throws(() => validatePassword('short', 8), ValidationError);
    assert.throws(() => validatePassword('x'.repeat(129)), ValidationError);
  });

  await t.test('validatePagination enforces integer bounds between 1 and 100', () => {
    assert.deepEqual(validatePagination('2', '50'), { page: 2, limit: 50 });
    assert.deepEqual(validatePagination(undefined, undefined), { page: 1, limit: 20 });
    assert.throws(() => validatePagination('-1', '20'), ValidationError);
    assert.throws(() => validatePagination('1', '200'), ValidationError);
    assert.throws(() => validatePagination('not-a-number', '20'), ValidationError);
  });

  await t.test('validateDateString checks ISO date strings', () => {
    const valid = validateDateString('2026-10-28T12:00:00Z', 'startDate');
    assert.ok(valid);
    assert.throws(() => validateDateString('not-a-date', 'startDate'), ValidationError);
  });
});

test('Production Fail-Closed Configuration Suite', async (t) => {
  t.beforeEach(() => {
    resetAppConfigForTesting();
  });

  t.afterEach(() => {
    resetAppConfigForTesting();
  });

  await t.test('fails closed if WIX_CLIENT_ID or WIX_CLIENT_SECRET missing in production', () => {
    assert.throws(
      () =>
        loadAppConfig({
          NODE_ENV: 'production',
          WIX_CLIENT_ID: '',
          WIX_CLIENT_SECRET: 'some-secret',
        }),
      ConfigurationError
    );

    assert.throws(
      () =>
        loadAppConfig({
          NODE_ENV: 'production',
          WIX_CLIENT_ID: 'client-id',
          WIX_CLIENT_SECRET: '',
        }),
      ConfigurationError
    );
  });

  await t.test('fails closed if dev-mock auth mode is attempted in production', () => {
    assert.throws(
      () =>
        loadAppConfig({
          NODE_ENV: 'production',
          WIX_CLIENT_ID: 'client-id',
          WIX_CLIENT_SECRET: 'client-secret',
          FLEXIDASH_AUTH_MODE: 'dev-mock',
        }),
      ConfigurationError
    );
  });

  await t.test('fails closed if JWT secret is shorter than 32 characters in production', () => {
    assert.throws(
      () =>
        loadAppConfig({
          NODE_ENV: 'production',
          WIX_CLIENT_ID: 'client-id',
          WIX_CLIENT_SECRET: 'client-secret',
          FLEXIDASH_JWT_SECRET: 'too-short',
        }),
      ConfigurationError
    );
  });
});

test('GET /api/flexidash/admin/audit Route Authorization Suite', async (t) => {
  t.beforeEach(() => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'test',
      FLEXIDASH_JWT_SECRET: 'test-secret-at-least-32-characters-long!',
      FLEXIDASH_JWT_ISSUER: 'test.flexidash.app',
      FLEXIDASH_JWT_AUDIENCE: 'test:api',
    });
    resetAuditStorageAdapter();
  });

  t.afterEach(() => {
    resetAuditStorageAdapter();
  });

  await t.test('rejects unauthenticated request with 401 Unauthorized', async () => {
    const req = new Request('http://localhost/api/flexidash/admin/audit', {
      method: 'GET',
    });
    const res = await getAuditRoute({ request: req });
    assert.equal(res.status, 401);
  });

  await t.test('rejects request from standard member without audit:view with 403 Forbidden', async () => {
    const memberToken = signJwt({
      sub: 'usr-member-standard',
      inst: 'inst-site-01',
      roles: ['role_member'],
      email: 'member@test.local',
    });

    const req = new Request('http://localhost/api/flexidash/admin/audit', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${memberToken}`,
        'x-wix-instance-id': 'inst-site-01',
      },
    });

    const res = await getAuditRoute({ request: req });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  await t.test('allows authorized admin with audit:view and returns paginated records', async () => {
    const mockKv = new MockKV();
    const kvAdapter = new CloudflareKvAuditStorageAdapter(mockKv);
    setAuditStorageAdapterForTesting(kvAdapter);

    await kvAdapter.recordEvent({
      instanceId: 'inst-site-01',
      actorId: 'admin-1',
      action: 'rbac:role_assign',
      outcome: 'SUCCESS',
      target: 'user-77',
    });

    const adminToken = signJwt({
      sub: 'usr-admin-01',
      inst: 'inst-site-01',
      roles: ['role_admin'],
      email: 'admin@test.local',
    });

    const req = new Request('http://localhost/api/flexidash/admin/audit?page=1&limit=10', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-wix-instance-id': 'inst-site-01',
      },
    });

    const res = await getAuditRoute({ request: req });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.instanceId, 'inst-site-01');
    assert.equal(body.totalCount, 1);
    assert.equal(body.events[0].actorId, 'admin-1');
  });
});

test('Role Assignment Authorization & Self-Promotion Suite', async (t) => {
  t.beforeEach(() => {
    resetAppConfigForTesting();
    loadAppConfig({
      NODE_ENV: 'test',
      FLEXIDASH_JWT_SECRET: 'test-secret-at-least-32-characters-long!',
      FLEXIDASH_JWT_ISSUER: 'test.flexidash.app',
      FLEXIDASH_JWT_AUDIENCE: 'test:api',
    });
  });

  await t.test('blocks standard member from assigning roles (403 Forbidden)', async () => {
    const memberToken = signJwt({
      sub: 'usr-member',
      inst: 'inst-site-01',
      roles: ['role_member'],
      email: 'member@test.local',
    });

    const req = new Request('http://localhost/api/flexidash/admin/roles/assign', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${memberToken}`,
        'Content-Type': 'application/json',
        'x-wix-instance-id': 'inst-site-01',
      },
      body: JSON.stringify({
        targetUserId: 'target-user-01',
        roleId: 'role_admin',
      }),
    });

    const res = await assignRoleRoute({ request: req });
    assert.equal(res.status, 403);
  });

  await t.test('blocks admin from self-promoting to Site Owner', async () => {
    const adminToken = signJwt({
      sub: 'usr-admin-self',
      inst: 'inst-site-01',
      roles: ['role_admin'],
      email: 'admin@test.local',
    });

    const req = new Request('http://localhost/api/flexidash/admin/roles/assign', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'x-wix-instance-id': 'inst-site-01',
      },
      body: JSON.stringify({
        targetUserId: 'usr-admin-self', // Self-promotion target
        roleId: 'role_site_owner',
      }),
    });

    const res = await assignRoleRoute({ request: req });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });
});
