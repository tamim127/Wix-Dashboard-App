/**
 * FlexiDash Cloudflare KV Tenant Configuration Storage Adapter
 *
 * Implements ITenantConfigStorageAdapter using Cloudflare Workers KV.
 * Provides distributed persistence across the edge partitioned by tenant instanceId.
 */

import type { ITenantConfigStorageAdapter, TenantConfig } from '../types.ts';
import type { InstanceId } from '../../models/identity.ts';
import type { KVNamespaceLike } from '../../layout/storage/cloudflare-kv-storage.ts';

export class CloudflareKvTenantStorageAdapter implements ITenantConfigStorageAdapter {
  private readonly kv: KVNamespaceLike;

  constructor(kv: KVNamespaceLike) {
    if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
      throw new Error('CloudflareKvTenantStorageAdapter requires a valid KVNamespaceLike instance');
    }
    this.kv = kv;
  }

  private sanitize(id: string): string {
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  public getKey(instanceId: InstanceId): string {
    return `tenant:${this.sanitize(instanceId)}:config`;
  }

  public async getTenantConfig(instanceId: InstanceId): Promise<TenantConfig | null> {
    const key = this.getKey(instanceId);
    const data = await this.kv.get(key, 'json');
    if (!data || typeof data !== 'object') {
      return null;
    }
    return data as TenantConfig;
  }

  public async saveTenantConfig(config: TenantConfig): Promise<TenantConfig> {
    const key = this.getKey(config.instanceId);
    const existing = await this.getTenantConfig(config.instanceId);

    const now = new Date().toISOString();
    const updated: TenantConfig = {
      ...config,
      updatedAt: now,
      installedAt: existing?.installedAt || config.installedAt || now,
    };

    await this.kv.put(key, JSON.stringify(updated));
    return updated;
  }

  public async deleteTenantConfig(instanceId: InstanceId): Promise<boolean> {
    const key = this.getKey(instanceId);
    await this.kv.delete(key);
    return true;
  }

  public async clearForTesting(instanceId?: InstanceId): Promise<void> {
    if (instanceId) {
      await this.kv.delete(this.getKey(instanceId));
    }
  }
}

