/**
 * FlexiDash Role Storage Adapter Factory
 *
 * Dynamically resolves the role storage adapter:
 * 1. Testing override (if set via setRoleStorageAdapterForTesting)
 * 2. Cloudflare KV Adapter (if KV namespace binding is detected in global/environment)
 * 3. FileRoleStorageAdapter (for local development and Node test runners)
 */

import type { IRoleStorageAdapter } from './types.ts';
import { FileRoleStorageAdapter } from './file-role-storage.ts';
import { CloudflareKvRoleStorageAdapter } from './cloudflare-kv-role-storage.ts';
import { resolveEnvironmentKv, validateProductionStorage } from '../../layout/storage/storage-factory.ts';
import type { KVNamespaceLike } from '../../layout/storage/cloudflare-kv-storage.ts';

let activeRoleStorageAdapter: IRoleStorageAdapter | null = null;

export function getRoleStorageAdapter(customKv?: KVNamespaceLike): IRoleStorageAdapter {
  if (activeRoleStorageAdapter) {
    return activeRoleStorageAdapter;
  }

  const kv = customKv || resolveEnvironmentKv();
  if (kv) {
    activeRoleStorageAdapter = new CloudflareKvRoleStorageAdapter(kv);
    return activeRoleStorageAdapter;
  }

  validateProductionStorage(null);

  activeRoleStorageAdapter = new FileRoleStorageAdapter();
  return activeRoleStorageAdapter;
}

export function setRoleStorageAdapterForTesting(adapter: IRoleStorageAdapter | null): void {
  activeRoleStorageAdapter = adapter;
}

export function resetRoleStorageAdapter(): void {
  activeRoleStorageAdapter = null;
}

