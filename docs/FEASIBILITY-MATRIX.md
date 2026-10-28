# FlexiDash Platform Feasibility Matrix

**Document Version:** 1.0.0-phase0  
**Status:** Approved Phase 0 Baseline  
**Scope:** Wix Platform Capability Verification & Limitations Audit  
**Authoritative Sources:** Official Wix Developer Documentation (`dev.wix.com`, `wix.com`, `developers.wixanswers.com`)

---

## 1. Feasibility Taxonomy & Evaluation Criteria

Every capability evaluated in this matrix is classified into one of four precise status categories:

| Status | Definition | Implementation Requirement |
| :--- | :--- | :--- |
| **Supported** | Explicitly supported by official Wix APIs, SDKs, or CLI extension points with complete documentation. | Can be designed and scheduled for implementation following standard patterns. |
| **Supported with Conditions** | Supported by the platform, but subject to specific architectural constraints, permission scopes, editor limitations, or user-facing caveats. | Requires explicit architectural safeguards, documented boundary conditions, or fallback logic. |
| **Unverified** | Plausible or indicated in platform overviews, but lacking complete documentation, code examples, or proven production patterns. | Requires a targeted spike test / proof-of-concept (PoC) in Phase 1 before committing to production design. |
| **Unsupported** | Not supported by current Wix platform architecture, blocked by sandbox boundaries, or explicitly prohibited by platform design. | Cannot be promised in product features. Must be designed out of scope or addressed via supported alternative paths. |

---

## 2. Comprehensive Capability Matrix

