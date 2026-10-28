/**
 * FlexiDash Storage Adapter Factory
 *
 * Dynamically resolves the storage adapter according to runtime environment:
 * 1. Test Override (if configured via setLayoutStorageAdapterForTesting)
 * 2. Cloudflare KV Adapter (if FLEXIDASH_LAYOUTS_KV or SESSION binding exists in global/context)
 * 3. FileLayoutStorageAdapter (local development and Node.js test environments)
 */

import type { ILayoutStorageAdapter } from './types.ts';
import { FileLayoutStorageAdapter } from './file-storage.ts';
import { CloudflareKvLayoutStorageAdapter, type KVNamespaceLike } from './cloudflare-kv-storage.ts';
import { getAppConfig, ConfigurationError } from '../../config/env.ts';

let activeStorageAdapter: ILayoutStorageAdapter | null = null;

export function resolveEnvironmentKv(contextOrEnv?: unknown): KVNamespaceLike | null {
  // 1. Direct context object from Astro/Cloudflare runtime locals
  if (contextOrEnv && typeof contextOrEnv === 'object') {
    const ctx = contextOrEnv as Record<string, any>;
    const env = ctx.locals?.runtime?.env || ctx.locals?.env || ctx.locals || ctx.env || ctx;
    if (env.FLEXIDASH_KV && typeof env.FLEXIDASH_KV.get === 'function') {
      return env.FLEXIDASH_KV;
    }
    if (env.FLEXIDASH_LAYOUTS_KV && typeof env.FLEXIDASH_LAYOUTS_KV.get === 'function') {
      return env.FLEXIDASH_LAYOUTS_KV;
    }
    if (env.SESSION && typeof env.SESSION.get === 'function') {
      return env.SESSION;
    }
  }

  // 2. GlobalThis bindings
  const g = globalThis as Record<string, any>;
  if (g.FLEXIDASH_KV && typeof g.FLEXIDASH_KV.get === 'function') {
    return g.FLEXIDASH_KV;
  }
  if (g.FLEXIDASH_LAYOUTS_KV && typeof g.FLEXIDASH_LAYOUTS_KV.get === 'function') {
    return g.FLEXIDASH_LAYOUTS_KV;
  }
  if (g.SESSION && typeof g.SESSION.get === 'function') {
    return g.SESSION;
  }
  if (g.env?.FLEXIDASH_KV && typeof g.env.FLEXIDASH_KV.get === 'function') {
    return g.env.FLEXIDASH_KV;
  }
  if (g.env?.SESSION && typeof g.env.SESSION.get === 'function') {
    return g.env.SESSION;
  }

  return null;
}

export function validateProductionStorage(kv?: KVNamespaceLike | null): void {
  const config = getAppConfig();
  if (config.nodeEnv === 'production') {
    const resolved = kv || resolveEnvironmentKv();
    if (!resolved) {
      throw new ConfigurationError(
        'In production Cloudflare Worker deployment, a persistent KV namespace binding (e.g. FLEXIDASH_KV or SESSION) is strictly required. Local filesystem writes are ephemeral on edge workers.'
      );
    }
  }
}

export function getLayoutStorageAdapter(customKv?: KVNamespaceLike): ILayoutStorageAdapter {
  if (activeStorageAdapter) {
    return activeStorageAdapter;
  }

  // 1. If explicit KV binding provided or detected in environment
  const kv = customKv || resolveEnvironmentKv();
  if (kv) {
    activeStorageAdapter = new CloudflareKvLayoutStorageAdapter(kv);
    return activeStorageAdapter;
  }

  // 2. Validate fail-closed production invariant
  validateProductionStorage(null);

  // 3. Default to file-based adapter for local dev & testing
  activeStorageAdapter = new FileLayoutStorageAdapter();
  return activeStorageAdapter;
}

export function setLayoutStorageAdapterForTesting(adapter: ILayoutStorageAdapter | null): void {
  activeStorageAdapter = adapter;
}

export function resetLayoutStorageAdapter(): void {
  activeStorageAdapter = null;
}

