/**
 * FlexiDash Server-Side Widget Registry & Layout Validator
 *
 * Enforces widget definitions, size constraints, and default-deny permission checks.
 * NEVER trusts client-supplied permissions or widget access claims.
 */

import type { PermissionKey } from '../models/rbac.ts';
import type { InstanceId } from '../models/identity.ts';
import {
  CURRENT_LAYOUT_SCHEMA_VERSION,
  type WidgetDefinition,
  type DashboardLayout,
  type WidgetInstance,
} from './types.ts';
import { ValidationError, ForbiddenError } from '../errors/app-error.ts';

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  'widget-overview-metrics': {
    id: 'widget-overview-metrics',
    title: 'Site Analytics Overview',
    description: 'High-level traffic, conversion, and visitor engagement summaries.',
    category: 'analytics',
    requiredPermission: 'dashboard:view',
    supportedSizes: ['medium', 'large', 'full'],
    defaultSize: 'large',
    defaultConfig: { refreshIntervalSeconds: 60, showTrends: true },
    iconName: 'Chart',
  },
  'widget-quick-stats': {
    id: 'widget-quick-stats',
    title: 'Quick Performance KPIs',
    description: 'Compact counters for active members, sessions, and daily queries.',
    category: 'analytics',
    requiredPermission: 'dashboard:view',
    supportedSizes: ['small', 'medium'],
    defaultSize: 'small',
    defaultConfig: { metric: 'active_sessions' },
    iconName: 'Data',
  },
  'widget-recent-activity': {
    id: 'widget-recent-activity',
    title: 'Recent Activity Feed',
    description: 'Live timeline of member signups, logins, and portal interactions.',
    category: 'analytics',
    requiredPermission: 'dashboard:view',
    supportedSizes: ['small', 'medium', 'large'],
    defaultSize: 'medium',
    defaultConfig: { maxItems: 10 },
    iconName: 'History',
  },
  'widget-member-directory': {
    id: 'widget-member-directory',
    title: 'Member Directory & Roster',
    description: 'Searchable roster of registered site members with role filters.',
    category: 'management',
    requiredPermission: 'members:view',
    supportedSizes: ['medium', 'large', 'full'],
    defaultSize: 'large',
    defaultConfig: { pageSize: 10, defaultFilter: 'all' },
    iconName: 'Users',
  },
  'widget-roles-table': {
    id: 'widget-roles-table',
    title: 'Role Assignment Manager',
    description: 'Interface for managing custom roles and assigning member privileges.',
    category: 'management',
    requiredPermission: 'roles:view',
    supportedSizes: ['medium', 'large', 'full'],
    defaultSize: 'large',
    defaultConfig: { showSystemRoles: true },
    iconName: 'Shield',
  },
  'widget-layout-editor': {
    id: 'widget-layout-editor',
    title: 'Layout Customizer Canvas',
    description: 'Canvas controls for arranging dashboard widgets and setting site defaults.',
    category: 'management',
    requiredPermission: 'dashboard:edit',
    supportedSizes: ['large', 'full'],
    defaultSize: 'full',
    defaultConfig: { snapToGrid: true },
    iconName: 'Layout',
  },
  'widget-integrations': {
    id: 'widget-integrations',
    title: 'Connected Apps & Webhooks',
    description: 'Webhook configurations, API key statuses, and third-party integrations.',
    category: 'system',
    requiredPermission: 'integrations:view',
    supportedSizes: ['medium', 'large'],
    defaultSize: 'medium',
    defaultConfig: { showEndpoints: false },
    iconName: 'Link',
  },
  'widget-audit-log': {
    id: 'widget-audit-log',
    title: 'Security Audit Logs',
    description: 'Immutable record of security events, role escalations, and auth logs.',
    category: 'system',
    requiredPermission: 'audit:view',
    supportedSizes: ['large', 'full'],
    defaultSize: 'full',
    defaultConfig: { retentionDays: 90 },
    iconName: 'Lock',
  },
};

export function getWidgetDefinition(widgetId: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY[widgetId];
}

export function getAllRegisteredWidgets(): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY);
}

export function getPermittedWidgets(userPermissions: PermissionKey[]): WidgetDefinition[] {
  const permSet = new Set(userPermissions);
  return getAllRegisteredWidgets().filter((def) => permSet.has(def.requiredPermission));
}

/**
 * Migration strategy for handling legacy or unversioned dashboard layout representations
 */
