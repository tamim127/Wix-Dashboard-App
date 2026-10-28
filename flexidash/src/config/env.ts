/**
 * FlexiDash Environment Configuration & Runtime Validator
 *
 * Enforces strict server-side secrets handling and fail-closed validation.
 */

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  wixClientId: string;
  wixClientSecret: string;
  wixClientInstanceId: string;
  wixClientPublicKey?: string;
  authMode: 'wix-native' | 'dev-mock' | 'external-oidc';
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtExpiresInSeconds: number;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`[FlexiDash Config Error]: ${message}`);
    this.name = 'ConfigurationError';
  }
}

let cachedConfig: AppConfig | null = null;

export function loadAppConfig(envSource: Record<string, string | undefined> = process.env): AppConfig {
  const nodeEnv = (envSource.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const authMode = (envSource.FLEXIDASH_AUTH_MODE || (nodeEnv === 'production' ? 'wix-native' : 'dev-mock')) as AppConfig['authMode'];

  // Security Invariant: Development mock authentication MUST NEVER be permitted in production
  if (nodeEnv === 'production' && authMode === 'dev-mock') {
    throw new ConfigurationError('FLEXIDASH_AUTH_MODE=dev-mock is strictly forbidden in production mode');
  }

  const wixClientId = envSource.WIX_CLIENT_ID || '';
  const wixClientSecret = envSource.WIX_CLIENT_SECRET || '';
  const wixClientInstanceId = envSource.WIX_CLIENT_INSTANCE_ID || '00000000-0000-0000-0000-000000000000';
  const wixClientPublicKey = envSource.WIX_CLIENT_PUBLIC_KEY;

  if (nodeEnv === 'production') {
    if (!wixClientId) {
      throw new ConfigurationError('WIX_CLIENT_ID must be configured in production');
    }
    if (!wixClientSecret) {
      throw new ConfigurationError('WIX_CLIENT_SECRET must be configured in production');
    }
  }

  // Fallback JWT secret strictly in non-production
  const jwtSecret = envSource.FLEXIDASH_JWT_SECRET || wixClientSecret || (nodeEnv !== 'production' ? 'dev-fallback-insecure-jwt-secret-key-32ch' : '');
  if (!jwtSecret && nodeEnv === 'production') {
    throw new ConfigurationError('JWT signing secret must be provided in production');
  }
  if (nodeEnv === 'production' && jwtSecret.length < 32) {
    throw new ConfigurationError('FLEXIDASH_JWT_SECRET in production must be at least 32 characters in length');
  }

  const config: AppConfig = {
    nodeEnv,
    wixClientId,
    wixClientSecret,
    wixClientInstanceId,
    wixClientPublicKey,
    authMode,
    jwtSecret,
    jwtIssuer: envSource.FLEXIDASH_JWT_ISSUER || 'flexidash.wix.app',
    jwtAudience: envSource.FLEXIDASH_JWT_AUDIENCE || 'flexidash:api',
    jwtExpiresInSeconds: parseInt(envSource.FLEXIDASH_JWT_EXPIRES_IN || '3600', 10),
  };

  cachedConfig = config;
  return config;
}

export function getAppConfig(): AppConfig {
  if (!cachedConfig) {
    return loadAppConfig();
  }
  return cachedConfig;
}

export function resetAppConfigForTesting(): void {
  cachedConfig = null;
}

