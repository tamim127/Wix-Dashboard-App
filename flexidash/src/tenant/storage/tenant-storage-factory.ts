/**
 * FlexiDash Tenant Storage Adapter Factory
 *
 * Dynamically resolves the tenant configuration storage adapter:
 * 1. Testing override (if set via setTenantStorageAdapterForTesting)
 * 2. Cloudflare KV Adapter (if KV namespace binding is detected in runtime)
 * 3. FileTenantStorageAdapter (for local development and test runners)
 */

import type { ITenantConfigStorageAdapter } from '../types.ts';
import { FileTenantStorageAdapter } from './file-tenant-storage.ts';
import { CloudflareKvTenantStorageAdapter } from './cloudflare-kv-tenant-storage.ts';
import { resolveEnvironmentKv, validateProductionStorage } from '../../layout/storage/storage-factory.ts';
import type { KVNamespaceLike } from '../../layout/storage/cloudflare-kv-storage.ts';

let activeTenantStorageAdapter: ITenantConfigStorageAdapter | null = null;

export function getTenantStorageAdapter(customKv?: KVNamespaceLike): ITenantConfigStorageAdapter {
  if (activeTenantStorageAdapter) {
    return activeTenantStorageAdapter;
  }

  const kv = customKv || resolveEnvironmentKv();
  if (kv) {
    activeTenantStorageAdapter = new CloudflareKvTenantStorageAdapter(kv);
    return activeTenantStorageAdapter;
  }

  validateProductionStorage(null);

  activeTenantStorageAdapter = new FileTenantStorageAdapter();
  return activeTenantStorageAdapter;
}

export function setTenantStorageAdapterForTesting(adapter: ITenantConfigStorageAdapter | null): void {
  activeTenantStorageAdapter = adapter;
}

export function resetTenantStorageAdapter(): void {
  activeTenantStorageAdapter = null;
}