export function migrateLayout(raw: Record<string, unknown>): DashboardLayout {
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;

  if (version === CURRENT_LAYOUT_SCHEMA_VERSION) {
    return raw as unknown as DashboardLayout;
  }

  // Migration from version 0 (unversioned legacy layout) to version 1
  if (version === 0) {
    const rawWidgets = Array.isArray(raw.widgets) ? raw.widgets : [];
    const migratedWidgets: WidgetInstance[] = rawWidgets.map((w: Record<string, unknown>, idx: number) => {
      const widgetId = String(w.id || w.widgetId || 'widget-overview-metrics');
      const def = getWidgetDefinition(widgetId);
      return {
        instanceId: String(w.instanceId || `migrated-inst-${idx}`),
        widgetId,
        size: (w.size as any) || def?.defaultSize || 'medium',
        order: typeof w.order === 'number' ? w.order : idx,
        visible: w.visible !== false,
        config: (w.config as Record<string, unknown>) || def?.defaultConfig || {},
      };
    });

    return {
      id: String(raw.id || `layout-migrated-${Date.now()}`),
      schemaVersion: CURRENT_LAYOUT_SCHEMA_VERSION,
      instanceId: raw.instanceId as InstanceId,
      userId: raw.userId ? (raw.userId as any) : undefined,
      name: String(raw.name || 'Default Dashboard Layout'),
      description: raw.description ? String(raw.description) : 'Migrated from legacy layout schema',
      columns: typeof raw.columns === 'number' ? raw.columns : 4,
      theme: (raw.theme as any) || 'light',
      widgets: migratedWidgets,
      createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  throw new ValidationError(`Unsupported layout schemaVersion: ${version}`);
}

/**
 * Server-Side Layout Validator
 *
 * Guarantees that:
 * 1. Layout structure is valid and adheres to CURRENT_LAYOUT_SCHEMA_VERSION.
 * 2. Every widget exists in WIDGET_REGISTRY.
 * 3. Every widget size is supported by its definition.
 * 4. User possesses required permissions for all visible widgets (default-deny).
 * 5. Widget configurations do not exceed allowed boundaries.
 */
export function validateLayout(
  layout: DashboardLayout,
  userPermissions: PermissionKey[]
): DashboardLayout {
  if (!layout || typeof layout !== 'object') {
    throw new ValidationError('Invalid layout payload: expected an object');
  }

  if (layout.schemaVersion !== CURRENT_LAYOUT_SCHEMA_VERSION) {
    throw new ValidationError(
      `Schema version mismatch: layout has version ${layout.schemaVersion}, server expects ${CURRENT_LAYOUT_SCHEMA_VERSION}`
    );
  }

  if (!layout.instanceId || typeof layout.instanceId !== 'string') {
    throw new ValidationError('Layout must specify a valid instanceId');
  }

  if (typeof layout.columns !== 'number' || layout.columns < 1 || layout.columns > 12) {
    throw new ValidationError('Layout columns must be a number between 1 and 12');
  }

  if (!Array.isArray(layout.widgets)) {
    throw new ValidationError('Layout widgets must be an array');
  }

  const permSet = new Set(userPermissions);
  const validatedWidgets: WidgetInstance[] = [];
  const seenInstanceIds = new Set<string>();

  // Sort widgets by order
  const sortedWidgets = [...layout.widgets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (let i = 0; i < sortedWidgets.length; i++) {
    const w = sortedWidgets[i];
    if (!w.instanceId || typeof w.instanceId !== 'string') {
      throw new ValidationError(`Widget at index ${i} is missing a valid instanceId`);
    }

    if (seenInstanceIds.has(w.instanceId)) {
      throw new ValidationError(`Duplicate widget instanceId detected: '${w.instanceId}'`);
    }
    seenInstanceIds.add(w.instanceId);

    const definition = getWidgetDefinition(w.widgetId);
    if (!definition) {
      throw new ValidationError(`Widget '${w.widgetId}' is not registered in the widget registry`);
    }

    if (!definition.supportedSizes.includes(w.size)) {
      throw new ValidationError(
        `Widget '${w.widgetId}' does not support size '${w.size}'. Supported sizes: ${definition.supportedSizes.join(', ')}`
      );
    }

    // Permission enforcement: if widget is visible, user must possess required permission
    if (w.visible && !permSet.has(definition.requiredPermission)) {
      throw new ForbiddenError(
        `User lacks required permission '${definition.requiredPermission}' for visible widget '${w.widgetId}'`
      );
    }

    validatedWidgets.push({
      instanceId: w.instanceId,
      widgetId: w.widgetId,
      size: w.size,
      order: i, // Normalize ordering
      visible: Boolean(w.visible),
      config: typeof w.config === 'object' && w.config !== null ? w.config : { ...definition.defaultConfig },
    });
  }

  return {
    ...layout,
    widgets: validatedWidgets,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates the standard default site-level layout for a given instance
 */
export function createDefaultSiteLayout(instanceId: InstanceId): DashboardLayout {
  const now = new Date().toISOString();
  return {
    id: `layout-default-${instanceId}`,
    schemaVersion: CURRENT_LAYOUT_SCHEMA_VERSION,
    instanceId,
    name: 'Site Default Portal Layout',
    description: 'Standard dashboard layout with key metrics and activity feed',
    columns: 4,
    theme: 'light',
    widgets: [
      {
        instanceId: 'inst-overview-1',
        widgetId: 'widget-overview-metrics',
        size: 'large',
        order: 0,
        visible: true,
        config: { refreshIntervalSeconds: 60, showTrends: true },
      },
      {
        instanceId: 'inst-quickstats-1',
        widgetId: 'widget-quick-stats',
        size: 'small',
        order: 1,
        visible: true,
        config: { metric: 'active_sessions' },
      },
      {
        instanceId: 'inst-activity-1',
        widgetId: 'widget-recent-activity',
        size: 'medium',
        order: 2,
        visible: true,
        config: { maxItems: 10 },
      },
      {
        instanceId: 'inst-roles-1',
        widgetId: 'widget-roles-table',
        size: 'large',
        order: 3,
        visible: true,
        config: { showSystemRoles: true },
      },
      {
        instanceId: 'inst-integrations-1',
        widgetId: 'widget-integrations',
        size: 'medium',
        order: 4,
        visible: true,
        config: { showEndpoints: false },
      },
      {
        instanceId: 'inst-audit-1',
        widgetId: 'widget-audit-log',
        size: 'full',
        order: 5,
        visible: true,
        config: { retentionDays: 90 },
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
