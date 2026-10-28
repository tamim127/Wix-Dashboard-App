/**
 * FlexiDash Typed API Client
 *
 * Provides typed methods for interacting with /api/flexidash/... backend endpoints.
 * Integrates directly with SessionManager for secure token handling.
 */

import { sessionManager } from './session-manager.ts';
import type { AuthSession } from '../models/session.ts';
import type { DashboardLayout, WidgetDefinition } from '../layout/types.ts';
import type { AuditLogQuery, AuditLogQueryResult } from '../audit/types.ts';
import type { Role, PermissionKey } from '../models/rbac.ts';
import type { MemberRecord, MemberQuery, MemberQueryResult, RoleWithMeta } from '../rbac/storage/types.ts';
import type { PageAccessRule, NavItem } from '../rbac/page-access.ts';

export type { MemberRecord, MemberQuery, MemberQueryResult, RoleWithMeta, PageAccessRule, NavItem };

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string = 'API_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export interface LoginResponse {
  success: boolean;
  token: string;
  session: AuthSession;
}

export interface RegisterResponse {
  success: boolean;
  token: string;
  session: AuthSession;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface PortalWidget {
  id: string;
  title: string;
  requiredPermission: string;
  category: 'analytics' | 'management' | 'system';
}

export interface PortalLayoutResponse {
  instanceId: string;
  userId: string;
  roles: string[];
  widgets: PortalWidget[];
  layout: DashboardLayout;
  availableWidgets?: WidgetDefinition[];
  isCustomized?: boolean;
}

export interface RoleAssignmentPayload {
  targetUserId: string;
  roleId: string;
  roleName?: string;
  permissions?: string[];
}

export interface RoleAssignmentResponse {
  success: boolean;
  assignment: {
    instanceId: string;
    targetUserId: string;
    roleId: string;
    assignedBy: string;
    assignedAt: string;
  };
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  instanceId?: string;
}

export class FlexiDashApiClient {
  private baseUrl: string;
  private fetchFn: typeof fetch;
  private defaultInstanceId?: string;

  constructor(options: ApiClientOptions = {}) {
    const defaultBase = typeof window === 'undefined' ? 'http://localhost' : '';
    this.baseUrl = options.baseUrl ?? defaultBase;
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.defaultInstanceId = options.instanceId;
  }

  public setInstanceId(instanceId: string): void {
    this.defaultInstanceId = instanceId;
  }

