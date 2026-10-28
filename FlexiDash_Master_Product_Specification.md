# FlexiDash Master Product Specification

## A Highly Flexible Member Experience, Authentication, Dashboard, and App Integration Platform for Wix

**Document status:** Master plan for Antigravity Plan Mode\
**Product:** FlexiDash\
**Delivery approach:** One approved phase at a time. Never implement the
entire roadmap in one pass.

------------------------------------------------------------------------

# 1. Product vision

FlexiDash is intended to be a multi-site, installable Wix app that gives
each Wix website owner a highly configurable member-facing application
experience. The ambition is closer to a visual application builder than
a simple dashboard template.

After installing FlexiDash, a site owner should be able to configure:

-   Custom signup, login, email verification, password recovery, and
    account screens.
-   Custom forms with configurable fields, validation, layout, labels,
    and styling.
-   Authentication options and external identity integrations where
    supported.
-   Role-based access control, custom roles, permissions, and approval
    flows.
-   Different dashboards and navigation for different roles.
-   Page, section, menu, widget, and action visibility rules.
-   Member profile and account experience.
-   Wix CRM contact synchronization and, where feasible, Wix Members
    identity/session integration.
-   Visual dashboard/page layouts, reusable components, themes,
    responsive behavior, preview, and publishing.
-   Connections to other Wix apps/services and embeddable third-party
    tools when their official integration surface permits it.
-   Independent configuration, identity mapping, roles, and data for
    every installed site.

The product should provide as much flexibility as the Wix app platform
allows, while accurately documenting any platform restrictions. It must
not promise arbitrary control of every Wix native page, native header,
third-party app UI, or authentication mechanism unless supported by
official APIs.

## Core product statement

**FlexiDash is a configurable member experience and application builder
for Wix: custom authentication experience, member management, role-based
access, dashboards, navigation, page rules, and integrations in one
installable app.**

------------------------------------------------------------------------

# 2. Non-negotiable architecture principles

1.  **One app, many independent Wix installations.** Every installed
    site has isolated settings, member-role assignments, layouts, and
    integration settings.
2.  **Authentication is not authorization.** Login proves identity; RBAC
    determines what the authenticated identity can do.
3.  **CRM Contacts are not the same entity as Wix Members.** Do not
    assume contact ID equals member ID. Keep explicit mappings and use
    supported APIs.
4.  **Never store plaintext passwords.** Do not build an unsafe password
    database.
5.  **JWT is not a complete authentication system.** If JWT is used for
    a FlexiDash-owned API, validate signature, issuer, audience, expiry,
    key rotation, revocation/session strategy, and secure storage. Do
    not treat a FlexiDash JWT as a Wix session token.
6.  **OAuth is for delegated access and supported identity flows.** Use
    the exact OAuth flow documented for the selected app type and
    integration. Do not invent token endpoints or scopes.
7.  **Wix-native page access is separate from FlexiDash page access.**
    FlexiDash can securely protect its own rendered experiences and
    backend data. Native Wix page restrictions require explicit
    compatibility/API proof.
8.  **Hiding a menu is not security.** Protected data and actions must
    be authorized on the backend.
9.  **Third-party app embedding is conditional.** A Wix app cannot
    automatically install and embed any other Wix app into its own
    pages. Integrate only via supported APIs, widgets, site plugins,
    documented iframe/embed interfaces, or approved links.
10. **No cross-site data access.** Never use a member, contact, role, or
    layout record from one installation in another.
11. **Feature feasibility is evidence-driven.** Each major capability
    needs official documentation, proof of concept, limitations, and
    acceptance tests.
12. **Phase gates are mandatory.** Complete, test, document, and review
    one phase before starting the next.

------------------------------------------------------------------------

# 3. Product personas and use cases

## 3.1 Site owner / app administrator

-   Installs FlexiDash.
-   Configures auth screens and member experience.
-   Defines roles, permissions, and page policies.
-   Builds dashboard layouts and navigation.
-   Connects supported Wix services and external identity providers.
-   Reviews members, role assignments, integration health, and audit
    events.

## 3.2 Site member

-   Signs up or logs in through the site's configured flow.
-   Verifies email or completes an approval flow where required.
-   Sees the dashboard and navigation permitted for their roles.
-   Edits allowed profile fields and accesses allowed pages/actions.

## 3.3 External identity provider user

-   Authenticates through an enabled OAuth/OIDC provider if the chosen
    implementation and Wix platform support the required flow.
