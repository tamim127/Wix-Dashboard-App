/**
 * FlexiDash File-Backed Tenant Configuration Storage Adapter
 *
 * Persists tenant installation configs and status to the local filesystem.
 * Isolates data strictly by tenant instanceId.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ITenantConfigStorageAdapter, TenantConfig } from '../types.ts';
import type { InstanceId } from '../../models/identity.ts';

export class FileTenantStorageAdapter implements ITenantConfigStorageAdapter {
  private readonly storageDir: string;

  constructor(customStorageDir?: string) {
    if (customStorageDir) {
      this.storageDir = customStorageDir;
    } else {
      const dataDir = process.env.FLEXIDASH_DATA_DIR || path.join(process.cwd(), '.storage', 'tenants');
      this.storageDir = dataDir;
    }
  }

  private sanitize(id: string): string {
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private getTenantDir(instanceId: InstanceId): string {
    return path.join(this.storageDir, this.sanitize(instanceId));
  }

  private getConfigFilePath(instanceId: InstanceId): string {
    return path.join(this.getTenantDir(instanceId), 'config.json');
  }

  private async writeAtomic(filePath: string, data: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tempPath, data, 'utf8');

    for (let i = 0; i < 5; i++) {
      try {
        await fs.rename(tempPath, filePath);
        return;
      } catch (err: any) {
        if ((err.code === 'EPERM' || err.code === 'EBUSY') && i < 4) {
          await new Promise((r) => setTimeout(r, 25 * (i + 1)));
          continue;
        }
        try {
          await fs.copyFile(tempPath, filePath);
          await fs.unlink(tempPath).catch(() => {});
          return;
        } catch {
          throw err;
        }
      }
    }
  }

  public async getTenantConfig(instanceId: InstanceId): Promise<TenantConfig | null> {
    const filePath = this.getConfigFilePath(instanceId);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data) as TenantConfig;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  public async saveTenantConfig(config: TenantConfig): Promise<TenantConfig> {
    const filePath = this.getConfigFilePath(config.instanceId);
    const existing = await this.getTenantConfig(config.instanceId);

    const now = new Date().toISOString();
    const updated: TenantConfig = {
      ...config,
      updatedAt: now,
      installedAt: existing?.installedAt || config.installedAt || now,
    };

    await this.writeAtomic(filePath, JSON.stringify(updated, null, 2));
    return updated;
  }

  public async deleteTenantConfig(instanceId: InstanceId): Promise<boolean> {
    const filePath = this.getConfigFilePath(instanceId);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }

  public async listTenants(): Promise<TenantConfig[]> {
    try {
      const entries = await fs.readdir(this.storageDir, { withFileTypes: true });
      const configs: TenantConfig[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const cfgPath = path.join(this.storageDir, entry.name, 'config.json');
          try {
            const raw = await fs.readFile(cfgPath, 'utf8');
            configs.push(JSON.parse(raw));
          } catch {
            // Ignore incomplete tenant dirs
          }
        }
      }
      return configs;
    } catch {
      return [];
    }
  }

  public async clearForTesting(instanceId?: InstanceId): Promise<void> {
    if (instanceId) {
      const tenantDir = this.getTenantDir(instanceId);
      try {
        await fs.rm(tenantDir, { recursive: true, force: true });
      } catch {
        // Ignored
      }
    } else {
      try {
        await fs.rm(this.storageDir, { recursive: true, force: true });
      } catch {
        // Ignored
      }
    }
  }
}

