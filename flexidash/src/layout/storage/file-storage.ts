/**
 * FlexiDash File-Backed Persistent Layout Storage Adapter
 *
 * Persists layouts to the filesystem using atomic file operations.
 * Guarantees that layouts survive server restarts and process termination.
 * Strictly isolates files by tenant instanceId and user ownership.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ILayoutStorageAdapter } from './types.ts';
import type { InstanceId, FlexiDashUserId } from '../../models/identity.ts';
import type { DashboardLayout } from '../types.ts';
import { migrateLayout, createDefaultSiteLayout } from '../registry.ts';

export class FileLayoutStorageAdapter implements ILayoutStorageAdapter {
  private readonly storageDir: string;

  constructor(customStorageDir?: string) {
    if (customStorageDir) {
      this.storageDir = customStorageDir;
    } else {
      const dataDir = process.env.FLEXIDASH_DATA_DIR || path.join(process.cwd(), '.storage', 'layouts');
      this.storageDir = dataDir;
    }
  }

  public getStorageDirectory(): string {
    return this.storageDir;
  }

  private sanitizeIdentifier(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private getTenantDir(instanceId: InstanceId): string {
    return path.join(this.storageDir, this.sanitizeIdentifier(instanceId));
  }

  private getLayoutFilePath(instanceId: InstanceId, userId?: FlexiDashUserId): string {
    const tenantDir = this.getTenantDir(instanceId);
    const filename = userId ? `user_${this.sanitizeIdentifier(userId)}.json` : 'site_default.json';
    return path.join(tenantDir, filename);
  }

  public async getLayout(instanceId: InstanceId, userId?: FlexiDashUserId): Promise<DashboardLayout | null> {
    // 1. If user ID provided, attempt to load user-specific custom layout
    if (userId) {
      const userFilePath = this.getLayoutFilePath(instanceId, userId);
      try {
        const data = await fs.readFile(userFilePath, 'utf8');
        const parsed = JSON.parse(data);
        return migrateLayout(parsed);
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.error(`[FileLayoutStorage] Error reading user layout ${userFilePath}:`, err);
        }
        // Fall back to site default
      }
    }

    // 2. Load or initialize site-level default layout
    const defaultFilePath = this.getLayoutFilePath(instanceId);
    try {
      const data = await fs.readFile(defaultFilePath, 'utf8');
      const parsed = JSON.parse(data);
      return migrateLayout(parsed);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // Auto-seed default site layout if none exists
        const defaultLayout = createDefaultSiteLayout(instanceId);
        await this.saveLayout(defaultLayout);
        return defaultLayout;
      }
      console.error(`[FileLayoutStorage] Error reading default layout ${defaultFilePath}:`, err);
      return null;
    }
  }

  public async saveLayout(layout: DashboardLayout): Promise<void> {
    const tenantDir = this.getTenantDir(layout.instanceId);
    await fs.mkdir(tenantDir, { recursive: true });

    const targetFilePath = this.getLayoutFilePath(layout.instanceId, layout.userId);
    const tempFilePath = `${targetFilePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

    const payload = JSON.stringify(layout, null, 2);

    // Atomic write pattern: write to temporary file, then rename
    await fs.writeFile(tempFilePath, payload, 'utf8');
    await fs.rename(tempFilePath, targetFilePath);
  }

  public async deleteLayout(instanceId: InstanceId, userId?: FlexiDashUserId): Promise<boolean> {
    const filePath = this.getLayoutFilePath(instanceId, userId);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }

  public async listLayouts(instanceId: InstanceId): Promise<DashboardLayout[]> {
    const tenantDir = this.getTenantDir(instanceId);
    try {
      const files = await fs.readdir(tenantDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.includes('.tmp.'));
      const layouts: DashboardLayout[] = [];

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(tenantDir, file), 'utf8');
          const parsed = JSON.parse(content);
          layouts.push(migrateLayout(parsed));
        } catch {
          // Ignore invalid files
        }
      }
      return layouts;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }
}

export {
  getLayoutStorageAdapter,
  setLayoutStorageAdapterForTesting,
  resetLayoutStorageAdapter,
} from './storage-factory.ts';

