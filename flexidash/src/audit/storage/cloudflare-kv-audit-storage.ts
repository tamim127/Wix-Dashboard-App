/**
 * FlexiDash Cloudflare KV Audit Log Storage Adapter
 *
 * Implements IAuditLogStorageAdapter using Cloudflare Workers KV.
 * Provides distributed, serverless audit trail persistence without local filesystem reliance.
 * Partitions records strictly by tenant InstanceId.
 */

import type { IAuditLogStorageAdapter, AuditEvent, AuditLogQuery, AuditLogQueryResult } from '../types.ts';
import type { InstanceId } from '../../models/identity.ts';
import type { KVNamespaceLike } from '../../layout/storage/cloudflare-kv-storage.ts';
import { sanitizeMetadata } from '../sanitizer.ts';

export class CloudflareKvAuditStorageAdapter implements IAuditLogStorageAdapter {
  private readonly kv: KVNamespaceLike;

  constructor(kv: KVNamespaceLike) {
    if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
      throw new Error('CloudflareKvAuditStorageAdapter requires a valid KVNamespaceLike instance');
    }
    this.kv = kv;
  }

  private sanitizeIdentifier(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private getEventsKey(instanceId: InstanceId): string {
    return `audit:${this.sanitizeIdentifier(instanceId)}:events`;
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private async loadRawEvents(instanceId: InstanceId): Promise<AuditEvent[]> {
    const key = this.getEventsKey(instanceId);
    try {
      const raw = await this.kv.get(key, 'text');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error(`[CloudflareKvAuditStorage] Error reading audit logs for ${instanceId}:`, err);
      return [];
    }
  }

  public async recordEvent(
    event: Omit<AuditEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
  ): Promise<AuditEvent> {
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

    const key = this.getEventsKey(event.instanceId);
    const existing = await this.loadRawEvents(event.instanceId);

    // Prepend newest event
    existing.unshift(fullEvent);

    // Maintain recent audit trail (cap at 2000 events to stay well within KV value size limits)
    const capped = existing.slice(0, 2000);

    await this.kv.put(key, JSON.stringify(capped));
    return fullEvent;
  }

  public async queryEvents(query: AuditLogQuery): Promise<AuditLogQueryResult> {
    const rawEvents = await this.loadRawEvents(query.instanceId);

    const filtered = rawEvents.filter((ev) => {
      // 1. Tenant boundary
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

      // 5. Date filters
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
      await this.kv.delete(this.getEventsKey(instanceId));
    }
  }
}

