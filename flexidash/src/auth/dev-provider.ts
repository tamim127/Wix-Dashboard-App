/**
 * FlexiDash Development Authentication Provider
 *
 * Isolated mock provider enabling local unit testing and development.
 *
 * CRITICAL SECURITY INVARIANT:
 * This provider throws an error and fails closed if instantiated in production.
 */

import crypto from 'node:crypto';
import type { IAuthenticationProvider, LoginCredentials, RegisterPayload, AuthResult, AuthContext } from './types.ts';
import type { AuthSession } from '../models/session.ts';
import { toFlexiDashUserId, toWixContactId, toWixMemberId, type FlexiDashUserId } from '../models/identity.ts';
import { DEFAULT_ADMIN_PERMISSIONS, DEFAULT_MEMBER_PERMISSIONS, SYSTEM_ROLE_ADMIN, SYSTEM_ROLE_MEMBER, SYSTEM_ROLE_OWNER } from '../models/rbac.ts';
import { UnauthorizedError, ValidationError } from '../errors/app-error.ts';
import { getAppConfig, ConfigurationError } from '../config/env.ts';
import { signJwt, verifyJwt } from './jwt-service.ts';

interface StoredDevUser {
  userId: FlexiDashUserId;
  instanceId: string;
  email: string;
  passwordHash: string;
  allowedPasswordHashes?: string[];
  roles: string[];
  isVerified: boolean;
  isApproved: boolean;
  createdAt: Date;
}

export class DevelopmentAuthProvider implements IAuthenticationProvider {
  public readonly providerId = 'dev-mock-provider';
  public readonly supportsWixNativeSession = false;

  private readonly users = new Map<string, StoredDevUser>();

  constructor() {
    const config = getAppConfig();
    if (config.nodeEnv === 'production') {
      throw new ConfigurationError('CRITICAL: DevelopmentAuthProvider must NEVER be instantiated in production mode');
    }
    // Seed default admin and member users for the default instance (accepts primary and alias passwords)
    this.seedUser('admin@flexidash.local', 'AdminPassword123!', [SYSTEM_ROLE_ADMIN], config.wixClientInstanceId, 'AdminSecure123!');
    this.seedUser('member@flexidash.local', 'MemberPassword123!', [SYSTEM_ROLE_MEMBER], config.wixClientInstanceId, 'MemberPass123!');
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private getUserKey(instanceId: string, email: string): string {
    return `${instanceId.toLowerCase()}::${email.toLowerCase()}`;
  }

  private seedUser(email: string, pass: string, roles: string[], instanceId: string, altPass?: string): void {
    const key = this.getUserKey(instanceId, email);
    const userId = toFlexiDashUserId(`dev-user-${crypto.randomUUID()}`);
    const passwordHashes = [this.hashPassword(pass)];
    if (altPass) {
      passwordHashes.push(this.hashPassword(altPass));
    }
    this.users.set(key, {
      userId,
      instanceId,
      email,
      passwordHash: this.hashPassword(pass),
      allowedPasswordHashes: passwordHashes,
      roles,
      isVerified: true,
      isApproved: true,
      createdAt: new Date(),
    });
  }

  public async login(credentials: LoginCredentials, context: AuthContext): Promise<AuthResult> {
    if (!credentials.email || !credentials.password) {
      throw new ValidationError('Email and password are required for login');
    }

    const key = this.getUserKey(context.instanceId, credentials.email);
    const user = this.users.get(key);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const providedHash = this.hashPassword(credentials.password);
    const matches = user.allowedPasswordHashes
      ? user.allowedPasswordHashes.includes(providedHash)
      : user.passwordHash === providedHash;

    if (!matches) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isVerified) {
      return {
        success: false,
        requiresEmailVerification: true,
        errorMessage: 'Email verification required before login',
      };
    }

    if (!user.isApproved) {
      return {
        success: false,
        requiresAdminApproval: true,
        errorMessage: 'Account is pending administrative approval',
      };
    }

    const session = this.buildSession(user, context);
    const flexidashJwt = signJwt({
      sub: user.userId,
      inst: context.instanceId,
      roles: user.roles,
      email: user.email,
    });

    return {
      success: true,
      session,
      flexidashJwt,
    };
  }