  /**
   * Helper to perform typed requests and parse standardized error payloads
   */
  private async request<T>(endpoint: string, options: RequestInit = {}, customInstanceId?: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const instance = customInstanceId || this.defaultInstanceId;
    if (instance && !headers.has('x-wix-instance-id')) {
      headers.set('x-wix-instance-id', instance);
    }

    // Attach Bearer token from in-memory SessionManager if available
    const token = sessionManager.getToken();
    if (token && !headers.has('authorization')) {
      headers.set('authorization', `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        ...options,
        headers,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network request failed';
      throw new ApiClientError(msg, 0, 'NETWORK_ERROR');
    }

    let responseData: unknown = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        // Fallback for malformed JSON
        responseData = null;
      }
    } else {
      const text = await response.text();
      responseData = text ? { message: text } : null;
    }

    if (!response.ok) {
      const errObj = responseData as { error?: { message?: string; code?: string; details?: Record<string, unknown> } } | null;
      const message = errObj?.error?.message || `Request failed with status ${response.status}`;
      const code = errObj?.error?.code || `HTTP_${response.status}`;
      const details = errObj?.error?.details;

      // Invalidate in-memory session if server returns 401 Unauthorized
      if (response.status === 401) {
        sessionManager.clearSession();
      }

      throw new ApiClientError(message, response.status, code, details);
    }

    return responseData as T;
  }

  /**
   * Authenticate with email & password
   * POST /api/flexidash/auth/login
   */
  public async login(
    credentials: { email: string; password: string },
    instanceId?: string
  ): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>(
      '/api/flexidash/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
      instanceId
    );

    if (data.success && data.token && data.session) {
      sessionManager.setSession(data.token, data.session);
    }

    return data;
  }

  /**
   * Register a new member account
   * POST /api/flexidash/auth/register
   */
  public async register(
    payload: { email: string; password: string },
    instanceId?: string
  ): Promise<RegisterResponse> {
    const data = await this.request<RegisterResponse>(
      '/api/flexidash/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      instanceId
    );

    if (data.success && data.token && data.session) {
      sessionManager.setSession(data.token, data.session);
    }

    return data;
  }

  /**
   * Log out active session
   * POST /api/flexidash/auth/logout
   */
  public async logout(instanceId?: string): Promise<LogoutResponse> {
    try {
      const data = await this.request<LogoutResponse>(
        '/api/flexidash/auth/logout',
        {
          method: 'POST',
        },
        instanceId
      );
      return data;
    } finally {
      // In all circumstances, purge the client-side session
      sessionManager.clearSession();
    }
  }

  /**
   * Retrieve role-filtered portal widgets & layout
   * GET /api/flexidash/portal/layout
   */
  public async getPortalLayout(instanceId?: string): Promise<PortalLayoutResponse> {
    return this.request<PortalLayoutResponse>(
      '/api/flexidash/portal/layout',
      {
        method: 'GET',
      },
      instanceId
    );
  }

  /**
   * Persist a custom or site-level dashboard layout
   * POST /api/flexidash/portal/layout
   */
  public async savePortalLayout(
    layout: DashboardLayout,
    instanceId?: string
  ): Promise<{ success: boolean; message: string; layout: DashboardLayout }> {
    return this.request<{ success: boolean; message: string; layout: DashboardLayout }>(
      '/api/flexidash/portal/layout',
      {
        method: 'POST',
        body: JSON.stringify({ layout }),
      },
      instanceId
    );
  }

  /**
   * Reset customized layout to site-level default
   * POST /api/flexidash/portal/layout/reset
   */
  public async resetPortalLayout(
    instanceId?: string
  ): Promise<{ success: boolean; message: string; layout: DashboardLayout }> {
    return this.request<{ success: boolean; message: string; layout: DashboardLayout }>(
      '/api/flexidash/portal/layout/reset',
      {
        method: 'POST',
      },
      instanceId
    );
  }

  /**
   * Assign a role to a member (admin only, enforces self-promotion block)
   * POST /api/flexidash/admin/roles/assign
   */
  public async assignRole(
    payload: RoleAssignmentPayload,
    instanceId?: string
  ): Promise<RoleAssignmentResponse> {
    return this.request<RoleAssignmentResponse>(
      '/api/flexidash/admin/roles/assign',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      instanceId
    );
  }

  /**
   * Query security audit logs
   * GET /api/flexidash/admin/audit
   */
  public async getAuditLogs(
    query?: Partial<AuditLogQuery>,
    instanceId?: string
  ): Promise<AuditLogQueryResult> {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.actorId) params.set('actorId', query.actorId);
    if (query?.action) params.set('action', query.action);
    if (query?.outcome) params.set('outcome', query.outcome);
    if (query?.startDate) params.set('startDate', query.startDate);
    if (query?.endDate) params.set('endDate', query.endDate);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<AuditLogQueryResult>(
      `/api/flexidash/admin/audit${qs}`,
      {
        method: 'GET',
      },
      instanceId
    );
  }

  /**
   * List all roles with member counts
   * GET /api/flexidash/admin/roles
   */
  public async getRoles(
    instanceId?: string
  ): Promise<{ instanceId: string; roles: RoleWithMeta[] }> {
    return this.request<{ instanceId: string; roles: RoleWithMeta[] }>(
      '/api/flexidash/admin/roles',
      { method: 'GET' },
      instanceId
    );
  }

  /**
   * Create a custom role
   * POST /api/flexidash/admin/roles
   */
  public async createRole(
    payload: {
      id?: string;
      name: string;
      description?: string;
      permissions: PermissionKey[] | string[];
      priority?: number;
    },
    instanceId?: string
  ): Promise<{ success: boolean; role: Role }> {
    return this.request<{ success: boolean; role: Role }>(
      '/api/flexidash/admin/roles',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      instanceId
    );
  }

  /**
   * Update an existing custom role
   * PUT /api/flexidash/admin/roles
   */
  public async updateRole(
    payload: {
      roleId: string;
      name?: string;
      description?: string;
      permissions?: PermissionKey[] | string[];
      priority?: number;
    },
    instanceId?: string
  ): Promise<{ success: boolean; role: Role }> {
    return this.request<{ success: boolean; role: Role }>(
      '/api/flexidash/admin/roles',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      instanceId
    );
  }

  /**
   * Delete a custom role
   * DELETE /api/flexidash/admin/roles
   */
  public async deleteRole(
    roleId: string,
    instanceId?: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/api/flexidash/admin/roles?roleId=${encodeURIComponent(roleId)}`,
      {
        method: 'DELETE',
      },
      instanceId
    );
  }

  /**
   * List members with search and filter
   * GET /api/flexidash/admin/members
   */
  public async getMembers(
    query?: MemberQuery,
    instanceId?: string
  ): Promise<MemberQueryResult & { instanceId: string; platformStatus: string }> {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.search) params.set('search', query.search);
    if (query?.roleId) params.set('roleId', query.roleId);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<MemberQueryResult & { instanceId: string; platformStatus: string }>(
      `/api/flexidash/admin/members${qs}`,
      { method: 'GET' },
      instanceId
    );
  }

  /**
   * Retrieve page access matrix and authorized navigation
   * GET /api/flexidash/portal/pages/access
   */
  public async getPageAccess(
    path?: string,
    instanceId?: string
  ): Promise<{
    instanceId: string;
    userId: string;
    roles: string[];
    allowedRoutes: string[];
    navItems: NavItem[];
    rules: PageAccessRule[];
    allowed?: boolean;
    reason?: string;
  }> {
    const qs = path ? `?path=${encodeURIComponent(path)}` : '';
    return this.request<any>(
      `/api/flexidash/portal/pages/access${qs}`,
      { method: 'GET' },
      instanceId
    );
  }

  /**
   * Execute widget-level action
   * POST /api/flexidash/portal/widgets/action
   */
  public async executeWidgetAction(
    payload: {
      widgetId: string;
      action: string;
      payload?: Record<string, unknown>;
    },
    instanceId?: string
  ): Promise<{
    success: boolean;
    widgetId: string;
    action: string;
    executedAt: string;
    result: Record<string, unknown>;
  }> {
    return this.request<any>(
      '/api/flexidash/portal/widgets/action',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      instanceId
    );
  }
}

// Singleton default client instance for browser extension UI
export const apiClient = new FlexiDashApiClient();
