# FlexiDash Architecture Decision Records (ADRs)

**Document Version:** 1.0.0-phase0  
**Status:** Approved Phase 0 Baseline  
**Scope:** Architectural Commitments, Evaluated Trade-offs, Evidence & Phase 1 Spikes  
**Related Documents:** [PRODUCT-SPEC.md](./PRODUCT-SPEC.md), [FEASIBILITY-MATRIX.md](./FEASIBILITY-MATRIX.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY-THREATS.md](./SECURITY-THREATS.md)

---

## Index of Architectural Decisions

- [ADR-001: App Hosting & Integration Architecture](#adr-001-app-hosting--integration-architecture)
- [ADR-002: Member Identity & Session Management Strategy](#adr-002-member-identity--session-management-strategy)
- [ADR-003: Multi-Tenant Context Resolution & Data Isolation](#adr-003-multi-tenant-context-resolution--data-isolation)
- [ADR-004: Live-Site UI Delivery & Portal Surface](#adr-004-live-site-ui-delivery--portal-surface)
- [ADR-005: Scope of Page & Navigation Access Control](#adr-005-scope-of-page--navigation-access-control)
- [ADR-006: Persistence & Configuration Data Storage Strategy](#adr-006-persistence--configuration-data-storage-strategy)
- [Consolidated Phase 1 Proof-of-Concept Spike Plan](#consolidated-phase-1-proof-of-concept-spike-plan)

---

## ADR-001: App Hosting & Integration Architecture

### Status
**Accepted for PoC Only (Pending Phase 1 Validation)**

### Context
FlexiDash requires an administrative dashboard in the Wix Business Manager for site owners and an interactive portal on the live site for members. Two high-level hosting and packaging options exist:
1. **Managed Wix CLI Application:** Built using `@wix/astro`, `@wix/cli`, `@wix/dashboard`, and deployed natively on Wix Cloud infrastructure.
2. **Self-Managed OAuth Application:** Built using an external web framework (e.g., Next.js on Vercel or Node/Express on AWS) communicating via the Wix REST API and embedded inside Wix via iframes.

### Decision
Adopt a **Hybrid Architecture (for PoC Only)**:
- Utilize the **Wix CLI Managed Application** model (the existing project structure in `flexidash/`) as the initial distribution shell for the Wix Admin Dashboard Page extension and the live-site Custom Element site widgets during Phase 1 prototyping.
- Implement all backend business logic (RBAC evaluator, schema validators, layout engine) behind **decoupled adapter interfaces** that compile to standard TypeScript/JavaScript modules.
- **PoC Pivot Criteria:** If Phase 1 testing reveals that Wix CLI extensions cannot establish the native member session handshake, or if Wix Cloudflare Workers bundle/execution limits prevent complex backend operations, the project will immediately pivot to a Self-Managed OAuth Application before Phase 2 implementation.

### Consequences
- **Positive:**
  - Zero external infrastructure costs and zero operational server maintenance during early prototyping.
  - Native rendering of Dashboard Pages using `@wix/design-system` without iframe latency or sandbox friction.
  - Host Auth automatically manages administrative identity within the Wix Dashboard.
- **Negative:**
  - Wix Cloud (Cloudflare Workers runtime via `@wix/astro`) imposes strict bundle size limits and execution timeouts.
  - Inability to establish direct persistent TCP socket connections to private relational databases without HTTP proxying.
  - Live-site Custom Element capability to mutate parent site session remains unverified.

### Evidence & Documentation
- [Wix CLI Overview](https://dev.wix.com/docs/build-apps/develop-your-app/frameworks/wix-cli/about-the-wix-cli)
- [Dashboard Page Extensions](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/dashboard-extensions/dashboard-pages/about-dashboard-page-extensions)
- [Custom Element Site Widgets](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/site-widgets/create-a-site-widget-extension-custom-element)

### Confidence Level
**Medium-High (70% for PoC)** — Untested on live site for full member session lifecycle.

### Alternatives Considered & Rejected
- *Pure Self-Managed App from Day 1:* Deferred to Phase 1 evaluation. Starting with the CLI managed scaffold allows rapid testing of native dashboard extensions while keeping backend adapters portable.

### Unresolved Questions for Phase 1 PoC
- Validate maximum bundle size and cold-start latency of `@wix/astro` serverless endpoints on Wix Cloudflare workers.
- Verify whether Wix CLI supports environment variable secrets injection across multi-stage preview environments without local `.env` leaks.
- Test whether a Wix CLI Custom Element site widget can interact with the host site's session cookies.

---

## ADR-002: Member Identity & Session Management Strategy

### Status
**Proposed (Untested Architecture / PoC Mandatory)**

### Context
The Master Specification outlines three identity implementation modes:
- **Mode 1 (Wix-Native Member Identity):** Member accounts live in Wix Members; login establishes native Wix session.
- **Mode 2 (FlexiDash-Managed Identity):** FlexiDash issues internal JWTs; decoupled from Wix Members.
- **Mode 3 (Federated SSO / Hybrid):** External OIDC provider mapped to Wix Member and FlexiDash identity.

Crucially, official documentation for `wix-members-backend.authentication.generateSessionToken(email)` and `@wix/site.authentication.applySessionToken()` is written for **Velo site code**. Whether these APIs can be invoked seamlessly across the boundary of an installable Wix CLI App (from an Astro serverless endpoint and a Custom Element Web Component) has not been demonstrated and remains unverified.

### Decision
Adopt a **Two-Tier Identity Model (Subject to Phase 1 Spike)**:
1. **Tier 1 (Site-Level Session):** Investigate **Mode 1 (Wix-Native Identity)** as the primary target for member authentication. When a user authenticates, the backend obtains a Wix `sessionToken` via documented Members APIs, and the frontend client applies this token via `applySessionToken()` to establish native browser session cookies.
2. **Tier 2 (FlexiDash API Authorization):** Concurrently, the backend issues an ephemeral, scoped **FlexiDash JWT** used exclusively as a Bearer token to authorize queries and mutations against FlexiDash backend APIs.
3. **Explicit Identity Distinctions:**
   - A `wixContactId` will NEVER be accepted as proof of membership or authentication.
   - A FlexiDash JWT will NEVER be expected to authenticate native Wix pages.
4. **Strict Security Rule for `generateSessionToken(email)`:**
   - Official documentation confirms that `generateSessionToken(email)` returns an active session for existing members without password challenge, and *automatically registers a new member with a random password* if the email is not found.
   - Under no circumstances may `generateSessionToken(email)` be invoked based solely on user-supplied email input. It may strictly be invoked **AFTER** an authoritative, verified authentication event (e.g. password verification or cryptographically validated OIDC token).

### Consequences
- **Positive:**
  - Full compatibility with native Wix services if successful.
  - Eliminates the security risk and liability of FlexiDash storing plaintext or hashed passwords.
- **Negative:**
  - High architectural risk: if `applySessionToken()` fails inside a Custom Element, a Velo site script bridge or Headless OAuth redirect flow will be required.
  - Risk of account takeover or junk account creation if `generateSessionToken()` is invoked without prior authentication.

### Evidence & Documentation
- [Wix Members Login API](https://dev.wix.com/docs/velo/apis/wix-members-backend/authentication/login)
- [Wix Generate Session Token API](https://dev.wix.com/docs/velo/apis/wix-members-backend/authentication/generate-session-token)
- [Wix Custom Site Registration](https://dev.wix.com/docs/develop-websites/articles/code-tutorials/wix-members/enabling-custom-site-registration)
- [Wix Identities Documentation](https://dev.wix.com/docs/overview/auth-permissions/identities)

### Confidence Level
**Medium (55% - High Platform Risk)** — The API handshake across CLI app extension boundaries is unverified.

### Alternatives Considered & Rejected
- *Pure FlexiDash-Managed Passwords (Mode 2 only):* Rejected. Storing user passwords in an app database violates Non-Negotiable Principle #4 and prevents the user from being logged into native Wix services.
- *Blindly calling `generateSessionToken(email)` on user input:* Rejected as an unacceptable critical vulnerability (account takeover and account spam).

### Unresolved Questions for Phase 1 PoC
- Can `generateSessionToken()` be invoked directly from a Wix CLI Astro serverless endpoint with app-instance credentials, or does it require an elevated Velo backend function on the site?
- Can a `CUSTOM_ELEMENT` Web Component invoke `@wix/site.authentication.applySessionToken()` to establish parent window cookies?
- What exact error responses does `generateSessionToken()` return when rate limits or invalid emails are encountered?

---

## ADR-003: Multi-Tenant Context Resolution & Data Isolation

### Status
**Accepted**

### Context
FlexiDash is a multi-site application installed across hundreds of independent Wix websites. A catastrophic multi-tenant vulnerability occurs if Site A can read or write Site B's configuration, member lists, or role assignments.

### Decision
Implement a **Cryptographic Fail-Closed Tenant Context Resolver**:
1. Every incoming HTTP request must include either:
   - The signed `instance` query parameter / header supplied by the Wix platform, OR
   - A valid `flexidashJwt` issued by FlexiDash containing a signed `inst` claim.
2. The backend cryptographically validates the token signature using the app's secret key (`WIX_CLIENT_SECRET`). Requests with missing, expired, or invalid signatures are immediately terminated with HTTP 401 Unauthorized.
3. The verified `instanceId` is injected into the execution context.
4. All repository queries must enforce `WHERE instanceId = context.instanceId`.
5. Any request containing a client-supplied `instanceId`, `siteId`, or `tenantId` in the JSON body or route parameter that conflicts with the cryptographically verified context is treated as a malicious tampering attempt and dropped.

### Consequences
- **Positive:**
  - Absolute mathematical isolation between tenants.
  - Zero possibility of cross-site privilege escalation or horizontal data leakage.
- **Negative:**
  - Every API endpoint requires cryptographic validation middleware execution.

### Evidence & Documentation
- [Wix App Instance Authentication](https://dev.wix.com/docs/build-apps/develop-your-app/auth/about-authentication)
- Master Product Specification Non-Negotiable Principles #1 and #10.

### Confidence Level
**Very High** (95%)

### Alternatives Considered & Rejected
- *Trusting Browser-Supplied Tenant Headers:* Rejected. Trivial to spoof via curl or developer tools.

### Unresolved Questions for Phase 1 PoC
- Verify whether the signed `instance` parameter format remains standard JWT or legacy HMAC-SHA256 across all modern Wix CLI extension targets.

---

## ADR-004: Live-Site UI Delivery & Portal Surface

### Status
**Proposed (Pending Phase 1 Spike)**

### Context
FlexiDash must render custom signup/login forms and role-specific member dashboards on live Wix sites. The Wix platform provides three extension mechanisms for live sites:
1. **`CUSTOM_ELEMENT` (Site Widget):** Standard web component packaged into the app, insertable via Wix Editor or Studio.
2. **`SITE_PAGE` Extension:** A full dedicated page added to the site navigation upon app installation.
3. **`EMBEDD_SCRIPT`:** Script injected into the HTML `<head>` or `<body>`.

### Decision
Deliver the live-site member portal via a combination of **Site Page Extension** and **Custom Element Site Widgets**:
1. Configure an official **Site Page Extension** in the Wix App Dashboard representing the primary Member Portal route (e.g., `/portal`).
2. Implement the UI components as **Custom Element Site Widgets** (`CUSTOM_ELEMENT`) using React packaged via `@wix/astro`.
3. Provide standalone embeddable widgets (e.g., "Login Widget", "Quick Profile Widget") that site owners can optionally place on arbitrary pages.
4. Explicitly reject using `EMBEDD_SCRIPT` to perform DOM injection or URL hijacking.

### Consequences
- **Positive:**
  - Clean integration into the Wix Editor; site owners can position and configure the widget settings panel natively.
  - Compliant with Wix App Market guidelines (no malicious script injection).
- **Negative:**
  - Custom Elements operate within shadow DOM or sandboxed element boundaries; CSS styling from the parent Wix theme does not automatically cascade unless explicitly bridged.

### Evidence & Documentation
- [Create a Site Widget Extension (Custom Element)](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/site-widgets/create-a-site-widget-extension-custom-element)
- [Wix Site Page Extensions](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/about-site-extensions)

### Confidence Level
**High** (80%)

### Alternatives Considered & Rejected
- *Global Script Injection (`EMBEDD_SCRIPT`):* Rejected. Violates security principles, risks breaking site layouts, and fails App Market review.

### Unresolved Questions for Phase 1 PoC
- Test Shadow DOM isolation vs Light DOM rendering for `@wix/design-system` inside Custom Element extensions on live published sites.

---

## ADR-005: Scope of Page & Navigation Access Control

### Status
**Accepted**

### Context
The Master Specification requires role-based access control for pages and navigation. There is an inherent risk of promising universal protection over native Wix pages (e.g., `/shop`, `/blog`, `/home`), which are rendered outside the app's execution environment.

### Decision
Establish a **Bounded Security Perimeter**:
1. **FlexiDash Authoritative Boundary:** FlexiDash strictly and authoritatively controls:
   - Navigation links, menus, sidebars, and tab bars rendered *within* the FlexiDash portal UI.
   - Dynamic routes and view transitions *within* the FlexiDash Site Page Extension (`/portal/*`).
   - All backend APIs, dashboard widgets, and stored member data.
2. **Native Wix Boundary:** FlexiDash will NOT claim or attempt to protect native Wix pages outside the portal.
3. **Site Owner Guidance:** Site owners who wish to restrict native Wix pages will be directed to native Wix Editor Page Permissions (Password / Members Only) or instructed to place content exclusively within FlexiDash-managed views.

### Consequences
- **Positive:**
  - Prevents fraudulent security claims; eliminates vulnerabilities where users bypass client-side DOM hiding.
  - Fully compliant with Wix platform architecture.
- **Negative:**
  - Site owners cannot manage both native Wix pages and FlexiDash pages from a single unified access matrix without configuring native Wix settings.

### Evidence & Documentation
- [Wix Routers API](https://dev.wix.com/docs/velo/apis/wix-router/routers)
- Master Specification Non-Negotiable Principle #7 & #8.

### Confidence Level
**Very High** (95%)

### Alternatives Considered & Rejected
- *Client-Side DOM Hiding of Native Pages via Injected Script:* Rejected. Client-side hiding is not security; protected content can be viewed via curl, View Source, or disabling JavaScript.

### Unresolved Questions for Phase 1 PoC
- None. The architectural boundary is definitive.

---

## ADR-006: Persistence & Configuration Data Storage Strategy

### Status
**Proposed (Pending Phase 1/2 Spike)**

### Context
FlexiDash must store tenant configuration, role definitions, permission mappings, form definitions, and dashboard layout schemas across hundreds of sites.

### Decision
1. Define strict **Abstract Repository Interfaces** (`IInstallationRepository`, `IRoleRepository`, `ILayoutRepository`, `IAuditRepository`) in TypeScript, mandating `instanceId` as the first argument in every method.
2. During Phase 1 and early Phase 2, evaluate **Wix Data Collections** (`DATA_COLLECTION` extension in Wix CLI) for native storage.
3. If Wix Data Collections exhibit limitations regarding relational querying, indexing, or transaction isolation, pivot the repository implementation to an **External Managed PostgreSQL Database** (e.g., Neon or Supabase) connected via HTTPS/REST.

### Consequences
- **Positive:**
  - Application logic is completely decoupled from the physical database technology.
  - Native Wix Data Collections require zero external infrastructure if viable.
- **Negative:**
  - Wix Data Collections have specific query throughput rate limits and query constraints.

### Evidence & Documentation
- [Wix Data Collections Extensions](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/backend-extensions/data-collections/about-data-collections)

### Confidence Level
**Medium** (65%)

### Alternatives Considered & Rejected
- *Hardcoding to a specific external database vendor in Phase 0:* Rejected. Premature infrastructure commitment before testing native storage capabilities.

### Unresolved Questions for Phase 1 PoC
- Benchmark Wix Data Collection query performance for hierarchical layout JSON trees.

---

## Consolidated Phase 1 Proof-of-Concept Spike Plan

The following specific spike tests are required during Phase 1 to validate unresolved assumptions before production coding begins in Phase 2:

| Spike ID | Objective | Test Procedure | Pass / Fail Criteria |
| :---: | :--- | :--- | :--- |
| **SPK-01** | Verify Wix CLI Astro Scaffold | Deploy default `flexidash` scaffold to a live Wix dev site. Open Dashboard extension in Business Manager. | Dashboard page loads without runtime errors; Host Auth context received and verified. |
| **SPK-02** | Verify Custom Element Site Widget | Run `wix generate --type CUSTOM_ELEMENT`; add widget to dev site page; publish site. | Custom element renders web component HTML and handles user events on published site. |
| **SPK-03** | Verify `generateSessionToken` in App Context | Invoke Members authentication API from an Astro serverless endpoint using app credentials. Test with existing member email AND unverified email. | Valid session token returned for existing member; verify whether non-existent email triggers phantom member creation; fails if permissions are insufficient. |
| **SPK-04** | Verify `applySessionToken` in Custom Element | Retrieve session token; attempt to invoke `@wix/site.authentication.applySessionToken()` from inside Custom Element Shadow DOM on published site. | Browser sets `wixSession` cookies and host site updates auth state; fails if Shadow DOM blocks top-level cookie setting. |
| **SPK-05** | Verify Instance Signature Verification | Send mock request with signed `instance` parameter; verify signature via App Secret. | Correctly parses `instanceId` on valid signatures; rejects tampered payloads (HTTP 401). |
| **SPK-06** | Fallback Architecture Evaluation | If SPK-03 or SPK-04 fails in CLI context, test companion site Velo web method bridge or Self-Managed OAuth App redirect flow. | Proven fallback path to establish member session before proceeding to Phase 2. |

### Phase 1 Spike Execution Results & Evidence

| Spike ID | Scope / Focus | Spike Classification | Evidence & Observed Findings |
| :---: | :--- | :---: | :--- |
| **SPK-01** | Wix CLI Scaffold & Dashboard Page | **BLOCKED (Live) / PARTIAL FAIL (Local)** | • **Local Typecheck:** `PASS` (`astro check` 0 errors with `@wix/design-system` declaration).<br>• **Local Client Build:** `FAIL` (`wix build` failed due to missing `useOverlayScrollbar` in corrupted `@wix/design-system` package).<br>• **Live Dev Site Deployment:** `BLOCKED` (CLI requires interactive browser login; `wix whoami` returns `LoginRequired`). |
| **SPK-02** | Custom Element Site Widget Extension | **BLOCKED** | • `wix generate` and `wix schema generate` terminate with `AuthenticationRequired: AuthenticationRequired`.<br>• Generating extension schemas and deploying to live test site requires active Wix developer credentials (`wix login`). |
| **SPK-03** | `generateSessionToken` in App Context | **BLOCKED (Live) / ARCHITECTURALLY DISCONNECTED** | • **Live Execution:** `BLOCKED` on CLI deployment credentials.<br>• **Platform Finding:** `wix-members-backend` is a site Velo package. Calling it from an Astro serverless endpoint with app credentials requires elevated Velo site exports or OAuth delegation; not supported out-of-the-box in standalone app extensions. |
| **SPK-04** | `applySessionToken` in Custom Element | **BLOCKED (Live) / ARCHITECTURALLY UNPROVEN** | • **Live Execution:** `BLOCKED` on CLI deployment credentials.<br>• **Platform Finding:** `@wix/site.authentication.applySessionToken()` is designed for site Velo page code. Invoking it inside an encapsulated Web Component Shadow DOM to mutate parent window session cookies without site Velo glue code remains unproven. |
| **SPK-05** | Instance Signature Verification | **PASS** | • **7/7 automated tests passed** in `test-spk05-instance-verification.mjs`.<br>• Validated HMAC-SHA256, URL-safe Base64, and `crypto.timingSafeEqual` constant-time verification using `WIX_CLIENT_SECRET`.<br>• Tampered payloads, altered signatures, attacker secret keys, and malformed tokens all fail closed safely. |
| **SPK-06** | Fallback Architecture Evaluation | **PASS (Evaluated)** | • Evaluated three fallback architectures (Self-Managed OAuth App, Managed CLI + Companion Site Velo Bridge, and Dedicated FlexiDash JWT Portal).<br>• Self-Managed OAuth App via Headless Wix Auth is identified as the only enterprise-ready fallback that preserves zero-code App Market installation without requiring site-level Velo scripts. |


