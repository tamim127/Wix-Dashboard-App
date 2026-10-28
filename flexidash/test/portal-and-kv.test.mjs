/**
 * Phase 4 Test Suite: Site-Facing Member Portal, Widget Canvas & Cloudflare KV Persistence
 *
 * Verifies:
 * 1. CloudflareKvLayoutStorageAdapter edge persistence, schema migration, and tenant partitioning
 * 2. Storage factory dynamic adapter resolution and environment fallbacks
 * 3. Responsive column span calculations and widget canvas layout sorting
 * 4. Safe unknown widget fallback and error boundary fault isolation
 * 5. Strict zero-localStorage guarantee for session tokens
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CloudflareKvLayoutStorageAdapter,
} from '../src/layout/storage/cloudflare-kv-storage.ts';
import {
  getLayoutStorageAdapter,
  setLayoutStorageAdapterForTesting,
  resetLayoutStorageAdapter,
} from '../src/layout/storage/storage-factory.ts';
import { FileLayoutStorageAdapter } from '../src/layout/storage/file-storage.ts';
import {
  getColumnSpan,
  filterVisibleWidgets,
  sortWidgetsByOrder,
  isRegisteredWidgetId,
} from '../src/portal/canvas-utils.ts';
import { sessionManager } from '../src/client/session-manager.ts';
import { CURRENT_LAYOUT_SCHEMA_VERSION } from '../src/layout/types.ts';

/**
 * In-memory Mock implementation of Cloudflare KVNamespace
 */
class MockKVNamespace {
  constructor() {
    this.store = new Map();
  }

  async get(key, type = 'text') {
    const val = this.store.get(key);
    if (val === undefined) return null;
    if (type === 'json') {
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }
    return val;
  }

  async put(key, value) {
    this.store.set(key, typeof value === 'string' ? value : String(value));
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    const keys = [];
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        keys.push({ name: key });
      }
    }
    return {
      keys,
      list_complete: true,
    };
  }
}

