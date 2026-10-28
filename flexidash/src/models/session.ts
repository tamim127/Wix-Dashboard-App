/**
 * FlexiDash Authentication Session & JWT Models
 */

import type { FlexiDashUserId, InstanceId, WixMemberId, WixContactId } from './identity.ts';
import type { PermissionKey } from './rbac.ts';

export interface AuthSession {
  userId: FlexiDashUserId;
  instanceId: InstanceId;
  roles: string[];
  permissions: PermissionKey[];
  email: string;
  wixMemberId?: WixMemberId;
  wixContactId?: WixContactId;
  expiresAt: number; // Unix timestamp in seconds
}

export interface FlexiDashJwtPayload {
  sub: string; // flexidashUserId
  inst: string; // instanceId
  roles: string[];
  permissions?: PermissionKey[];
  email: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  wixMemberId?: string;
  wixContactId?: string;
}
