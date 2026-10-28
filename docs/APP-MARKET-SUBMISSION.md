# FlexiDash — Wix App Market Submission & Readiness Guide
**Document Status**: Official Release Candidate (Phase 7)  
**App ID**: `fed82166-29ac-4cba-842a-fbedd2e1b0b1`  
**Target Environment**: Wix CLI Managed App + Cloudflare Workers / Astro SSR  

---

## 1. App Overview & Metadata

- **App Name**: FlexiDash — Personalized Member Portals & RBAC Manager
- **Category**: Community & Members / Dashboard Tools & Analytics
- **Short Description**: Build personalized member dashboards, role-based page access, and customizable widget experiences for site members.
- **Teaser**: Give your Wix site members a custom, role-filtered dashboard with drag-and-drop widgets and granular access control.
- **Support Contact**: `support@flexidash.local` (Replace with verified production support email)
- **Primary Extension**: Wix Dashboard Page (`src/extensions/dashboard/pages/my-page/my-page.extension.ts`)
- **Site-Facing Extension**: Custom Element / Route (`/portal` and `<flexidash-portal>`)

---

## 2. Submission Readiness Checklist

The readiness items are categorized into five distinct stages according to platform readiness and verification boundaries:

### Category 1: Completed and Verified in Code (100% Automated Test Coverage)
- [x] **Zero Hardcoded Secrets**: All cryptographic secrets, JWT signing keys, and Wix client credentials are read exclusively from environment variables via `src/config/env.ts`.
- [x] **Fail-Closed Production Configuration**: Server fails closed immediately if required production variables (`WIX_CLIENT_ID`, `WIX_CLIENT_SECRET`, `FLEXIDASH_JWT_SECRET`) are missing or if insecure `dev-mock` mode is configured in production.
- [x] **Multi-Tenant Partitioning**: All data models (layouts, roles, member assignments, audit logs, tenant configs) are strictly partitioned by `instanceId`. Cross-tenant queries are blocked with `TenantMismatchError`.
- [x] **Cryptographic Instance Verification**: Backend verifies Wix signed instance tokens (`x-wix-instance`) using HMAC-SHA256 (`src/auth/wix-instance-validator.ts`).
- [x] **Algorithm Confusion Defense**: JWT service strictly enforces HMAC-SHA256 (`HS256`), rejecting `alg: none` and foreign algorithms.
- [x] **App Lifecycle Event Handlers**: Complete implementation of `POST /api/flexidash/webhooks/app-lifecycle` supporting `wix.app.installed`, `wix.app.removed`, and `wix.app.plan_changed` with idempotent reinstall handling and production signature enforcement.
- [x] **Server-Side Default-Deny Authorization**: All endpoints evaluate caller session permissions server-side. Modifying client DOM or layout JSON cannot bypass widget or page restrictions.
- [x] **Persistent Security Audit Trail**: Security-relevant events (authentication, role assignment, deletion, permissions failure) are recorded via `IAuditLogStorageAdapter` with automatic token/password sanitization.
- [x] **Zero-LocalStorage Invariant**: Authentication session tokens remain exclusively in in-memory closures (`SessionManager`), eliminating XSS token theft vectors.
- [x] **Production Storage Adapters**: Edge-native Cloudflare KV adapters implemented for Layouts, Roles, Audit Logs, and Tenant Configurations with dynamic fallback.
- [x] **Clean Production Build**: Compiles cleanly with `@wix/astro` and `@wix/astro-wix-hosting-adapter` (`wix build`) with zero typecheck or build errors.

### Category 2: Verified Against a Live Wix Site
- [ ] **Live Embedded Dashboard Rendering**: **NOT VERIFIED (Pending Live Wix Site Deployment)**. Requires deployment to a live site with the app installed from the Wix App Market / Dev Center test link.
- [ ] **Live Wix CRM Members Query**: **NOT VERIFIED (Pending Live Wix Site Deployment)**. Currently validated via contract mock tests and graceful local adapter fallback. Live calls to `@wix/members` require live OAuth site credentials.
- [ ] **Live Webhook Delivery from Wix Event Bus**: **NOT VERIFIED (Pending Live Wix Site Deployment)**. Endpoint contract and signature verification verified via automated test suite.

