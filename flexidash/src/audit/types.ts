/**
 * FlexiDash Persistent Audit Logging Types
 *
 * Defines the schema, actions, outcomes, and storage contracts for
 * tamper-resistant security audit trails.
 */

import type { InstanceId, FlexiDashUserId } from '../models/identity.ts';

export type AuditAction =
  | 'auth:login'
  | 'auth:login_failure'
  | 'auth:register'
  | 'auth:logout'
  | 'auth:session_expired'
  | 'rbac:role_assign'
  | 'rbac:role_assign_failure'
  | 'rbac:permission_denied'
  | 'layout:save'
  | 'layout:reset'
  | 'admin:action'
  | 'system:config_error'
  | (string & {});

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED';

export interface AuditEvent {
  id: string; // Unique event identifier (UUID)
  timestamp: string; // ISO 8601 string
  instanceId: InstanceId;
  actorId?: FlexiDashUserId | string;
  action: AuditAction;
  outcome: AuditOutcome;
  target?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogQuery {
  instanceId: InstanceId;
  actorId?: string;
  action?: string;
  outcome?: AuditOutcome;
  startDate?: string; // ISO 8601
  endDate?: string;   // ISO 8601
  page?: number;      // 1-indexed, default 1
  limit?: number;     // default 20, max 100
}

export interface AuditLogQueryResult {
  events: AuditEvent[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IAuditLogStorageAdapter {
  /**
   * Append a security audit event to persistent storage.
   * Redacts sensitive data before writing.
   */
  recordEvent(
    event: Omit<AuditEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
  ): Promise<AuditEvent>;

  /**
   * Query audit events for an installation tenant with filtering and pagination.
   */
  queryEvents(query: AuditLogQuery): Promise<AuditLogQueryResult>;

  /**
   * Cleans up stored events for testing isolation.
   */
  clearEventsForTesting?(instanceId?: InstanceId): Promise<void>;
}