  public async register(payload: RegisterPayload, context: AuthContext): Promise<AuthResult> {
    if (!payload.email || !payload.password) {
      throw new ValidationError('Email and password are required for registration');
    }

    if (payload.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    const key = this.getUserKey(context.instanceId, payload.email);
    if (this.users.has(key)) {
      throw new ValidationError('An account with this email already exists in this site');
    }

    const userId = toFlexiDashUserId(`dev-user-${crypto.randomUUID()}`);
    const newUser: StoredDevUser = {
      userId,
      instanceId: context.instanceId,
      email: payload.email,
      passwordHash: this.hashPassword(payload.password),
      roles: [SYSTEM_ROLE_MEMBER],
      isVerified: true, // Auto-verified for local dev testing
      isApproved: true,
      createdAt: new Date(),
    };

    this.users.set(key, newUser);

    const session = this.buildSession(newUser, context);
    const flexidashJwt = signJwt({
      sub: newUser.userId,
      inst: context.instanceId,
      roles: newUser.roles,
      email: newUser.email,
    });

    return {
      success: true,
      session,
      flexidashJwt,
    };
  }

  public async logout(_session: AuthSession, _context: AuthContext): Promise<void> {
    // In dev provider, JWT is stateless; client drops the token
    return Promise.resolve();
  }

  public async requestPasswordReset(email: string, context: AuthContext): Promise<void> {
    // Resists enumeration: returns identical response regardless of whether user exists
    const key = this.getUserKey(context.instanceId, email);
    const user = this.users.get(key);
    if (user) {
      // In dev mode, password reset simulated
    }
    return Promise.resolve();
  }

  public async verifyEmail(token: string, _context: AuthContext): Promise<AuthResult> {
    if (!token) throw new ValidationError('Verification token is required');
    return { success: true };
  }

  public async resolveSession(token: string, context: AuthContext): Promise<AuthSession | null> {
    try {
      const payload = verifyJwt(token);

      // Verify that token belongs to this installation context
      if (payload.inst.toLowerCase() !== context.instanceId.toLowerCase()) {
        throw new UnauthorizedError('Token does not match tenant context');
      }

      const roles = Array.isArray(payload.roles)
        ? payload.roles
        : typeof (payload as any).role === 'string'
        ? [(payload as any).role]
        : [];

      const permissions = Array.isArray(payload.permissions) && payload.permissions.length > 0
        ? payload.permissions
        : roles.includes(SYSTEM_ROLE_ADMIN) || roles.includes(SYSTEM_ROLE_OWNER)
          ? DEFAULT_ADMIN_PERMISSIONS
          : DEFAULT_MEMBER_PERMISSIONS;

      return {
        userId: toFlexiDashUserId(payload.sub),
        instanceId: context.instanceId,
        roles,
        permissions,
        email: payload.email,
        wixMemberId: toWixMemberId(`mock-wix-member-${payload.sub}`),
        wixContactId: toWixContactId(`mock-wix-contact-${payload.sub}`),
        expiresAt: payload.exp,
      };
    } catch {
      return null;
    }
  }

  private buildSession(user: StoredDevUser, context: AuthContext): AuthSession {
    const permissions = user.roles.includes(SYSTEM_ROLE_ADMIN)
      ? DEFAULT_ADMIN_PERMISSIONS
      : DEFAULT_MEMBER_PERMISSIONS;

    return {
      userId: user.userId,
      instanceId: context.instanceId,
      roles: user.roles,
      permissions,
      email: user.email,
      wixMemberId: toWixMemberId(`mock-wix-member-${user.userId}`),
      wixContactId: toWixContactId(`mock-wix-contact-${user.userId}`),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }
}