-   Has a safely mapped identity in FlexiDash and, when required, a
    linked Wix member and/or CRM contact.
-   Is never granted permissions solely because an unverified email or
    client-supplied role claims a match.

## 3.4 Developer / implementation partner

-   Installs the app on development sites.
-   Tests installation-specific configuration and integration behavior.
-   Uses documented configuration and extension points without editing
    production secrets.

------------------------------------------------------------------------

# 4. Product feature map

## A. Authentication and identity experience

### Desired user-facing features

-   Custom login page builder.
-   Custom signup/registration form builder.
-   Forgot password and password recovery experience.
-   Email verification and one-time-code verification where supported.
-   Optional profile fields and consent checkboxes.
-   Configurable post-login and post-logout destinations.
-   Registration approval flow: automatic, manual, or role-specific
    where feasible.
-   Login/signup branding, layout, labels, helper text, and validation
    messages.
-   Social login/OAuth provider options only when supported and
    correctly configured.
-   Session expiry, logout, error handling, and abuse protection.
-   Optional SSO/external identity integration after feasibility
    validation.

### Identity implementation modes to investigate

**Mode 1: Wix-native member identity (preferred for native Wix
compatibility)** - Use supported Wix Members authentication APIs and
session behavior. - FlexiDash supplies custom UI where the extension
model allows it. - Use Wix Members as the source of authenticated
site-member identity. - Link to Wix CRM contact records using documented
relationships/APIs. - Explicitly test whether the chosen app/extension
can replace the native Members Area UI without requiring the Members
Area app.

**Mode 2: External/FlexiDash-managed identity** - Use a proven external
identity provider or secure authentication service, not a homemade
password implementation. - FlexiDash can issue its own app session/JWT
only for FlexiDash-owned services. - Synchronize or map the identity to
a Wix CRM contact using supported APIs and granted permissions. - If a
Wix-native member session is required, use a documented supported
SSO/session-creation path. Do not assume creating a CRM contact creates
a Wix Member or logs the user into Wix. - Clearly document which
Wix-native member-only APIs/pages are unavailable when no Wix member
session exists.

**Mode 3: Hybrid / SSO** - Use an external OAuth/OIDC identity provider
with a documented, secure mapping to a Wix member and CRM contact. -
Keep the Wix session and FlexiDash API session distinct. - Avoid token
forwarding to browser code or third parties. - Prove the complete flow
in a test site before selecting this mode for production.

**Decision gate:** Phase 0 must determine which modes are technically
supported for the app type and site extensions selected. Do not
implement every mode speculatively.

## B. Role-based access control (RBAC)

-   Built-in roles: Site Owner/Admin and Member, while keeping Wix
    collaborators distinct from site members.
-   Custom roles such as Student, Teacher, Customer, VIP, Client, Staff,
    or site-defined roles.
-   Multiple roles per member only if the policy model and UI support it
    clearly.
-   Role assignment, removal, bulk actions, and audit trail.
-   Permissions for pages, dashboard sections, widgets, navigation
    items, and backend actions.
-   Role inheritance only if explicitly designed and safely tested; do
    not add implicit inheritance by accident.
-   Default-deny behavior for protected operations.
-   Prevent self-promotion and unauthorized role assignment.
-   Explicit policy for role conflict and multiple roles.
-   Optional role assignment based on supported events, membership
    plans, or admin action after feasibility validation.

## C. Page and navigation control

-   Public, authenticated-member, role-restricted, and admin-only
    policies for FlexiDash-managed experiences.
-   Hide/show navigation based on login state and permissions.
-   Separate logged-out and logged-in menus.
-   Sidebar, top navigation, dropdowns, and mobile navigation.
-   Menu ordering, labels, icons, grouping, and destinations.
-   Page/section/widget/action visibility rules.
-   Unauthorized direct URL handling and server-side data/action checks.
-   Redirect, login prompt, or access-denied behavior.
-   Native Wix page restrictions and native header/menu replacement must
    be listed as separate feasibility items; do not claim universal
    control.

## D. Visual dashboard and page builder

-   Template gallery and blank canvas.
-   Reusable sections and widgets.
-   Drag-and-drop or reorderable components if supported by the selected
    builder implementation.
-   Responsive layout controls.
-   Theme, typography, spacing, colors, borders, and component settings.
-   Profile panel, quick actions, tables/lists, charts, text, links, and
    activity sections.
