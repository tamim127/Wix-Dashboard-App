/**
 * FlexiDash JWT Service
 *
 * Implements HMAC-SHA256 JWT generation and verification using Node crypto.
 * Does not depend on external JWT packages to minimize runtime footprint.
 */

import crypto from 'node:crypto';
import type { FlexiDashJwtPayload } from '../models/session.ts';
import { UnauthorizedError } from '../errors/app-error.ts';
import { getAppConfig } from '../config/env.ts';

function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function signJwt(
  payload: Omit<FlexiDashJwtPayload, 'iss' | 'aud' | 'exp' | 'iat'>,
  expiresInSeconds?: number,
  customSecret?: string
): string {
  const config = getAppConfig();
  const secret = customSecret || config.jwtSecret;
  const expDuration = expiresInSeconds || config.jwtExpiresInSeconds;

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: FlexiDashJwtPayload = {
    ...payload,
    iss: config.jwtIssuer,
    aud: config.jwtAudience,
    iat: now,
    exp: now + expDuration,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  const encodedSignature = base64UrlEncode(signature);
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export function verifyJwt(token: string, customSecret?: string): FlexiDashJwtPayload {
  if (!token || typeof token !== 'string') {
    throw new UnauthorizedError('JWT must be a non-empty string');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new UnauthorizedError('Malformed JWT structure');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const config = getAppConfig();
  const secret = customSecret || config.jwtSecret;

  // 1. Validate Header and Algorithm to prevent algorithm confusion attacks
  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (!header || typeof header !== 'object' || header.alg !== 'HS256') {
      throw new UnauthorizedError(`Unsupported or invalid JWT algorithm: '${header?.alg}'. Only HS256 is supported.`);
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Malformed JWT header');
  }

  // 2. Verify signature using constant-time comparison
  const expectedSignatureBuffer = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  let receivedSignatureBuffer: Buffer;
  try {
    const normalized = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
    receivedSignatureBuffer = Buffer.from(normalized, 'base64');
  } catch {
    throw new UnauthorizedError('Invalid signature encoding in JWT');
  }

  if (
    receivedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)
  ) {
    throw new UnauthorizedError('Invalid JWT signature');
  }

  // 3. Parse payload
  let payload: FlexiDashJwtPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    throw new UnauthorizedError('Malformed JWT payload');
  }

  // 4. Verify temporal validity
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new UnauthorizedError('JWT has expired', { exp: payload.exp, now });
  }

  // 4. Verify Issuer & Audience
  if (config.jwtIssuer && payload.iss !== config.jwtIssuer) {
    throw new UnauthorizedError('Invalid JWT issuer', { expected: config.jwtIssuer, received: payload.iss });
  }

  if (config.jwtAudience && payload.aud !== config.jwtAudience) {
    throw new UnauthorizedError('Invalid JWT audience', { expected: config.jwtAudience, received: payload.aud });
  }

  return payload;
}
