/**
 * FlexiDash Wix Signed Instance Validator
 *
 * Verifies cryptographic instance signatures issued by the Wix Platform:
 * Format: <base64UrlSignature>.<base64UrlPayload>
 * Signature: HMAC-SHA256(base64UrlPayload, wixClientSecret)
 *
 * Fails closed on signature tampering, expired timestamps, or malformed payloads.
 */

import crypto from 'node:crypto';
import { UnauthorizedError, ValidationError } from '../errors/app-error.ts';
import { toInstanceId, type InstanceId } from '../models/identity.ts';

export interface WixInstancePayload {
  instanceId: InstanceId;
  appDefId?: string;
  signDate: string;
  uid?: string; // Wix site user/member ID
  permissions?: 'OWNER' | 'ADMIN' | 'CONTRIBUTOR' | string;
  demoMode?: boolean;
  siteOwnerId?: string;
  vendorProductId?: string;
}

export interface VerifyWixInstanceOptions {
  maxAgeSeconds?: number;
  expectedAppDefId?: string;
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function parseAndVerifyWixInstance(
  rawInstance: string | null | undefined,
  wixClientSecret: string,
  options?: VerifyWixInstanceOptions
): WixInstancePayload {
  if (!rawInstance || typeof rawInstance !== 'string') {
    throw new UnauthorizedError('Missing or empty Wix instance token');
  }

  if (!wixClientSecret || wixClientSecret.length < 16) {
    throw new ValidationError('A valid Wix Client Secret is required to verify signed instances');
  }

  const parts = rawInstance.trim().split('.');
  if (parts.length !== 2) {
    throw new UnauthorizedError('Malformed Wix instance token format. Expected <signature>.<payload>');
  }

  const [signatureB64, payloadB64] = parts;

  // 1. Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', wixClientSecret)
    .update(payloadB64)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const sigBuffer = Buffer.from(signatureB64);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new UnauthorizedError('Invalid cryptographic signature on Wix instance token');
  }

  // 2. Parse payload JSON
  let payload: any;
  try {
    const jsonStr = base64UrlDecode(payloadB64);
    payload = JSON.parse(jsonStr);
  } catch {
    throw new UnauthorizedError('Malformed payload inside Wix instance token');
  }

  if (!payload || typeof payload !== 'object' || !payload.instanceId) {
    throw new UnauthorizedError("Missing required 'instanceId' claim in Wix instance token");
  }

  // 3. Optional temporal and appDefId validation
  if (options?.maxAgeSeconds && payload.signDate) {
    const signTime = Date.parse(payload.signDate);
    if (!isNaN(signTime)) {
      const ageSeconds = (Date.now() - signTime) / 1000;
      if (ageSeconds > options.maxAgeSeconds) {
        throw new UnauthorizedError(`Wix instance token has expired (age: ${Math.round(ageSeconds)}s, max: ${options.maxAgeSeconds}s)`);
      }
      if (ageSeconds < -300) {
        throw new UnauthorizedError('Wix instance token sign date is in the future');
      }
    }
  }

  if (options?.expectedAppDefId && payload.appDefId && payload.appDefId !== options.expectedAppDefId) {
    throw new UnauthorizedError(`Wix instance appDefId mismatch: expected '${options.expectedAppDefId}', received '${payload.appDefId}'`);
  }

  return {
    instanceId: toInstanceId(payload.instanceId),
    appDefId: payload.appDefId,
    signDate: payload.signDate,
    uid: payload.uid,
    permissions: payload.permissions,
    demoMode: Boolean(payload.demoMode),
    siteOwnerId: payload.siteOwnerId,
    vendorProductId: payload.vendorProductId,
  };
}

/**
 * Creates a signed Wix instance string for testing and mock environments
 */
export function createMockWixInstance(
  payload: {
    instanceId: string;
    appDefId?: string;
    uid?: string;
    permissions?: string;
    demoMode?: boolean;
    signDate?: string;
  },
  wixClientSecret: string
): string {
  const json = JSON.stringify({
    ...payload,
    signDate: payload.signDate || new Date().toISOString(),
  });

  const payloadB64 = Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const signatureB64 = crypto
    .createHmac('sha256', wixClientSecret)
    .update(payloadB64)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signatureB64}.${payloadB64}`;
}