-   Role-specific layouts and visibility.
-   Preview mode, draft/published versions, and rollback if practical.
-   Schema validation for stored layouts; no arbitrary executable
    JavaScript or unsafe HTML.
-   Accessibility, keyboard navigation, and mobile behavior.
-   Real integrations must supply data; demo values must be visibly
    marked as demo content.

## E. Member profile and CRM

-   Resolve authenticated member identity.
-   Retrieve linked Wix CRM contact data only via documented APIs and
    granted scopes.
-   Define which fields are readable/editable.
-   Avoid duplicating sensitive data unnecessarily.
-   Handle missing, duplicate, deleted, or unlinked contacts.
-   Do not use CRM labels as the sole authorization mechanism.
-   Keep Wix Member ID, Contact ID, FlexiDash user ID, and external
    provider subject ID distinct.

## F. Integrations and embedded applications

-   Wix API integrations where documented and permitted.
-   Wix Stores, Bookings, Pricing Plans, Events, CMS, or other services
    only after individual feasibility checks.
-   Allow site owners to configure supported links, widgets, or
    integration blocks.
-   Third-party Wix app embedding only if that app exposes a supported
    widget, site plugin, iframe/embed interface, API, or documented
    integration.
-   Never promise that arbitrary installed Wix apps can be nested inside
    a FlexiDash page.
-   Securely store provider credentials server-side and use minimum
    permissions.
-   Include connection status, error handling, reconnect, and revoke
    flows.

## G. Multi-site and operations

-   Independent site configuration and role mapping.
-   Installation lifecycle: install, permissions, setup, permission
    revocation, uninstall, reinstall.
-   Versioned settings and migration.
-   Rate limits, retries, idempotent webhooks/events where used.
-   Audit events for security-sensitive operations.
-   Data retention, export/deletion policy, privacy policy, terms, and
    support documentation.

------------------------------------------------------------------------

# 5. Technical architecture proposal

This is a proposal, not a final framework decision. Phase 0 must
validate it against the actual repository and current Wix docs.

## 5.1 Likely app components

1.  **Wix app integration layer**
    -   Wix app definition, install lifecycle, extension configuration,
        permissions/scopes, and distribution.
2.  **Owner control panel**
    -   React-based UI for auth settings, role management, navigation,
        dashboard layout, integrations, and publishing.
3.  **Site-facing member experience**
    -   Supported Wix site page/widget/custom element/extension that
        renders the configured portal.
4.  **FlexiDash backend**
    -   Authorization, configuration APIs, role policy evaluation,
        integration adapters, identity mapping, and audit events.
5.  **Persistence**
    -   Wix-supported app storage/data collections or external database
        selected after tenant and operational requirements are reviewed.
6.  **Identity integration**
    -   Wix Members APIs and/or external OIDC provider, selected by the
        feasibility decision.
7.  **Integration adapters**
    -   Separate modules per Wix API/third-party provider.
8.  **Observability**
    -   Safe logs, health status, request correlation, and redacted
        error reporting.

## 5.2 React/Next.js flexibility

A React/Next.js application can be appropriate for an externally hosted
control panel or backend/frontend service where the selected Wix app
framework supports an iframe/external URL or other supported
integration. It does not mean arbitrary Next.js routes automatically
become native Wix pages or gain access to Wix sessions.

The app should use a shared design system and typed API contracts. Keep
Wix-specific logic behind adapters so the visual builder and policy
engine remain maintainable.

## 5.3 Data model candidates

Final schema depends on the storage decision and Wix APIs.

-   `Installation`
-   `SiteConfiguration`
-   `IdentityMapping`
-   `Role`
-   `Permission`
-   `MemberRoleAssignment`
-   `AuthFormDefinition`
-   `AuthProviderConnection`
-   `PageAccessRule`
-   `NavigationDefinition`
-   `DashboardLayout`
-   `PublishedLayoutVersion`
-   `IntegrationConnection`
-   `AuditEvent`

Every site-owned record must be scoped to a trusted installation/site
context resolved on the server. Never trust a tenant ID or role supplied
only by the browser.

------------------------------------------------------------------------

# 6. Phase-by-phase implementation plan

## Phase 0 --- Product and technical feasibility audit

**Goal:** Convert the vision into an evidence-backed architecture before
writing application code.

