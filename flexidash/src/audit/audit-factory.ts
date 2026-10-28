/**
 * FlexiDash Audit Storage Adapter Factory
 *
 * Dynamically resolves the audit storage adapter:
 * 1. Testing override (if set via setAuditStorageAdapterForTesting)
 * 2. Cloudflare KV Adapter (if KV namespace binding is detected in global/environment)
 * 3. FileAuditStorageAdapter (for local development and Node test runners)
 */

import type { IAuditLogStorageAdapter, AuditEvent } from './types.ts';
import { FileAuditStorageAdapter } from './storage/file-audit-storage.ts';
import { CloudflareKvAuditStorageAdapter } from './storage/cloudflare-kv-audit-storage.ts';
import { resolveEnvironmentKv, validateProductionStorage } from '../layout/storage/storage-factory.ts';
import type { KVNamespaceLike } from '../layout/storage/cloudflare-kv-storage.ts';

let activeAuditStorageAdapter: IAuditLogStorageAdapter | null = null;

export function getAuditStorageAdapter(customKv?: KVNamespaceLike): IAuditLogStorageAdapter {
  if (activeAuditStorageAdapter) {
    return activeAuditStorageAdapter;
  }

  const kv = customKv || resolveEnvironmentKv();
  if (kv) {
    activeAuditStorageAdapter = new CloudflareKvAuditStorageAdapter(kv);
    return activeAuditStorageAdapter;
  }

  validateProductionStorage(null);

  activeAuditStorageAdapter = new FileAuditStorageAdapter();
  return activeAuditStorageAdapter;
}

export function setAuditStorageAdapterForTesting(adapter: IAuditLogStorageAdapter | null): void {
  activeAuditStorageAdapter = adapter;
}

export function resetAuditStorageAdapter(): void {
  activeAuditStorageAdapter = null;
}

/**
 * Convenience logging function for recording security events across API handlers
 */
export async function recordAuditEvent(
  event: Omit<AuditEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<AuditEvent | null> {
  try {
    const adapter = getAuditStorageAdapter();
    return await adapter.recordEvent(event);
  } catch (err) {
    console.error('[AuditService] Failed to record audit event:', err);
    return null;
  }
}