| # | Capability / Requirement | Category | Feasibility Status | Wix Mechanism / API | Key Limitations & Boundary Conditions | Official Source Documentation |
| :-: | :--- | :--- | :-: | :--- | :--- | :--- |
| **1** | Custom Signup & Login UI | Authentication | **Supported with Conditions / Partially Unverified in CLI Context** | Wix Site Extension (`CUSTOM_ELEMENT` Site Widget) or Site Page Extension | Custom element can render custom forms; however, custom forms cannot automatically replace native checkout/booking login modals or native member menu triggers. Furthermore, invoking `@wix/site.authentication.applySessionToken()` from inside a standalone Custom Element without site-level Velo bridge is unverified. | [Custom Site Registration Tutorial](https://dev.wix.com/docs/develop-websites/articles/code-tutorials/wix-members/enabling-custom-site-registration) |
| **2** | Wix-Native Member Session Creation | Authentication | **Supported with Conditions / Unverified in CLI App Context** | `wix-members-backend.authentication.generateSessionToken()` + `@wix/site.authentication.applySessionToken()` (Velo) | **Platform Context Disconnect:** Documented primarily for Velo site code. Invoking session generation from a Wix CLI Astro serverless endpoint and applying it inside a Custom Element web component remains unproven and unverified on live sites. **Security Hazard:** Calling `generateSessionToken(email)` without verified authentication allows account takeover and creates phantom accounts with random passwords. | [Wix Members Login API](https://dev.wix.com/docs/velo/apis/wix-members-backend/authentication/login) <br> [Generate Session Token API](https://dev.wix.com/docs/velo/apis/wix-members-backend/authentication/generate-session-token) |
| **3** | Separation of Contact ID and Member ID | Identity | **Supported** | `@wix/crm` vs `@wix/members` APIs | Contacts and Members are distinct entities with independent UUIDs. Creating a CRM contact does not create a member or grant session access. | [Wix Identities Overview](https://dev.wix.com/docs/overview/auth-permissions/identities) |
| **4** | Custom FlexiDash JWT Issuance | Authentication | **Supported with Conditions** | FlexiDash Backend Service (Node/Astro API route) | Valid strictly for authenticating requests to FlexiDash-owned APIs. **A FlexiDash JWT cannot be used as a native Wix session token.** | [Wix Authentication Methods](https://dev.wix.com/docs/overview/auth-permissions/authentication-methods) |
| **5** | External OAuth 2.0 / OIDC Identity (SSO) | Authentication | **Supported with Conditions** | External IdP + Backend Exchange + `generateSessionToken()` | Backend validates IdP callback via PKCE/OAuth; maps external `sub` to Wix Member, generates Wix session token for frontend application. Redirect URLs must be pre-registered. | [Wix App Authentication](https://dev.wix.com/docs/build-apps/develop-your-app/auth/about-authentication) |
| **6** | Custom Password Reset & Recovery | Authentication | **Supported with Conditions** | `wix-members-backend.authentication.sendSetPasswordEmail()` or custom token via email API | Wix manages secure password reset tokens; an app cannot directly write or retrieve raw/hashed passwords in Wix Members database. | [Wix Members Authentication Backend](https://dev.wix.com/docs/velo/apis/wix-members-backend/authentication) |
| **7** | Member Approval Workflows | Authentication | **Supported** | `wix-members-backend.authentication.approveByToken()` / Members API status | App backend can hold registration in pending state and approve programmatically via API upon admin review. | [Wix Members Velo API](https://dev.wix.com/docs/velo/apis/wix-members-backend/authentication) |
| **8** | Replacement of Native Members Area App | Site UX | **Supported with Conditions** | Standalone Site Page Extension / Custom Element Portal | FlexiDash can provide an independent member portal on dedicated pages, but cannot suppress or delete native Members Area pages if other native apps (e.g., Wix Stores) invoke them. | [Site Extensions Overview](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/about-site-extensions) |
| **9** | Universal Native Wix Page Access Restriction | Page Control | **Unsupported** | None (Platform restriction) | An installable app cannot unilaterally intercept native Wix page routes or block access to arbitrary site pages. Page protection outside the app requires native Wix Editor settings or site-level Velo `routers.js`. | [Wix Routers API](https://dev.wix.com/docs/velo/apis/wix-router/routers) |
| **10** | Global Native Header / Navigation Replacement | Site UX | **Unsupported** | None (Platform restriction) | Apps cannot dynamically overwrite or replace the master site header or native navigation bar across the host site. FlexiDash navigation is bounded to its own portal container. | [Site Extensions Architecture](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/about-site-extensions) |
| **11** | Owner Dashboard Extension | Management | **Supported** | Wix CLI `DASHBOARD_PAGE` Extension | Scaffolded via `@wix/astro` and `@wix/dashboard`; rendered seamlessly inside the site owner's Wix Admin Dashboard using `@wix/design-system`. | [Dashboard Page Extensions](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/dashboard-extensions/dashboard-pages/about-dashboard-page-extensions) |
| **12** | Live-Site Member Portal Surface | Site UX | **Supported** | Wix CLI `CUSTOM_ELEMENT` Site Widget + Site Page Extension | Custom element renders web component directly on live site pages; configured statically or via Site Page Extension in App Dashboard. | [Custom Element Site Widgets](https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/site-widgets/create-a-site-widget-extension-custom-element) |
| **13** | Multi-Tenant Site Context Resolution | Security | **Supported** | Wix Signed `instance` Parameter & App Secret Verification | Wix passes a signed JWT `instance` parameter to iframe/extension queries containing verified `instanceId`. Self-managed apps use OAuth tokens paired to `instanceId`. | [App Instance Authentication](https://dev.wix.com/docs/build-apps/develop-your-app/auth/about-authentication) |
| **14** | Embedding Arbitrary Third-Party Wix Apps | Integrations | **Unsupported** | None (Platform restriction) | An app cannot automatically embed arbitrary installed Wix apps into its canvas. Integration is strictly limited to documented site plugins, public REST APIs, or standard iframes. | [Wix App Market Guidelines](https://developers.wixanswers.com/kb/en/article/app-market-guidelines) |
| **15** | Native Wix Business Data Integration (Stores, Bookings) | Integrations | **Supported with Conditions** | Wix REST APIs / Wix JavaScript SDK (`@wix/stores`, `@wix/bookings`) | Supported server-to-server using app instance credentials; site owner must grant corresponding permission scopes upon installation. | [Wix App Permissions & Scopes](https://dev.wix.com/docs/overview/auth-permissions/permissions) |
| **16** | Schema-Driven Dynamic Dashboard Builder | Management | **Supported** | FlexiDash Custom Engine (React JSON Layout Renderer) | Layouts stored as JSON schemas and rendered as structured component trees. Client-side evaluation of arbitrary JavaScript is strictly prohibited. | [Wix App Market Guidelines](https://developers.wixanswers.com/kb/en/article/app-market-guidelines) |
| **17** | Fine-Grained Role-Based Access Control (RBAC) | Security | **Supported** | FlexiDash Backend RBAC Policy Engine | Custom roles and permissions stored and evaluated on FlexiDash backend with default-deny enforcement. Independent of native Wix contributor roles. | [Wix Permissions Overview](https://dev.wix.com/docs/overview/auth-permissions/permissions) |
| **18** | Multi-Tenant Data Isolation | Security | **Supported** | Tenant-Scoped Database / Data Collections | All records must be strictly partitioned by `instanceId` extracted from cryptographically verified tokens. Zero client-side tenant override allowed. | [Wix Multi-Tenant Best Practices](https://dev.wix.com/docs/build-apps/develop-your-app/auth/about-authentication) |

---

## 3. Deep-Dive Capability Assessments

### 3.1 Authentication & Session Management Mechanics
```
[User Submits Credentials]
           │
           ▼
[FlexiDash Custom Element] ──(HTTPS POST credentials)──► [FlexiDash Backend]
                                                                │
                                    ┌───────────────────────────┴───────────────────────────┐
                                    ▼                                                       ▼
                      [Mode 1: Wix-Native Identity]                          [Mode 2: FlexiDash Managed Session]
                                    │                                                       │
                      Calls wix-members-backend                               Issues signed FlexiDash JWT
                     generateSessionToken(email)                                (Claims: userId, instanceId,
                                    │                                                 roles, exp)
                                    ▼                                                       │
                      Returns Wix sessionToken                                              ▼
                                    │                                        Stored in memory / Secure Cookie
                                    ▼                                                       │
                      Frontend invokes @wix/site                                            ▼
                      applySessionToken(token)                               Authorized for FlexiDash APIs Only
                                    │
                                    ▼
                      Browser session established;
                      Native Wix Members area unlocked
```

- **Wix-Native Identity (Mode 1):**
  - *Mechanism:* Server-side generation of a Wix session token via `wix-members-backend` followed by client-side application via `@wix/site` `authentication.applySessionToken()`.
  - *Feasibility Status:* **Supported with Conditions / Unverified in CLI App Context**.
  - *Critical Architectural Distinction: Velo Site Code vs. Wix CLI App Extensions:*
    - **Velo Site Code:** Has direct native access to `wix-members-backend` in server files and `wix-members-frontend` / `@wix/site` in page/master code. The code runs as an intrinsic part of the site runtime.
    - **Wix CLI Managed App Extensions:** The frontend executes as a `CUSTOM_ELEMENT` (Web Component / Shadow DOM), and backend endpoints execute in an Astro serverless runtime on Wix Cloudflare workers.
    - **Frontend Barrier:** It is currently *unverified* whether a Custom Element Web Component can import and successfully invoke `@wix/site.authentication.applySessionToken()` to mutate the parent window's top-level session cookies without site-level Velo glue code.
    - **Backend Barrier:** `wix-members-backend` is a Velo-specific site package. In an app backend, calls to Wix Members must be made using the modern `@wix/members` SDK or REST API with App Strategy / Instance credentials, which may require specific elevated permissions or OAuth delegation.

- **Critical Security Implications of `generateSessionToken(email)`:**
  > [!CAUTION]
  > **Extreme Security Warning on `generateSessionToken(email)`:**
  > According to official Wix documentation ([generateSessionToken](https://dev.wix.com/docs/velo/apis/wix-members-backend/authentication/generate-session-token)), the function behaves as follows:
  > 1. If an account with the specified email **exists**, Wix generates a valid session token for that member without requiring any password verification.
  > 2. If an account with the specified email **does not exist**, Wix automatically creates a new member account with a random password and generates a session token for it.
  > 
  > **Threat Model & Attack Scenarios:**
  > - **Critical Account Takeover:** If an app exposes an endpoint that calls `generateSessionToken(email)` simply because a user submitted an email address on a form, an attacker could supply `site-owner@example.com` or any member's email and obtain instant, full account takeover.
  > - **Phantom Account Spam:** An attacker could submit hundreds of arbitrary emails, causing Wix to flood the site's database with junk member accounts possessing random unrecoverable passwords.
  > 
  > **Mandatory Security Rule:**
  > `generateSessionToken(email)` **MUST NEVER** be invoked based solely on user-supplied email input. It may strictly be invoked **AFTER** a verified, trusted authentication event has occurred (e.g., successful password verification against an authentic identity store, verified cryptographic signature on an OIDC IdP token callback, or a validated one-time magic link token).

- **FlexiDash-Managed JWT (Mode 2):**
  - *Mechanism:* FlexiDash issues an HMAC-SHA256 or RSA signed JWT encoding user identity, site `instanceId`, and role assignments.
  - *Feasibility Status:* **Supported with Conditions**.
  - *Limitation:* **Critical Security Boundary:** This JWT is completely opaque to the Wix platform. It CANNOT authenticate requests to native Wix APIs (e.g., placing an order in Wix Stores or accessing a native members-only page). It is valid strictly for authorizing calls against FlexiDash backend services.

- **External SSO / OIDC (Mode 3):**
  - *Mechanism:* Standard authorization code flow with PKCE against an external IdP (Google, Azure AD, Auth0).
  - *Feasibility Status:* **Supported with Conditions / Unverified End-to-End**.
  - *Limitation:* Requires configuring allowed OAuth callback redirect URLs in both the external IdP and the Wix App settings. The backend must bridge the external identity by looking up or creating the corresponding Wix Member before issuing a session token. Session token generation must strictly follow validated IdP token signature verification.

### 3.2 Entity Taxonomy: Contact ID vs. Member ID vs. FlexiDash ID
Official documentation confirms that Contacts and Members are distinct subsystems within Wix:
- **`wixContactId` (CRM):** Created whenever an individual submits a form, makes a purchase as a guest, or is manually added to the CRM. A contact **does not have credentials** and cannot authenticate.
- **`wixMemberId` (Members):** Created when an individual registers an account with credentials. Every member is automatically associated with an underlying contact, but the `memberId` $\ne$ `contactId`.
- **`flexidashUserId` (Internal):** FlexiDash's internal unique identifier (UUIDv4) representing the user record within a specific tenant installation.
- **`externalSubjectId` (`sub`):** The persistent identifier supplied by an external OIDC/OAuth provider.

> [!CAUTION]
> **Prohibited Anti-Pattern:** Never attempt to pass a `wixContactId` to an API expecting a `wixMemberId` (e.g., member activity APIs or role assignment APIs), as this results in an immediate HTTP 400 Bad Request error. Furthermore, never treat the existence of a CRM contact as proof of authentication.

### 3.3 Site & Page Control Limitations
A fundamental objective of Phase 0 is documenting the precise boundaries of what an installable app can and cannot control on a live Wix site:
1. **No Universal Native Page Protection:**
   - A Wix app runs inside sandboxed extensions (Custom Elements, Dashboard Pages, or Embedded Scripts). It does not execute in the top-level server-side rendering pipeline of arbitrary native Wix pages (e.g., `/shop`, `/blog`, `/about`).
   - Consequently, FlexiDash **cannot programmatically block access to native pages** across the site.
   - *Feasible Alternative:* FlexiDash securely protects all views within its own portal route (e.g., `/portal/*`). For non-portal native pages, site owners must utilize Wix Editor Page Permissions (Password / Members Only) or write custom Velo site routers.
2. **No Dynamic Master Navigation Replacement:**
   - The master site header and global navigation menu are rendered by the Wix site template engine. An installable app has no supported API to replace or mutate the native site header across all pages.
   - *Feasible Alternative:* FlexiDash renders its own rich, role-aware navigation bar, sidebar, and mobile drawer *inside* the member portal container.
3. **Third-Party App Embedding Constraints:**
   - A Wix app cannot arbitrarily query or embed another installed Wix app (e.g., Wix Forum or a third-party App Market app) into its custom canvas.
   - *Feasible Alternative:* FlexiDash supports embedding standard responsive iframes (subject to site owner configuration and external CSP headers) or deep-linking to dedicated native app pages.

---

## 4. Feasibility Risk Heatmap & Summary

| Risk Level | Feature Area | Primary Risk Description | Required Architectural Mitigation |
| :---: | :--- | :--- | :--- |
| **HIGH** | Universal Page Protection | Expecting an app to secure native Wix pages outside the portal. | Document strict boundary; restrict FlexiDash RBAC to FlexiDash portal and backend endpoints. |
| **HIGH** | Native Login Replacement | Expecting custom login form to intercept native checkout modals. | Document limitation; configure native Wix registration settings to redirect to custom portal page where possible. |
| **MEDIUM** | Identity Conflation | Accidental mixing of CRM Contact IDs and Wix Member IDs. | Enforce strict TypeScript types (`BrandedId`) and database constraints separating entity types. |
| **MEDIUM** | Multi-Tenant Data Leak | Client-side tampering of tenant identifier in API requests. | Server-side cryptographic extraction of `instanceId` from Wix signed instance / OAuth token; fail closed. |
| **LOW** | Dashboard Extension | Wix CLI dashboard page rendering and styling. | Standard supported pattern using `@wix/astro`, `@wix/dashboard`, and `@wix/design-system`. |
| **LOW** | Custom Form Rendering | Rendering custom signup/login widgets on live site. | Standard supported pattern using `CUSTOM_ELEMENT` site widget extensions. |