Tasks: - Inspect the repository, Git status, framework, package manager,
current implementation, and secrets handling. - Review current official
Wix documentation for app framework, extension types, identity, Members,
CRM Contacts, OAuth, permissions, site page extensions, widgets, custom
elements, app distribution, and App Market guidelines. - Build a
capability matrix for every core feature: - Supported directly -
Supported with a custom site component - Supported through an external
service - Requires a third-party provider - Unsupported/uncertain -
Prove or identify blockers for: - Custom signup/login UI - Wix member
creation and session - Custom JWT sessions and Wix-native member
sessions - OAuth/OIDC provider support - Wix CRM contact creation/lookup
and member-contact mapping - Replacing the native Members Area - Native
page restriction and native navbar control - Dashboard and site-facing
extensions - Embedding other Wix apps/widgets - App Market requirements
for external hosting and authentication - Decide whether the first
release uses Wix-native identity, external identity, or a carefully
bounded hybrid. - Document risks and alternatives.

Deliverables: - `docs/PRODUCT-SPEC.md` - `docs/FEASIBILITY-MATRIX.md` -
`docs/ARCHITECTURE.md` - `docs/DECISIONS.md` -
`docs/SECURITY-THREATS.md`

Acceptance criteria: - Each core capability has an official source or is
explicitly marked unverified. - Identity strategy is chosen based on
evidence, not assumption. - No broad implementation begins before the
architecture review.

## Phase 1 --- Minimal app scaffold and integration proof

Goal: Prove the chosen Wix app can install and render the needed
owner/site experiences.

Tasks: - Create or connect the Wix app in the developer workspace. -
Choose the supported app framework and extension types. - Create the
minimal owner dashboard extension. - Create the minimal site-facing
page/widget/component needed to prove member portal rendering. - Set up
local development, lint, typecheck, tests, environment validation, and
deployment workflow. - Use no real credentials in source control.

Acceptance criteria: - App installs on a development site. - Owner panel
opens. - Site-facing proof of concept renders. - Framework/editor
compatibility is documented.

## Phase 2 --- Multi-site installation context and secure backend

Goal: Prevent cross-site data access before member features are added.

Tasks: - Implement trusted installation/site context. - Create
tenant-scoped repository/data access helpers. - Configure
least-privilege permissions. - Fail closed when context is missing or
invalid. - Define install, permission revoke, uninstall, and reinstall
handling. - Test cross-tenant access.

Acceptance criteria: - Site A cannot read/write Site B records. -
Browser-supplied tenant IDs cannot override trusted context. - No
secrets are exposed to client code.

## Phase 3 --- Identity, authentication, and CRM proof of concept

Goal: Prove the exact identity model.

Tasks: - Implement the Phase 0-selected authentication mode only. -
Build one custom login form and one custom signup form. - Validate
email/password or selected provider flow using documented APIs. - Add
verification/recovery/approval behavior supported by the selected
identity model. - Create or resolve the Wix CRM contact through
documented APIs. - Map FlexiDash identity, Wix Member ID, Contact ID,
and external provider subject separately. - Test logout, expiry, invalid
credentials, duplicate emails, deleted members, and missing contact
records. - Do not build a full form builder yet.

Acceptance criteria: - End-to-end signup/login works on a published test
site. - Member identity and CRM contact mapping is verified. -
Wix-native session behavior is documented accurately. - Tokens and
secrets are never exposed or logged.

## Phase 4 --- Secure RBAC engine

Goal: Deliver backend permission logic before building all management
UI.

Tasks: - Define built-in roles, custom roles, permissions, and policy
evaluation. - Implement assign/revoke role operations. - Protect role
management with site-owner/admin authorization. - Add default-deny
backend checks. - Prevent self-escalation and cross-site role
assignments. - Add audit events and tests.

Acceptance criteria: - Unauthorized requests fail closed. - Role
permissions cannot be bypassed by changing frontend state. -
Cross-tenant and privilege-escalation tests pass.

## Phase 5 --- Authentication form builder and auth experience

Goal: Let owners customize login/signup UI while keeping the
authentication engine secure.

Tasks: - Create a schema-based form builder. - Support field
add/remove/reorder, labels, placeholders, required/optional, supported
validation, styling, and responsive preview. - Add configurable
login/signup/forgot-password pages. - Add supported email verification,
approval, and redirect options. - Add OAuth providers only if the chosen
identity architecture supports them securely. - Sanitize inputs and
validate the form schema server-side. - Do not allow arbitrary
executable JavaScript or unsafe HTML in form definitions.

