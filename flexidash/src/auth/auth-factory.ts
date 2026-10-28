/**
 * FlexiDash Authentication Provider Factory
 */

import type { IAuthenticationProvider } from './types.ts';
import { DevelopmentAuthProvider } from './dev-provider.ts';
import { WixMembersAuthProvider } from './wix-members-adapter.ts';
import { getAppConfig } from '../config/env.ts';

let activeProvider: IAuthenticationProvider | null = null;

export function getAuthProvider(): IAuthenticationProvider {
  if (activeProvider) {
    return activeProvider;
  }

  const config = getAppConfig();
  switch (config.authMode) {
    case 'dev-mock':
      activeProvider = new DevelopmentAuthProvider();
      break;
    case 'wix-native':
    default:
      activeProvider = new WixMembersAuthProvider();
      break;
  }
  return activeProvider;
}

export function setAuthProviderForTesting(provider: IAuthenticationProvider | null): void {
  activeProvider = provider;
}