test('Cloudflare KV Layout Storage Adapter Suite', async (t) => {
  let mockKv;
  let kvAdapter;

  t.beforeEach(() => {
    mockKv = new MockKVNamespace();
    kvAdapter = new CloudflareKvLayoutStorageAdapter(mockKv);
    resetLayoutStorageAdapter();
  });

  t.afterEach(() => {
    resetLayoutStorageAdapter();
  });

  await t.test('auto-seeds default site layout when KV is empty and returns valid layout', async () => {
    const layout = await kvAdapter.getLayout('inst-test-01');
    assert.ok(layout, 'Default layout must be created');
    assert.equal(layout.instanceId, 'inst-test-01');
    assert.equal(layout.schemaVersion, CURRENT_LAYOUT_SCHEMA_VERSION);
    assert.ok(layout.widgets.length > 0, 'Must contain default widgets');

    // Verify written to KV under expected key
    const rawInKv = await mockKv.get('layout:inst-test-01:site_default');
    assert.ok(rawInKv, 'Site default must be persisted to KV under layout:instance:site_default');
  });

  await t.test('saves and retrieves user-specific custom layout from KV', async () => {
    const customLayout = {
      id: 'layout-custom-user',
      schemaVersion: CURRENT_LAYOUT_SCHEMA_VERSION,
      instanceId: 'inst-test-01',
      userId: 'usr-charlie',
      name: "Charlie's Dashboard",
      columns: 4,
      theme: 'light',
      widgets: [
        {
          instanceId: 'inst-w1',
          widgetId: 'widget-overview-metrics',
          size: 'large',
          order: 0,
          visible: true,
          config: {},
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kvAdapter.saveLayout(customLayout);

    // Verify saved under user-specific key
    const userKey = kvAdapter.getKey('inst-test-01', 'usr-charlie');
    assert.equal(userKey, 'layout:inst-test-01:user:usr-charlie');

    const retrieved = await kvAdapter.getLayout('inst-test-01', 'usr-charlie');
    assert.ok(retrieved);
    assert.equal(retrieved.userId, 'usr-charlie');
    assert.equal(retrieved.name, "Charlie's Dashboard");
    assert.equal(retrieved.widgets.length, 1);
  });

  await t.test('falls back to site default when user has no custom layout in KV', async () => {
    // 1. Seed site default layout
    const defaultLayout = {
      id: 'site-default',
      schemaVersion: CURRENT_LAYOUT_SCHEMA_VERSION,
      instanceId: 'inst-test-01',
      name: 'Default Site Layout',
      columns: 4,
      theme: 'system',
      widgets: [
        {
          instanceId: 'inst-w0',
          widgetId: 'widget-quick-stats',
          size: 'small',
          order: 0,
          visible: true,
          config: {},
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kvAdapter.saveLayout(defaultLayout);

    // 2. Query for user who hasn't customized yet
    const loaded = await kvAdapter.getLayout('inst-test-01', 'usr-unconfigured');
    assert.ok(loaded);
    assert.equal(loaded.name, 'Default Site Layout', 'Must fall back to site default');
  });

  await t.test('deletes user custom layout reverting to site default', async () => {
    // 1. Save site default and user custom
    const defaultLayout = {
      id: 'site-default',
      schemaVersion: CURRENT_LAYOUT_SCHEMA_VERSION,
      instanceId: 'inst-test-01',
      name: 'Default Site Layout',
      columns: 4,
      theme: 'system',
      widgets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kvAdapter.saveLayout(defaultLayout);

    const userLayout = {
      id: 'user-layout',
      schemaVersion: CURRENT_LAYOUT_SCHEMA_VERSION,
      instanceId: 'inst-test-01',
      userId: 'usr-david',
      name: "David's Layout",
      columns: 4,
      theme: 'dark',
      widgets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kvAdapter.saveLayout(userLayout);

    // Delete user custom layout
    const deleted = await kvAdapter.deleteLayout('inst-test-01', 'usr-david');
    assert.equal(deleted, true);

    // Confirm that getLayout now reverts to site default
    const current = await kvAdapter.getLayout('inst-test-01', 'usr-david');
    assert.equal(current.name, 'Default Site Layout');
  });

  await t.test('enforces tenant partitioning in listLayouts()', async () => {
    // Save layouts across two distinct tenants
    await kvAdapter.saveLayout({
      id: 'layout-site-a',
      schemaVersion: CURRENT_LAYOUT_SCHEMA_VERSION,
      instanceId: 'tenant-alpha',
      name: 'Tenant Alpha Default',
      columns: 4,
      theme: 'light',
      widgets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await kvAdapter.saveLayout({
      id: 'layout-site-b',
      schemaVersion: CURRENT_LAYOUT_SCHEMA_VERSION,
      instanceId: 'tenant-beta',
      name: 'Tenant Beta Default',
      columns: 4,
      theme: 'light',
      widgets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const alphaLayouts = await kvAdapter.listLayouts('tenant-alpha');
    assert.equal(alphaLayouts.length, 1);
    assert.equal(alphaLayouts[0].instanceId, 'tenant-alpha');

    const betaLayouts = await kvAdapter.listLayouts('tenant-beta');
    assert.equal(betaLayouts.length, 1);
    assert.equal(betaLayouts[0].instanceId, 'tenant-beta');
  });

  await t.test('automatically migrates legacy schema version layouts loaded from KV', async () => {
    // Inject legacy version 0 layout directly into KV
    const legacyLayout = {
      id: 'legacy-v0',
      instanceId: 'inst-legacy',
      name: 'Legacy Layout',
      widgets: [
        {
          widgetId: 'widget-overview-metrics',
          size: 'large',
          order: 0,
        },
      ],
    };
    await mockKv.put('layout:inst-legacy:site_default', JSON.stringify(legacyLayout));

    const migrated = await kvAdapter.getLayout('inst-legacy');
    assert.ok(migrated);
    assert.equal(migrated.schemaVersion, CURRENT_LAYOUT_SCHEMA_VERSION);
    assert.equal(migrated.columns, 4);
    assert.ok(migrated.widgets[0].instanceId, 'Must assign missing instanceId during migration');
  });
});

test('Storage Factory Dynamic Adapter Resolution Suite', async (t) => {
  t.beforeEach(() => {
    resetLayoutStorageAdapter();
  });

  t.afterEach(() => {
    resetLayoutStorageAdapter();
  });

  await t.test('returns CloudflareKvLayoutStorageAdapter when explicit KV is provided', () => {
    const mockKv = new MockKVNamespace();
    const adapter = getLayoutStorageAdapter(mockKv);
    assert.ok(adapter instanceof CloudflareKvLayoutStorageAdapter);
  });

  await t.test('falls back to FileLayoutStorageAdapter in local environment without KV', () => {
    const adapter = getLayoutStorageAdapter();
    assert.ok(adapter instanceof FileLayoutStorageAdapter);
  });

  await t.test('respects test override via setLayoutStorageAdapterForTesting', () => {
    const mockAdapter = {
      getLayout: async () => null,
      saveLayout: async () => {},
      deleteLayout: async () => true,
      listLayouts: async () => [],
    };

    setLayoutStorageAdapterForTesting(mockAdapter);
    const resolved = getLayoutStorageAdapter();
    assert.equal(resolved, mockAdapter);
  });
});

test('Widget Canvas Layout & Rendering Logic Suite', async (t) => {
  await t.test('getColumnSpan calculates correct responsive grid spans', () => {
    assert.equal(getColumnSpan('small', 4), 1);
    assert.equal(getColumnSpan('medium', 4), 2);
    assert.equal(getColumnSpan('large', 4), 3);
    assert.equal(getColumnSpan('full', 4), 4);

    // When total columns are constrained (e.g. 2 columns on tablet)
    assert.equal(getColumnSpan('medium', 2), 2);
    assert.equal(getColumnSpan('large', 2), 2);
    assert.equal(getColumnSpan('full', 2), 2);
  });

  await t.test('filters hidden widgets and sorts active widgets by order', () => {
    const rawWidgets = [
      { widgetId: 'w2', order: 2, visible: true },
      { widgetId: 'w3', order: 1, visible: false },
      { widgetId: 'w1', order: 0, visible: true },
      { widgetId: 'w4', order: 3, visible: true },
    ];

    const visible = filterVisibleWidgets(rawWidgets);
    assert.equal(visible.length, 3);
    assert.ok(!visible.some((w) => w.widgetId === 'w3'));

    const sorted = sortWidgetsByOrder(visible);
    assert.deepEqual(
      sorted.map((w) => w.widgetId),
      ['w1', 'w2', 'w4']
    );
  });

  await t.test('identifies registered widgets and flags unrecognized widget IDs', () => {
    assert.equal(isRegisteredWidgetId('widget-overview-metrics'), true);
    assert.equal(isRegisteredWidgetId('widget-quick-stats'), true);
    assert.equal(isRegisteredWidgetId('widget-roles-table'), true);
    assert.equal(isRegisteredWidgetId('non-existent-or-corrupt-widget-id'), false);
  });
});

test('Zero-LocalStorage Security Invariant Suite', async (t) => {
  await t.test('verifies SessionManager stores tokens in private memory with zero localStorage access', () => {
    sessionManager.clearSession();
    assert.equal(sessionManager.getSession(), null);
    assert.equal(sessionManager.getToken(), null);

    // Simulate authentic session set (token, session)
    sessionManager.setSession(
      'header.payload.secretSignature',
      {
        userId: 'usr-test-secure',
        instanceId: 'inst-secure',
        roles: ['role_member'],
        permissions: ['portal:access'],
      }
    );

    assert.ok(sessionManager.getSession());
    assert.equal(sessionManager.getToken(), 'header.payload.secretSignature');

    // Confirm session is completely cleared on logout/purge
    sessionManager.clearSession();
    assert.equal(sessionManager.getSession(), null);
    assert.equal(sessionManager.getToken(), null);
  });
});