Acceptance criteria: - Owner can configure forms without code. - Invalid
schemas and malicious inputs are rejected. - Authentication logic cannot
be changed by frontend form configuration. - All flows pass
published-site tests.

## Phase 6 --- Page rules and navigation engine

Goal: Implement login-aware and role-aware page/navigation behavior.

Tasks: - Define public, authenticated, role-specific, and admin-only
rules for FlexiDash-managed experiences. - Build configurable menus and
responsive navigation. - Add visibility conditions for
sections/widgets/actions. - Enforce backend access for protected
data/actions. - Test direct URLs and refresh behavior. - Document
limitations for native Wix pages and native header/navbar.

Acceptance criteria: - Unauthorized users cannot access protected
FlexiDash data/actions. - Menu visibility matches the policy
configuration. - Native Wix limitations are clearly documented.

## Phase 7 --- Dashboard builder MVP

Goal: Let site owners build different dashboards per role.

Tasks: - Create 3--5 initial templates. - Implement a schema-driven
component library. - Add reorderable sections/widgets, supported
settings, role-based layouts, themes, and responsive behavior. - Add
draft/preview/publish flow. - Add layout versioning or rollback if
appropriate. - Include loading, empty, error, and access-denied states.

Acceptance criteria: - Owner can create a role-specific layout and
preview it. - Published settings are separate from drafts. - Layout
validation and accessibility tests pass.

## Phase 8 --- Member portal and account experience

Goal: Render the published member experience.

Tasks: - Build the member portal shell. - Render correct layout based on
trusted identity and backend-evaluated roles. - Add supported
profile/account actions. - Add loading, expired session, error, and
logout states. - Test mobile and desktop behavior. - Test Wix-native
member-only APIs against the chosen identity mode.

Acceptance criteria: - Members see the right dashboard and authorized
content. - Logged-out visitors cannot access private data. - Session
behavior is correct and documented.

## Phase 9 --- Wix and third-party integrations

Goal: Add integrations only where official APIs or documented embed
surfaces exist.

Tasks: - Prioritize integrations based on demand and API feasibility. -
Add one integration adapter at a time. - Use minimum scopes and
server-side credentials. - Support connect, health status, error state,
reconnect, and revoke. - Investigate other Wix apps' official
widgets/plugins/embeds; do not assume arbitrary apps can be embedded. -
Test data ownership and authorization for every integration.

Acceptance criteria: - Each integration has documented permissions and
limits. - Failed/revoked connections fail safely. - No cross-site data
leaks.

## Phase 10 --- Security, reliability, accessibility, and scale

Tasks: - Test tenant isolation, auth bypass, role escalation, direct URL
access, and token handling. - Test OAuth callback validation,
state/nonce/PKCE as appropriate to the selected flow, token storage,
expiry, refresh, revocation, and logout. - Rate-limit sensitive
endpoints and add abuse protection. - Add safe observability and redact
secrets/PII. - Review dependency vulnerabilities. - Test accessibility,
responsive layouts, browser support, and API failure modes. - Test at
least two independent Wix sites. - Define backup, migration, retention,
deletion, and support processes.

Acceptance criteria: - No known critical/high-severity security
issues. - Core flows pass on supported environments. - Recovery and
failure behavior is documented.

## Phase 11 --- App Market submission and launch

Tasks: - Re-check current App Market guidelines. - Prepare listing,
screenshots, demo, onboarding, support, privacy policy, terms, and data
handling disclosures. - Verify permission scopes and explain why each is
needed. - Test clean installation and uninstall/reinstall. - Submit for
review and address feedback. - Do not claim approval before Wix confirms
it.

Acceptance criteria: - Listing claims match actual functionality. -
Legal/support/onboarding requirements are met. - Submission package and
review outcomes are tracked.

------------------------------------------------------------------------

# 7. Required security and behavior tests

1.  A site cannot access another site's configuration, members, role
    assignments, or layouts.
2.  A logged-out visitor cannot access protected data.
3.  A user cannot grant themselves admin permissions.
4.  Changing a frontend role value does not change backend
    authorization.
5.  A hidden navigation item does not expose its protected API.
6.  Direct URL access is checked.
7.  Invalid, expired, or revoked tokens are rejected.
8.  FlexiDash JWTs are never accepted as Wix session tokens.
9.  Wix Member ID, CRM Contact ID, FlexiDash identity ID, and external
    subject ID are not conflated.
10. A CRM contact alone does not imply authenticated member status.
11. Duplicate or missing contact mappings are handled safely.
12. OAuth callback/state validation follows the selected provider's
    security requirements.
