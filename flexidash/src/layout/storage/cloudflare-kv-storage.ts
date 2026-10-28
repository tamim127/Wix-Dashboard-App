/**
 * FlexiDash Cloudflare KV Layout Storage Adapter
 *
 * Implements ILayoutStorageAdapter using Cloudflare Workers KV.
 * Provides distributed, edge-native persistence without local filesystem dependencies.
 * Partitions data strictly by tenant InstanceId and user ownership.
 */

import type { ILayoutStorageAdapter } from './types.ts';
import type { InstanceId, FlexiDashUserId } from '../../models/identity.ts';
import type { DashboardLayout } from '../types.ts';
import { migrateLayout, createDefaultSiteLayout } from '../registry.ts';

export interface KVNamespaceLike {
  get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any>;
  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: { expiration?: number; expirationTtl?: number; metadata?: any }
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string; metadata?: any }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export class CloudflareKvLayoutStorageAdapter implements ILayoutStorageAdapter {
  private readonly kv: KVNamespaceLike;

  constructor(kv: KVNamespaceLike) {
    if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
      throw new Error('CloudflareKvLayoutStorageAdapter requires a valid KVNamespaceLike instance');
    }
    this.kv = kv;
  }

  /**
   * Generates namespaced storage key:
   * - Site default layout: layout:{instanceId}:site_default
   * - Custom member layout: layout:{instanceId}:user:{userId}
   */
  public getKey(instanceId: InstanceId, userId?: FlexiDashUserId): string {
    const sanitizedInstance = String(instanceId).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (userId) {
      const sanitizedUser = String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');
      return `layout:${sanitizedInstance}:user:${sanitizedUser}`;
    }
    return `layout:${sanitizedInstance}:site_default`;
  }

  public getTenantPrefix(instanceId: InstanceId): string {
    const sanitizedInstance = String(instanceId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return `layout:${sanitizedInstance}:`;
  }

  public async getLayout(instanceId: InstanceId, userId?: FlexiDashUserId): Promise<DashboardLayout | null> {
    // 1. If userId provided, check for user-specific custom layout
    if (userId) {
      const userKey = this.getKey(instanceId, userId);
      try {
        const raw = await this.kv.get(userKey, 'text');
        if (raw) {
          const parsed = JSON.parse(raw);
          return migrateLayout(parsed);
        }
      } catch (err) {
        console.error(`[CloudflareKvLayoutStorage] Error fetching user layout for key ${userKey}:`, err);
      }
    }

    // 2. Fetch or initialize site-level default layout
    const defaultKey = this.getKey(instanceId);
    try {
      const raw = await this.kv.get(defaultKey, 'text');
      if (raw) {
        const parsed = JSON.parse(raw);
        return migrateLayout(parsed);
      }
    } catch (err) {
      console.error(`[CloudflareKvLayoutStorage] Error fetching site default layout for key ${defaultKey}:`, err);
    }

    // 3. Auto-seed default site layout if none exists
    const defaultLayout = createDefaultSiteLayout(instanceId);
    await this.saveLayout(defaultLayout);
    return defaultLayout;
  }

  public async saveLayout(layout: DashboardLayout): Promise<void> {
    const key = this.getKey(layout.instanceId, layout.userId);
    const serialized = JSON.stringify(layout);
    await this.kv.put(key, serialized);
  }

  public async deleteLayout(instanceId: InstanceId, userId?: FlexiDashUserId): Promise<boolean> {
    const key = this.getKey(instanceId, userId);
    const existing = await this.kv.get(key, 'text');
    if (!existing) {
      return false;
    }
    await this.kv.delete(key);
    return true;
  }

  public async listLayouts(instanceId: InstanceId): Promise<DashboardLayout[]> {
    const prefix = this.getTenantPrefix(instanceId);
    const result = await this.kv.list({ prefix });
    const layouts: DashboardLayout[] = [];

    for (const key of result.keys) {
      try {
        const raw = await this.kv.get(key.name, 'text');
        if (raw) {
          const parsed = JSON.parse(raw);
          layouts.push(migrateLayout(parsed));
        }
      } catch (err) {
        console.warn(`[CloudflareKvLayoutStorage] Skipped corrupted layout record for key ${key.name}:`, err);
      }
    }

    return layouts;
  }
}
