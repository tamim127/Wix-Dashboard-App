/**
 * FlexiDash Authentication Provider Interface & Contract
 *
 * Provides a clean adapter boundary decoupling the identity provider
 * from the dashboard, RBAC, and data layers.
 */

import type { AuthSession } from '../models/session.ts';
import type { InstanceId } from '../models/identity.ts';

export interface AuthContext {
  instanceId: InstanceId;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginCredentials {
  email: string;
  password?: string;
  code?: string;
}

export interface RegisterPayload {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  customFields?: Record<string, unknown>;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  flexidashJwt?: string;
  wixSessionToken?: string;
  requiresEmailVerification?: boolean;
  requiresAdminApproval?: boolean;
  errorMessage?: string;
}

export interface IAuthenticationProvider {
  readonly providerId: string;
  readonly supportsWixNativeSession: boolean;

  login(credentials: LoginCredentials, context: AuthContext): Promise<AuthResult>;
  register(payload: RegisterPayload, context: AuthContext): Promise<AuthResult>;
  logout(session: AuthSession, context: AuthContext): Promise<void>;
  requestPasswordReset(email: string, context: AuthContext): Promise<void>;
  verifyEmail(token: string, context: AuthContext): Promise<AuthResult>;
  resolveSession(token: string, context: AuthContext): Promise<AuthSession | null>;
}