13. Tokens, passwords, secrets, and sensitive contact data are not
    logged.
14. App uninstall/reinstall does not mix tenant data.
15. Third-party integration failure does not expose secrets or bypass
    authorization.
16. Invalid dashboard/form schemas cannot execute arbitrary code.
17. Role changes and permission changes are audited.
18. Password reset and email verification flows resist abuse and
    enumeration where applicable.

------------------------------------------------------------------------

# 8. Antigravity Plan Mode instructions

Paste this entire document into Antigravity Plan Mode.

## Before implementation

1.  Inspect the existing repository and Git status.
2.  Read current official Wix documentation for every proposed API,
    extension, auth flow, and scope.
3.  Produce a concise Phase 0 plan and list assumptions.
4.  Do not implement Phase 1 or later until Phase 0 is reviewed and
    approved.
5.  Do not assume a Wix-native member session can be created from a CRM
    contact.
6.  Do not assume JWT/OAuth automatically integrates with Wix Members.
7.  Do not assume arbitrary Wix apps can be embedded inside FlexiDash.
8.  Ask for approval before irreversible repository changes or major
    framework changes.

## During each phase

-   Implement only the currently approved phase.
-   List expected file changes before editing.
-   Use TypeScript and schema validation where appropriate.
-   Keep Wix-specific APIs behind adapters.
-   Run lint, typecheck, build, unit tests, and relevant
    integration/security tests.
-   Update documentation and the phase checklist.
-   Report actual evidence and known limitations.
-   Stop and wait for explicit approval before starting the next phase.

## Never

-   Implement all phases in one pass.
-   Store plaintext passwords or expose secrets.
-   Trust frontend role or tenant identifiers.
-   Treat CRM contact labels as authorization.
-   Claim native Members Area replacement without a proven supported
    path.
-   Claim arbitrary native navbar/page control or arbitrary Wix app
    embedding without proof.
-   Add fake production integrations or metrics without labeling them as
    demo data.
-   Make broad dependency upgrades or destructive changes without a
    clear reason and approval.
-   Claim App Market readiness or approval prematurely.

## Required phase report

``` text
Phase:
Status:
Files changed:
Official Wix documentation reviewed:
Commands run:
Tests and results:
Security checks:
Verified capabilities:
Known platform limitations:
Unresolved decisions:
Acceptance criteria met:
Ready for approval to proceed:
```

------------------------------------------------------------------------

# 9. Official documentation starting points

Use current documentation as the source of truth. Re-check API
availability, deprecations, scopes, and editor compatibility during
Phase 0.

-   Wix app authentication:
    https://dev.wix.com/docs/build-apps/develop-your-app/auth/about-authentication
-   Authentication methods:
    https://dev.wix.com/docs/overview/auth-permissions/authentication-methods
-   Create a self-managed Wix app:
    https://dev.wix.com/docs/build-apps/get-started/quick-start/create-a-self-managed-app
-   Wix site extensions:
    https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/about-site-extensions
-   Wix Members authentication (Velo):
    https://dev.wix.com/docs/velo/apis/wix-members-backend/authentication/login
-   Custom site registration:
    https://dev.wix.com/docs/develop-websites/articles/code-tutorials/wix-members/enabling-custom-site-registration
-   Wix identities:
    https://dev.wix.com/docs/overview/auth-permissions/identities
-   Wix permissions:
    https://dev.wix.com/docs/overview/auth-permissions/permissions
-   App Market guidelines:
    https://developers.wixanswers.com/kb/en/article/app-market-guidelines

------------------------------------------------------------------------

# 10. Definition of success

FlexiDash succeeds when a site owner can install it on a Wix site,
configure the supported identity/authentication experience, customize
signup/login forms, define roles and permissions, build distinct
dashboards, control navigation and access for FlexiDash-managed pages,
and connect supported Wix services---while every site remains isolated
and backend authorization is enforced.

The ambition is broad flexibility, but the delivery order must be
evidence-led: 1. Prove Wix extension and identity feasibility. 2. Prove
multi-site isolation and backend security. 3. Prove one complete
login/signup-to-member-dashboard flow. 4. Build configurable auth forms
and RBAC. 5. Build navigation, page rules, and the visual builder. 6.
Add integrations and App Market readiness.

**Start with Phase 0 only. Do not implement later phases until the user
approves the Phase 0 findings.**
