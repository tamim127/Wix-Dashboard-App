import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getWidgetDefinition,
  getAllRegisteredWidgets,
  getPermittedWidgets,
  validateLayout,
  migrateLayout,
  createDefaultSiteLayout,
} from '../src/layout/registry.ts';
import { FileLayoutStorageAdapter } from '../src/layout/storage/file-storage.ts';
import { CURRENT_LAYOUT_SCHEMA_VERSION } from '../src/layout/types.ts';
import { ValidationError, ForbiddenError } from '../src/errors/app-error.ts';
import { toInstanceId, toFlexiDashUserId } from '../src/models/identity.ts';

const TEST_STORAGE_DIR = path.join(process.cwd(), '.storage', 'test-layouts');

test('Dashboard Layout Engine & Persistence Suite', async (t) => {
  const instanceA = toInstanceId('tenant-site-alpha');
  const instanceB = toInstanceId('tenant-site-beta');
  const user1 = toFlexiDashUserId('usr-alice-100');
  const user2 = toFlexiDashUserId('usr-bob-200');

  // Clean test storage directory before and after
  t.beforeEach(async () => {
    try {
      await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  t.after(async () => {
    try {
      await fs.rm(TEST_STORAGE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  await t.test('Widget Registry - verifies stable widget definitions and metadata', () => {
    const allWidgets = getAllRegisteredWidgets();
    assert.ok(allWidgets.length >= 8);

    const auditDef = getWidgetDefinition('widget-audit-log');
    assert.ok(auditDef);
    assert.equal(auditDef.requiredPermission, 'audit:view');
    assert.deepEqual(auditDef.supportedSizes, ['large', 'full']);

    const overviewDef = getWidgetDefinition('widget-overview-metrics');
    assert.ok(overviewDef);
    assert.equal(overviewDef.requiredPermission, 'dashboard:view');
  });

  await t.test('Widget Registry - filters permitted widgets by active permissions', () => {
    const memberPerms = ['dashboard:view', 'portal:access'];
    const permitted = getPermittedWidgets(memberPerms);

    assert.ok(permitted.some((w) => w.id === 'widget-overview-metrics'));
    assert.ok(permitted.some((w) => w.id === 'widget-recent-activity'));
    // Does NOT include audit-log or roles-table
    assert.ok(!permitted.some((w) => w.id === 'widget-audit-log'));
    assert.ok(!permitted.some((w) => w.id === 'widget-roles-table'));
  });

  await t.test('validateLayout() - accepts valid layout when user has required permissions', () => {
    const baseLayout = createDefaultSiteLayout(instanceA);
    const adminPermissions = ['dashboard:view', 'roles:view', 'audit:view', 'integrations:view', 'dashboard:edit'];

    const validated = validateLayout(baseLayout, adminPermissions);
    assert.equal(validated.schemaVersion, CURRENT_LAYOUT_SCHEMA_VERSION);
    assert.equal(validated.widgets.length, baseLayout.widgets.length);
  });

  await t.test('validateLayout() - rejects unregistered widget ID with ValidationError', () => {
    const layout = createDefaultSiteLayout(instanceA);
    layout.widgets.push({
      instanceId: 'inst-unregistered-99',
      widgetId: 'widget-unregistered-malicious',
      size: 'medium',
      order: 10,
      visible: true,
      config: {},
    });

    assert.throws(
      () => {
        validateLayout(layout, ['dashboard:view', 'roles:view', 'audit:view', 'integrations:view']);
      },
      ValidationError,
      'Must reject unregistered widget ID'
    );
  });

  await t.test('validateLayout() - rejects unsupported widget size with ValidationError', () => {
    const layout = createDefaultSiteLayout(instanceA);
    // widget-quick-stats only supports 'small' and 'medium', not 'full'
    layout.widgets[1].size = 'full';

    assert.throws(
      () => {
        validateLayout(layout, ['dashboard:view', 'roles:view']);
      },
      ValidationError,
      'Must reject unsupported widget size'
    );
  });

  await t.test('validateLayout() - default-deny: rejects visible widget when user lacks required permission', () => {
    const layout = createDefaultSiteLayout(instanceA);
    // Layout includes widget-audit-log which requires 'audit:view'
    // Caller only has standard member permissions
    const memberPermissions = ['dashboard:view', 'portal:access'];

    assert.throws(
      () => {
        validateLayout(layout, memberPermissions);
      },
      ForbiddenError,
      'Must throw ForbiddenError when user lacks permission for visible widget'
    );
  });

  await t.test('migrateLayout() - seamlessly upgrades legacy version 0 layout to version 1', () => {
    const legacyLayout = {
      id: 'legacy-layout-123',
      instanceId: instanceA,
      name: 'Legacy Portal',
      widgets: [
        { id: 'widget-overview-metrics', size: 'large', visible: true },
        { id: 'widget-recent-activity', visible: true },
      ],
    };

    const migrated = migrateLayout(legacyLayout);
    assert.equal(migrated.schemaVersion, 1);
    assert.equal(migrated.widgets[0].widgetId, 'widget-overview-metrics');
    assert.equal(migrated.widgets[0].size, 'large');
    assert.equal(migrated.widgets[1].widgetId, 'widget-recent-activity');
    assert.ok(migrated.widgets[0].instanceId);
  });

  await t.test('Persistence - FileLayoutStorageAdapter persists and reloads across adapter re-instantiation (restart test)', async () => {
    // 1. First adapter instance writes a customized site layout
    const adapter1 = new FileLayoutStorageAdapter(TEST_STORAGE_DIR);
    const customLayout = createDefaultSiteLayout(instanceA);
    customLayout.name = 'Persistent Production Dashboard';
    customLayout.widgets[0].size = 'medium'; // altered size
    customLayout.widgets[0].config = { refreshIntervalSeconds: 120, customFlag: true };

    await adapter1.saveLayout(customLayout);

    // 2. Simulate process exit / server restart by discarding adapter1 and instantiating adapter2
    const adapter2 = new FileLayoutStorageAdapter(TEST_STORAGE_DIR);
    const loadedLayout = await adapter2.getLayout(instanceA);

    assert.ok(loadedLayout);
    assert.equal(loadedLayout.name, 'Persistent Production Dashboard');
    assert.equal(loadedLayout.widgets[0].size, 'medium');
    assert.deepEqual(loadedLayout.widgets[0].config, { refreshIntervalSeconds: 120, customFlag: true });
  });

  await t.test('Persistence - separates user-specific layouts from site-level defaults', async () => {
    const adapter = new FileLayoutStorageAdapter(TEST_STORAGE_DIR);

    // Save site default
    const siteDefault = createDefaultSiteLayout(instanceA);
    siteDefault.name = 'Global Site Default';
    await adapter.saveLayout(siteDefault);

    // User 1 customizes their layout
    const user1Layout = {
      ...siteDefault,
      id: `layout-${user1}`,
      userId: user1,
      name: 'Alice Personal Layout',
      widgets: [siteDefault.widgets[0]], // Alice keeps only 1 widget
    };
    await adapter.saveLayout(user1Layout);

    // User 1 loads their layout -> receives personalized layout
    const loadedAlice = await adapter.getLayout(instanceA, user1);
    assert.equal(loadedAlice?.name, 'Alice Personal Layout');
    assert.equal(loadedAlice?.widgets.length, 1);

    // User 2 (no custom layout) -> automatically falls back to site default
    const loadedBob = await adapter.getLayout(instanceA, user2);
    assert.equal(loadedBob?.name, 'Global Site Default');
    assert.equal(loadedBob?.widgets.length, siteDefault.widgets.length);

    // User 1 resets layout -> deletes custom layout and reverts to site default
    const deleted = await adapter.deleteLayout(instanceA, user1);
    assert.equal(deleted, true);

    const reloadedAlice = await adapter.getLayout(instanceA, user1);
    assert.equal(reloadedAlice?.name, 'Global Site Default');
  });

  await t.test('Tenant Isolation - layouts strictly partitioned by instanceId', async () => {
    const adapter = new FileLayoutStorageAdapter(TEST_STORAGE_DIR);

    const layoutAlpha = createDefaultSiteLayout(instanceA);
    layoutAlpha.name = 'Alpha Site Dashboard';
    await adapter.saveLayout(layoutAlpha);

    const layoutBeta = createDefaultSiteLayout(instanceB);
    layoutBeta.name = 'Beta Site Dashboard';
    await adapter.saveLayout(layoutBeta);

    const loadedA = await adapter.getLayout(instanceA);
    const loadedB = await adapter.getLayout(instanceB);

    assert.equal(loadedA?.name, 'Alpha Site Dashboard');
    assert.equal(loadedB?.name, 'Beta Site Dashboard');

    // List layouts for tenant A returns only tenant A layouts
    const listA = await adapter.listLayouts(instanceA);
    assert.ok(listA.length >= 1);
    assert.ok(listA.every((l) => l.instanceId === instanceA));
  });
});
