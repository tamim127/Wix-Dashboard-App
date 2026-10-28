/**
 * FlexiDash Backend Authorization Middleware
 *
 * Enforces cryptographic instance resolution, Bearer token verification,
 * and server-side RBAC evaluation on protected endpoints.
 */

import type { AuthSession } from '../models/session.ts';
import type { AuthContext } from './types.ts';
import type { PermissionKey } from '../models/rbac.ts';
import { toInstanceId, toFlexiDashUserId, type InstanceId } from '../models/identity.ts';
import { UnauthorizedError, TenantMismatchError } from '../errors/app-error.ts';
import { getAuthProvider } from './auth-factory.ts';
import { PolicyEngine } from '../rbac/policy-engine.ts';
import { getAppConfig } from '../config/env.ts';
import { verifyJwt } from './jwt-service.ts';
import { recordAuditEvent } from '../audit/audit-factory.ts';
import { parseAndVerifyWixInstance } from './wix-instance-validator.ts';
import { ALL_PERMISSION_KEYS, SYSTEM_ROLE_OWNER, SYSTEM_ROLE_ADMIN, DEFAULT_ADMIN_PERMISSIONS } from '../models/rbac.ts';

export interface VerifiedRequestContext {
  session: AuthSession;
  context: AuthContext;
}

export function extractBearerToken(authHeader?: string | null): string | null {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const parts = authHeader.trim().split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

export async function authorizeRequest(
  headers: Record<string, string | undefined> | Headers,
  requiredPermission?: PermissionKey,
  targetTenantId?: string
): Promise<VerifiedRequestContext> {
  const getHeader = (key: string): string | undefined => {
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(key) || undefined;
    }
    const rec = headers as Record<string, string | undefined>;
    return rec[key] || rec[key.toLowerCase()];
  };

  const config = getAppConfig();
  const authHeader = getHeader('authorization') || getHeader('Authorization');
  const token = extractBearerToken(authHeader);
  const wixInstanceHeader = getHeader('x-wix-instance');

  let session: AuthSession | null = null;
  let instanceId: InstanceId;

  const authContext: AuthContext = {
    instanceId: toInstanceId(getHeader('x-wix-instance-id') || config.wixClientInstanceId),
    ipAddress: getHeader('x-forwarded-for') || '127.0.0.1',
    userAgent: getHeader('user-agent'),
  };

  if (token) {
    // 1. Verify Bearer JWT
    let tokenInstanceId: string | null = null;
    try {
      const payload = verifyJwt(token);
      tokenInstanceId = payload.inst;
    } catch {
      throw new UnauthorizedError('Invalid, expired, or malformed authentication token');
    }

    const instanceIdRaw = getHeader('x-wix-instance-id') || tokenInstanceId || config.wixClientInstanceId;
    instanceId = toInstanceId(instanceIdRaw);
    authContext.instanceId = instanceId;

    if (tokenInstanceId && tokenInstanceId.toLowerCase() !== instanceId.toLowerCase()) {
      throw new TenantMismatchError('Token instance does not match requested tenant context');
    }

    const provider = getAuthProvider();
    session = await provider.resolveSession(token, authContext);
  } else if (wixInstanceHeader) {
    // 2. Verify Signed Wix Platform Instance
    const verified = parseAndVerifyWixInstance(
      wixInstanceHeader,
      config.wixClientSecret || config.jwtSecret
    );
    instanceId = verified.instanceId;
    authContext.instanceId = instanceId;

    const isOwner = verified.permissions === 'OWNER';
    const isAdmin = isOwner || verified.permissions === 'ADMIN';

    session = {
      userId: toFlexiDashUserId(verified.uid ? `wix_${verified.uid}` : `wix_owner_${instanceId}`),
      instanceId,
      roles: isOwner ? [SYSTEM_ROLE_OWNER] : isAdmin ? [SYSTEM_ROLE_ADMIN] : ['role_visitor'],
      permissions: isOwner ? [...ALL_PERMISSION_KEYS] : isAdmin ? [...DEFAULT_ADMIN_PERMISSIONS] : ['portal:access'],
      email: `${verified.uid || 'owner'}@site-instance.local`,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  } else {
    throw new UnauthorizedError('Missing authentication credentials. Provide either Authorization Bearer token or signed x-wix-instance.');
  }

  if (!session) {
    throw new UnauthorizedError('Session resolution failed or revoked');
  }

  // Cross-tenant verification: if endpoint targets a specific tenant
  if (targetTenantId) {
    PolicyEngine.assertTenantAccess(session, toInstanceId(targetTenantId));
  }

  // Permission check
  if (requiredPermission) {
    try {
      PolicyEngine.assertPermission(session, requiredPermission);
    } catch (permErr) {
      await recordAuditEvent({
        instanceId,
        actorId: session.userId,
        action: 'rbac:permission_denied',
        outcome: 'DENIED',
        target: requiredPermission,
        ipAddress: authContext.ipAddress,
        userAgent: authContext.userAgent,
        metadata: {
          requiredPermission,
          roles: session.roles,
        },
      });
      throw permErr;
    }
  }

  return { session, context: authContext };
}
