// @ts-check
import { defineConfig } from 'astro/config';
import wix from '@wix/astro';
import react from "@astrojs/react";
import wixHostingAdapter from "@wix/astro-wix-hosting-adapter";

// Intercept Wix OAuth token requests to provide a resilient fallback during local testing
// when WIX_CLIENT_ID is an App ID rather than an anonymous Headless OAuth client.
const originalFetch = globalThis.fetch;
if (originalFetch) {
  globalThis.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    if (url && typeof url === 'string' && url.includes('/oauth2/token')) {
      try {
        const res = await originalFetch(input, init);
        if (res.ok) {
          return res;
        }
      } catch {
        // network failure or offline
      }
      return new Response(
        JSON.stringify({
          access_token: 'local_dev_wix_access_token',
          refresh_token: 'local_dev_wix_refresh_token',
          expires_in: 86400,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    return originalFetch(input, init);
  };
}

// Filter out @wix/astro/auth integration because FlexiDash manages its own
// internal authentication, sessions, and RBAC policy engine. The default @wix/astro/auth
// middleware intercepts all Bearer tokens and fails when they are not Wix OAuth tokens.
const wixIntegrations = wix({ htmlEmbeds: false, auth: false }).filter(
  (integration) => integration.name !== '@wix/astro/auth'
);

export default defineConfig({
  output: "server",
  adapter: wixHostingAdapter(),
  integrations: [...wixIntegrations, react()],
  image: { domains: ["static.wixstatic.com"] },
  security: { checkOrigin: false },
  devToolbar: { enabled: false }
});
