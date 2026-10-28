/**
 * FlexiDash Tenant Lifecycle & Configuration Models
 */

import type { InstanceId } from '../models/identity.ts';

export type TenantInstallationStatus = 'installed' | 'uninstalled' | 'suspended' | 'pending';

export interface TenantConfig {
  instanceId: InstanceId;
  appDefId: string;
  status: TenantInstallationStatus;
  installedAt: string;
  updatedAt: string;
  uninstalledAt?: string;
  planId?: string;
  siteDisplayName?: string;
  siteUrl?: string;
  settings?: Record<string, unknown>;
}

export interface ITenantConfigStorageAdapter {
  getTenantConfig(instanceId: InstanceId): Promise<TenantConfig | null>;
  saveTenantConfig(config: TenantConfig): Promise<TenantConfig>;
  deleteTenantConfig(instanceId: InstanceId): Promise<boolean>;
  listTenants?(): Promise<TenantConfig[]>;
  clearForTesting?(instanceId?: InstanceId): Promise<void>;
}