### Category 3: Requires Manual Developer-Account Configuration
- [ ] **Wix Developers Center Registration**: App owner account registered at [Wix Developers](https://dev.wix.com).
- [ ] **App ID Alignment**: Ensure `wix.config.json` `appId` (`fed82166-29ac-4cba-842a-fbedd2e1b0b1`) matches the registered app UUID in the Wix Dev Center.
- [ ] **OAuth & App Credentials**: Obtain official `App Secret` from the Dev Center settings; configure into production deployment environment.
- [ ] **Redirect & Webhook URLs**: Register production URLs in Dev Center:
  - Dashboard Page Extension: Natively hosted and managed via `src/extensions/dashboard/pages/my-page/my-page.extension.ts` (Extension ID: `24dcd8b4-4f1a-44ba-8cce-8124670bfd4c`). No external URL required.
  - Member Portal Site URL: `https://<YOUR_DEPLOYED_DOMAIN>/portal`
  - Lifecycle Webhook URL: `https://<YOUR_DEPLOYED_DOMAIN>/api/flexidash/webhooks/app-lifecycle`
- [ ] **Declared Permissions & Scopes Approval**:
  - `WIX_MEMBERS.READ` (Site member profiles & directory)
  - `WIX_CONTACTS.READ` (Site contacts & CRM tags)

### Category 4: Requires Legal/Business Decisions or Public Documents
- [ ] **Privacy Policy URL**: Host an official, legally reviewed Privacy Policy document detailing data storage, processing of member emails/names, and retention policies. *(Must not use placeholder URLs in submission)*.
- [ ] **Terms of Service URL**: Host standard Terms of Service governing app usage, availability SLA, and subscription terms. *(Must not use placeholder URLs in submission)*.
- [ ] **Pricing Plans Configuration**: Define Free and Paid tiers in the Wix Dev Center pricing tab:
  - Free Tier: Up to 5 custom roles, default layout, 30-day audit trail.
  - Pro Tier: Unlimited custom roles, personalized member layouts, 365-day audit trail, priority support.
- [ ] **Listing Assets & Media**:
  - App Icon (Square, 1:1, 512x512 PNG, no rounded corners).
  - Promotional Banner (1920x1080 PNG).
  - Minimum 3 Screenshots (1920x1080 PNG) showcasing Dashboard, Member Portal, and Audit Trail.

### Category 5: Requires Wix App Market Review or Approval
- [ ] **App Review Submission**: Submit app for formal security, UX, and compliance review in the Wix Developer Center.
- [ ] **Reviewer Feedback Remediation**: Address any specific UI, performance, or permission feedback requested by the Wix App Review Team.
- [ ] **Production Market Publication**: Final approval and listing in the official Wix App Market catalog. *(App is not yet published)*.

---

## 3. Testing Instructions for Wix QA Reviewers

When submitting to the Wix App Market, provide the following step-by-step instructions in the submission notes:

1. **Installation Test**:
   - Install the app onto a test Wix site via the test installation link.
   - Verify that the app lifecycle webhook fires `wix.app.installed` and provisions initial system roles (`role_site_owner`, `role_admin`, `role_member`, `role_visitor`) and default site layout.
2. **Dashboard Management Test**:
   - Navigate to **Site Dashboard &rarr; Apps &rarr; FlexiDash**.
   - Open the **Roles & Permissions (RBAC)** tab.
   - Click **➕ Create Custom Role**, enter "Content Editor", select permissions (`dashboard:view`, `portal:access`), and click **Save**. Verify role appears with `Custom` badge.
   - Open the **Member Roster** tab. Verify existing site members are listed. Click **Assign Role** to assign "Content Editor".
3. **Portal Canvas Test**:
   - Open the site portal page at `/portal`.
   - Log in as the test member. Verify that only permitted widgets are displayed.
   - Attempt to access `/portal/audit` directly in the browser address bar. Verify that access is denied with a `403 Forbidden` response.
4. **Uninstallation Test**:
   - Uninstall the app from the Wix dashboard.
   - Verify that tenant status is marked as `uninstalled` and no data corrupts other site tenants.

