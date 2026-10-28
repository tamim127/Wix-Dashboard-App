/**
 * FlexiDash File-Backed Persistent Audit Log Adapter
 *
 * Persists audit trails to the local filesystem for local development & testing.
 * Strictly partitions records by tenant instanceId.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { IAuditLogStorageAdapter, AuditEvent, AuditLogQuery, AuditLogQueryResult } from '../types.ts';
import type { InstanceId } from '../../models/identity.ts';
import { sanitizeMetadata } from '../sanitizer.ts';

export class FileAuditStorageAdapter implements IAuditLogStorageAdapter {
  private readonly storageDir: string;

  constructor(customStorageDir?: string) {
    if (customStorageDir) {
      this.storageDir = customStorageDir;
    } else {
      const dataDir = process.env.FLEXIDASH_DATA_DIR || path.join(process.cwd(), '.storage', 'audit');
      this.storageDir = dataDir;
    }
  }

  private sanitizeIdentifier(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private getTenantDir(instanceId: InstanceId): string {
    return path.join(this.storageDir, this.sanitizeIdentifier(instanceId));
  }

  private getEventsFilePath(instanceId: InstanceId): string {
    return path.join(this.getTenantDir(instanceId), 'events.json');
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

  private async loadRawEvents(instanceId: InstanceId): Promise<AuditEvent[]> {
    const filePath = this.getEventsFilePath(instanceId);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      console.error(`[FileAuditStorage] Error reading audit log for ${instanceId}:`, err);
      return [];
    }
  }

  public async recordEvent(
    event: Omit<AuditEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
  ): Promise<AuditEvent> {
    const tenantDir = this.getTenantDir(event.instanceId);
    await fs.mkdir(tenantDir, { recursive: true });

    const fullEvent: AuditEvent = {
      id: event.id || this.generateId(),
      timestamp: event.timestamp || new Date().toISOString(),
      instanceId: event.instanceId,
      actorId: event.actorId,
      action: event.action,
      outcome: event.outcome,
      target: event.target,
      metadata: sanitizeMetadata(event.metadata),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    };

    const filePath = this.getEventsFilePath(event.instanceId);
    const existing = await this.loadRawEvents(event.instanceId);

    // Prepend newest event
    existing.unshift(fullEvent);

    // Cap historical local audit logs to prevent unbounded growth in dev (keep last 5000 events)
    const capped = existing.slice(0, 5000);

    await this.writeAtomic(filePath, JSON.stringify(capped, null, 2));

    return fullEvent;
  }

  public async queryEvents(query: AuditLogQuery): Promise<AuditLogQueryResult> {
    const rawEvents = await this.loadRawEvents(query.instanceId);

    // Filter matching events
    let filtered = rawEvents.filter((ev) => {
      // 1. Instance check (strict tenant isolation)
      if (ev.instanceId !== query.instanceId) {
        return false;
      }

      // 2. Actor filter
      if (query.actorId && ev.actorId !== query.actorId) {
        return false;
      }

      // 3. Action filter
      if (query.action && ev.action !== query.action) {
        return false;
      }

      // 4. Outcome filter
      if (query.outcome && ev.outcome !== query.outcome) {
        return false;
      }

      // 5. Date range filters
      if (query.startDate) {
        const start = new Date(query.startDate).getTime();
        const evTime = new Date(ev.timestamp).getTime();
        if (evTime < start) return false;
      }

      if (query.endDate) {
        const end = new Date(query.endDate).getTime();
        const evTime = new Date(ev.timestamp).getTime();
        if (evTime > end) return false;
      }

      return true;
    });

    const totalCount = filtered.length;
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const offset = (page - 1) * limit;
    const pagedEvents = filtered.slice(offset, offset + limit);

    return {
      events: pagedEvents,
      totalCount,
      page,
      limit,
      totalPages,
    };
  }

  public async clearEventsForTesting(instanceId?: InstanceId): Promise<void> {
    if (instanceId) {
      const filePath = this.getEventsFilePath(instanceId);
      try {
        await fs.unlink(filePath);
      } catch {
        // Ignore if does not exist
      }
    } else {
      try {
        await fs.rm(this.storageDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }
  }
}

