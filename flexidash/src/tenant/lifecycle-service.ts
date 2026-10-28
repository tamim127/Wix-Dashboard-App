/**
 * FlexiDash Wix App Lifecycle Service
 *
 * Implements tenant provisioning, reinstall idempotency, plan upgrades,
 * and safe uninstallation workflows following official Wix app event contracts.
 */

import type { InstanceId } from '../models/identity.ts';
import type { TenantConfig } from './types.ts';
import { getTenantStorageAdapter } from './storage/tenant-storage-factory.ts';
import { getRoleStorageAdapter } from '../rbac/storage/role-storage-factory.ts';
import { getLayoutStorageAdapter } from '../layout/storage/storage-factory.ts';
import { createDefaultSiteLayout } from '../layout/registry.ts';
import { recordAuditEvent } from '../audit/audit-factory.ts';
import { ValidationError } from '../errors/app-error.ts';

export interface AppInstalledEventPayload {
  instanceId: InstanceId;
  appDefId?: string;
  planId?: string;
  siteDisplayName?: string;
  siteUrl?: string;
}

export interface AppUninstalledEventPayload {
  instanceId: InstanceId;
  appDefId?: string;
}

export interface AppPlanChangedEventPayload {
  instanceId: InstanceId;
  planId: string;
}

export class AppLifecycleService {
  /**
   * Handles app installation and reinstall events idempotently.
   */
  public static async handleAppInstalled(payload: AppInstalledEventPayload): Promise<TenantConfig> {
    if (!payload.instanceId) {
      throw new ValidationError("Missing required 'instanceId' in installation event");
    }

    const adapter = getTenantStorageAdapter();
    const existing = await adapter.getTenantConfig(payload.instanceId);
    const now = new Date().toISOString();

    const config: TenantConfig = {
      instanceId: payload.instanceId,
      appDefId: payload.appDefId || existing?.appDefId || 'fed82166-29ac-4cba-842a-fbedd2e1b0b1',
      status: 'installed',
      installedAt: existing?.installedAt || now,
      updatedAt: now,
      planId: payload.planId || existing?.planId || 'free',
      siteDisplayName: payload.siteDisplayName || existing?.siteDisplayName,
      siteUrl: payload.siteUrl || existing?.siteUrl,
      settings: existing?.settings || {},
    };

    const saved = await adapter.saveTenantConfig(config);

    // Initialize default site layout if tenant has no layout
    try {
      const layoutAdapter = getLayoutStorageAdapter();
      const existingLayout = await layoutAdapter.getLayout(payload.instanceId);
      if (!existingLayout) {
        await layoutAdapter.saveLayout(createDefaultSiteLayout(payload.instanceId));
      }
    } catch (err) {
      console.warn(`[AppLifecycle] Notice: layout initialization deferred for ${payload.instanceId}:`, err);
    }

    // Initialize system roles if tenant has no roles
    try {
      const roleAdapter = getRoleStorageAdapter();
      await roleAdapter.listRoles(payload.instanceId);
    } catch (err) {
      console.warn(`[AppLifecycle] Notice: role initialization deferred for ${payload.instanceId}:`, err);
    }

    await recordAuditEvent({
      instanceId: payload.instanceId,
      action: existing ? 'app:reinstalled' : 'app:installed',
      outcome: 'SUCCESS',
      target: payload.instanceId,
      metadata: {
        planId: config.planId,
        isReinstall: Boolean(existing),
      },
    });

    return saved;
  }

  /**
   * Handles app uninstallation safely.
   * Marks tenant status as uninstalled and records the audit trail.
   * Strictly isolates tenant data and never modifies other tenants.
   */
  public static async handleAppUninstalled(payload: AppUninstalledEventPayload): Promise<TenantConfig | null> {
    if (!payload.instanceId) {
      throw new ValidationError("Missing required 'instanceId' in uninstallation event");
    }

    const adapter = getTenantStorageAdapter();
    const existing = await adapter.getTenantConfig(payload.instanceId);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    const updated: TenantConfig = {
      ...existing,
      status: 'uninstalled',
      uninstalledAt: now,
      updatedAt: now,
    };

    const saved = await adapter.saveTenantConfig(updated);

    await recordAuditEvent({
      instanceId: payload.instanceId,
      action: 'app:uninstalled',
      outcome: 'SUCCESS',
      target: payload.instanceId,
      metadata: {
        uninstalledAt: now,
      },
    });

    return saved;
  }

  /**
   * Handles tenant plan modifications.
   */
  public static async handlePlanChanged(payload: AppPlanChangedEventPayload): Promise<TenantConfig> {
    if (!payload.instanceId || !payload.planId) {
      throw new ValidationError("Missing required 'instanceId' or 'planId' in plan change event");
    }

    const adapter = getTenantStorageAdapter();
    const existing = await adapter.getTenantConfig(payload.instanceId);
    const now = new Date().toISOString();

    const config: TenantConfig = {
      instanceId: payload.instanceId,
      appDefId: existing?.appDefId || 'fed82166-29ac-4cba-842a-fbedd2e1b0b1',
      status: existing?.status || 'installed',
      installedAt: existing?.installedAt || now,
      updatedAt: now,
      planId: payload.planId,
      siteDisplayName: existing?.siteDisplayName,
      siteUrl: existing?.siteUrl,
      settings: existing?.settings || {},
    };

    const saved = await adapter.saveTenantConfig(config);

    await recordAuditEvent({
      instanceId: payload.instanceId,
      action: 'app:plan_changed',
      outcome: 'SUCCESS',
      target: payload.instanceId,
      metadata: {
        previousPlan: existing?.planId || 'unknown',
        newPlan: payload.planId,
      },
    });

    return saved;
  }
}

