# FlexiDash Security Threat Model & Requirements Verification

**Document Version:** 1.0.0-phase0  
**Status:** Approved Phase 0 Baseline  
**Scope:** Threat Modeling (STRIDE), Security Boundaries, Attack Surface Analysis & Requirement Verification  
**Related Documents:** [PRODUCT-SPEC.md](./PRODUCT-SPEC.md), [FEASIBILITY-MATRIX.md](./FEASIBILITY-MATRIX.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DECISIONS.md](./DECISIONS.md)

---

## 1. Threat Modeling Methodology & Scope

FlexiDash employs the industry-standard **STRIDE Threat Modeling Methodology** to systematically evaluate risks across all architectural boundaries:
- **S**poofing: Impersonating another site, member, or administrator.
- **T**ampering: Modifying role assignments, layout definitions, or tenant identifiers in transit or at rest.
- **R**epudiation: Performing administrative operations without non-repudiable audit trails.
- **I**nformation Disclosure: Leaking cross-tenant data, PII, authentication tokens, or internal error traces.
- **D**enial of Service: Exhausting authentication endpoints, database query quotas, or memory via excessive submissions.
- **E**levation of Privilege: Escalating a standard member to administrator or bypassing RBAC checks.

### Target Component Scope
The threat model encompasses five trust boundaries:
1. **Site Visitor / Member Browser Client $\rightarrow$ FlexiDash Custom Element Widget**
2. **Site Owner Browser Client $\rightarrow$ FlexiDash Dashboard Extension**
3. **FlexiDash Frontend Components $\rightarrow$ FlexiDash Backend API Gateway**
4. **FlexiDash Backend $\rightarrow$ Multi-Tenant Persistence Layer**
5. **FlexiDash Backend $\rightarrow$ Wix Platform APIs (Members, CRM, App Platform)**

---

## 2. Attack Surface Analysis

```
                              ATTACK SURFACE & TRUST BOUNDARIES
                              
       [Attacker / Malicious Client]
                    │
   [Threat A: Spoofed Tenant ID]
   [Threat B: Client State Tampering]
   [Threat C: Direct URL / API Probing]
   [Threat D: Replay / Forged JWT]
                    │
                    ▼
     ═══════════════════════════════════ [Trust Boundary 1: API Gateway] ═══════════════════
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   [Public Routes]       [Protected Routes]
   • /api/auth/login     • /api/portal/layout
   • /api/auth/register  • /api/admin/*
         │                     │
   [Threat E: Brute      [Threat F: Role
    Force / Spam]         Escalation]
         │                     │
     ═══════════════════════════════════ [Trust Boundary 2: RBAC Policy] ═══════════════════
                               │
                               ▼
               [Default-Deny Policy Evaluator]
                               │
     ═══════════════════════════════════ [Trust Boundary 3: Persistence] ═══════════════════
                               │
                               ▼
             [Tenant Data Repository (instanceId Scope)]
                               │
   [Threat G: Cross-Tenant SQL/NoSQL Injection]
```

### High-Risk Platform Vectors
1. **Client-Side Role Tampering:** An attacker modifies local JavaScript state or localStorage tokens to claim an `Admin` or `VIP` role. *Mitigation:* The frontend role state is treated strictly as display hint; every backend API independently resolves roles from the database using the verified session subject.
2. **Tenant ID Injection / Spoofing:** An attacker modifies an HTTP header or JSON payload to specify `instanceId: "victim-site-id"`. *Mitigation:* The backend completely ignores client-supplied tenant IDs and extracts `instanceId` strictly from cryptographically validated signatures.
3. **Entity ID Conflation:** An attacker submits a `wixContactId` where a `wixMemberId` is expected, attempting to elevate unauthenticated leads to authenticated status. *Mitigation:* Strict type separation, branded types in TypeScript, and foreign key validations.
4. **Layout Schema XSS:** A malicious site administrator or attacker injects `<script>` tags or `javascript:` URLs into custom dashboard widget configurations. *Mitigation:* Strict JSON schema validation; React JSX rendering with automatic escaping; complete prohibition of `dangerouslySetInnerHTML` or `eval()`.
5. **Unauthenticated `generateSessionToken` Invocation (Account Takeover & Phantom Account Spam):** Calling `generateSessionToken(email)` based purely on unverified user input. *Vulnerability:* Official documentation proves that if the email exists, a valid session token is generated without password verification (enabling account takeover); if the email does not exist, Wix creates a new member account with a random password. *Mitigation:* Enforce a strict architectural barrier: `generateSessionToken(email)` must NEVER be called without a prior, verified, trusted authentication event (e.g., successful password check or cryptographically verified OIDC IdP token callback).

---

## 3. Master Specification Security Requirements Mapping

Section 7 of the Master Product Specification mandates eighteen specific security and behavior verifications. Below, every single requirement is mapped 1-to-1 to its identified threat, concrete technical mitigation, and planned verification test method.

> [!NOTE]
> **Design vs. Execution Distinction:**
> In Phase 0, all 18 requirements have concrete architectural mitigations designed and documented. Because Phase 0 is strictly documentation-only and contains no application code, application-level test suites are **Planned** for implementation and execution across Phases 1 through 10 as their respective components are constructed.

| Req # | Master Specification Requirement | Identified Threat / Attack Vector | Concrete Technical Mitigation | Exact Verification & Planned Test Method | Architectural Coverage Status |
| :-: | :--- | :--- | :--- | :--- | :-: |
| **1** | A site cannot access another site's configuration, members, role assignments, or layouts. | Cross-Tenant Data Exfiltration (Horizontal Privilege Escalation). | Enforce cryptographically verified `instanceId` filter on every database query (`WHERE instanceId = context.instanceId`). Fail closed if context is missing. | **Automated Integration Test:** Send API request with valid credentials for Site A attempting to read Site B's layout ID. Expect `HTTP 404` or `HTTP 403`. | **Design Documented (Test Planned - Phase 2)** |
| **2** | A logged-out visitor cannot access protected data. | Unauthenticated Data Access / Information Disclosure. | Enforce Bearer token / session verification middleware on all `/api/portal/*` endpoints. Default-deny on missing auth headers. | **Automated API Test:** Query protected member dashboard endpoint without `Authorization` header. Expect `HTTP 401 Unauthorized`. | **Design Documented (Test Planned - Phase 2/3)** |
| **3** | A user cannot grant themselves admin permissions. | Vertical Privilege Escalation / Self-Promotion. | Role assignment APIs verify that the caller possesses `Site Owner` or `Admin` role in the verified tenant context. Prohibit members from editing their own role join records. | **Automated RBAC Test:** Authenticated standard member issues `POST /api/admin/roles/assign` targeting their own `userId`. Expect `HTTP 403 Forbidden`. | **Design Documented (Test Planned - Phase 4)** |
| **4** | Changing a frontend role value does not change backend authorization. | Client-Side State Tampering. | The backend never reads role claims from client request bodies. Roles are re-queried from the database or verified from an untampered backend-signed JWT. | **Automated API Test:** Member sends request with manipulated client header `X-User-Role: Admin`. Backend evaluates against database roles. Expect `HTTP 403 Forbidden`. | **Design Documented (Test Planned - Phase 4)** |
| **5** | A hidden navigation item does not expose its protected API. | Obscurity vs. Security Flaw. | Frontend navigation visibility is cosmetic. All backend endpoints backing hidden navigation items perform independent RBAC checks on every request. | **Automated Security Test:** Invoke backend API corresponding to a hidden admin menu item using a standard member token. Expect `HTTP 403 Forbidden`. | **Design Documented (Test Planned - Phase 4/6)** |
| **6** | Direct URL access is checked. | Forced Browsing / Direct Route Navigation. | Portal client router checks role permissions before mounting protected views. If direct URL is accessed, router queries backend; if unauthorized, redirects to 403 page. | **Automated E2E Test:** Headless browser navigates directly to `/portal/admin-settings` with standard member session. Expect redirect to `/portal/unauthorized`. | **Design Documented (Test Planned - Phase 6)** |
| **7** | Invalid, expired, or revoked tokens are rejected. | Replay Attack / Session Hijacking. | Token verification middleware validates cryptographic signature, `exp` claim, and checks revocation blacklist/version. | **Automated Unit Test:** Sign a token with expired timestamp (`exp = now - 1000s`) or invalid HMAC secret. Submit to API. Expect `HTTP 401 Unauthorized`. | **Design Documented (Test Planned - Phase 2/3)** |
| **8** | FlexiDash JWTs are never accepted as Wix session tokens. | Token Conflation / False Session Assumption. | FlexiDash API handlers validate only FlexiDash-issued JWTs with explicit issuer (`iss: flexidash`). Wix platform API handlers accept only native Wix session tokens. | **Automated Test:** Pass FlexiDash JWT to a native Wix Members endpoint. Verify that the platform rejects it as an invalid Wix session token. | **Design Documented (Test Planned - Phase 3)** |
| **9** | Wix Member ID, CRM Contact ID, FlexiDash identity ID, and external subject ID are not conflated. | Identity Injection / Type Confusion. | Maintain dedicated columns and TypeScript branded types (`WixMemberId`, `WixContactId`, `FlexiDashUserId`, `ExternalSubjectId`). Forbid interchangeable usage. | **Automated Type & Unit Test:** Verify compile-time type safety; test that repository rejects a `wixContactId` passed into a `wixMemberId` field. | **Design Documented (Test Planned - Phase 2/3)** |
| **10** | A CRM contact alone does not imply authenticated member status. | Authentication Bypass via Contact Injection. | Authentication queries verify credentials against Wix Members authentication service. CRM contacts without linked credentials cannot authenticate. | **Automated Integration Test:** Attempt to log in with an email that exists solely as an unverified CRM contact (no member record). Expect `HTTP 401 Invalid Credentials`. | **Design Documented (Test Planned - Phase 3)** |
| **11** | Duplicate or missing contact mappings are handled safely. | Integrity Failure / State Inconsistency. | Backend enforces unique composite index `(instanceId, email)`; transactional creation of Member + Contact mappings; graceful error logging on unlinked records. | **Automated Unit Test:** Simulate duplicate contact registration and orphaned contact scenarios. Verify system fails gracefully with specific error codes. | **Design Documented (Test Planned - Phase 3)** |
| **12** | OAuth callback/state validation follows the selected provider's security requirements. | Cross-Site Request Forgery (CSRF) / Authorization Code Injection. | Enforce cryptographically random `state` parameter stored in secure HTTP-only cookie, and PKCE (`code_verifier` / `code_challenge`) on all OAuth/OIDC flows. | **Automated Flow Test:** Trigger OAuth callback with mismatched or missing `state` query parameter. Expect `HTTP 400 Bad Request` and termination. | **Design Documented (Test Planned - Phase 5/9)** |
| **13** | Tokens, passwords, secrets, and sensitive contact data are not logged. | Information Disclosure / Credential Leakage. | Implement custom log serializer with automatic redaction filter for keys: `password`, `token`, `secret`, `authorization`, `creditCard`, `ssn`. | **Automated Log Audit Test:** Pass payload with sensitive fields through logging pipeline; inspect log stream to assert sensitive strings are replaced with `[REDACTED]`. | **Design Documented (Test Planned - Phase 2/10)** |
| **14** | App uninstall/reinstall does not mix tenant data. | Stale Tenant Collision / Data Leakage. | When `AppRemoved` webhook is received, mark tenant as `DEACTIVATED`. If app is reinstalled (`instanceId` changes or resets), provision fresh tenant namespace. | **Automated Integration Test:** Trigger mock `AppRemoved` event followed by fresh `AppInstalled`. Verify new installation cannot access old site data. | **Design Documented (Test Planned - Phase 2)** |
| **15** | Third-Party integration failure does not expose secrets or bypass authorization. | Fault Injection / Error Exposure. | Wrap third-party API calls in circuit breakers and try-catch blocks with generic error responses. Secrets are stored in server-side environment variables only. | **Automated Fault Test:** Mock external service returning HTTP 500 containing internal database credentials. Assert FlexiDash API returns sanitized `HTTP 502`. | **Design Documented (Test Planned - Phase 9)** |
| **16** | Invalid dashboard/form schemas cannot execute arbitrary code. | Cross-Site Scripting (XSS) / Remote Code Execution. | Layout and form schemas are validated against strict JSON Schema (Zod). Render strictly via declarative React component registry without `eval()` or unescaped HTML. | **Automated Security Test:** Submit layout containing `<img src=x onerror=alert(1)>` or `<script>`. Verify schema validator strips or rejects the payload. | **Design Documented (Test Planned - Phase 5/7)** |
| **17** | Role changes and permission changes are audited. | Administrative Repudiation / Stealth Tampering. | All mutations to `Role`, `Permission`, and `MemberRoleAssignment` emit an append-only `AuditEvent` record with actor ID, target ID, timestamp, and diff. | **Automated Audit Test:** Assign role to member; query `AuditEvent` collection. Verify corresponding immutable event record exists with exact metadata. | **Design Documented (Test Planned - Phase 4/10)** |
| **18** | Password reset and email verification flows resist abuse and enumeration where applicable. | User Enumeration / Brute Force / Spam. | Return uniform generic responses on password reset requests ("If an account exists, a reset link has been sent"). Enforce strict IP/email rate limiting. | **Automated Rate Limit Test:** Send 20 rapid password reset requests for nonexistent and existent emails. Verify identical response messages and HTTP 429 on threshold. | **Design Documented (Test Planned - Phase 5/10)** |

### Requirement Count Verification
- **Total Requirements Mandated:** 18
- **Total Requirements with Documented Architectural Mitigations:** 18 (100% Full Fidelity)
- **Application Tests Executed in Phase 0:** 0 (Phase 0 is documentation-only; automated test suites will be implemented alongside code across Phases 1–10)
- **Unmapped Requirements:** 0

---

## 4. Platform Security Gaps & Residual Risk Analysis

The Phase 0 feasibility audit identified three specific platform-level constraints where the Wix architecture limits app-level security. These gaps are analyzed below with corresponding hardening strategies:

### Gap 1: Inability to Protect Native Wix Pages via App Backend Alone
- **Platform Reality:** An installable app operates inside extension sandboxes (`DASHBOARD_PAGE`, `CUSTOM_ELEMENT`). It cannot execute code in the server-side rendering pipeline of native Wix pages (e.g., `/shop`, `/blog`).
- **Residual Risk:** If a site owner places sensitive business data on a standard native Wix page assuming FlexiDash will protect it, unauthenticated users could access it.
- **Architectural Hardening:**
  1. Clearly document in the product spec and dashboard UI that FlexiDash protection applies strictly to the FlexiDash portal (`/portal/*`).
  2. Provide clear instructions for site owners to apply native Wix Editor page permissions ("Members Only") to native pages.
  3. Encourage site owners to render all sensitive views as FlexiDash custom widgets rather than native pages.

### Gap 2: Inability to Suppress Native Wix Member Modals
- **Platform Reality:** When native Wix business apps (Wix Stores checkout, Wix Bookings) require member authentication, they automatically trigger Wix's default login lightbox or modal. An installable app cannot disable or intercept these native system triggers.
- **Residual Risk:** Users may experience fragmented authentication UI (encountering the native Wix login modal on checkout and the custom FlexiDash form on the portal page).
- **Architectural Hardening:**
  1. Utilize Mode 1 (Wix-Native Identity) so that once a user logs in via FlexiDash, the native session cookie is set. Subsequent visits to Wix Stores checkout recognize the user as authenticated without prompting for login again.
  2. Configure native Wix Member settings to redirect login links to the custom portal login URL where supported.

### Gap 3: Client-Side Session Handshake Latency
- **Platform Reality:** When `wix-members-backend` generates a `sessionToken`, the client browser must invoke `@wix/site.authentication.applySessionToken()`. This requires a round-trip to Wix auth servers and reloads browser session cookies.
- **Residual Risk:** A brief latency window (300ms–1500ms) occurs between credential validation and native session establishment.
- **Architectural Hardening:**
  1. Display a smooth, branded loading spinner in the FlexiDash Auth Widget while `applySessionToken()` resolves.
  2. Await the promise resolution before executing the post-login page redirect.

---

## 5. Security Verification & Testing Architecture for Subsequent Phases

To guarantee adherence to the 18 security requirements across all implementation phases, the following testing gates are established:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY TESTING PIPELINE                             │
├───────────────────┬───────────────────────────────────┬─────────────────────────┤
│ Test Level        │ Focus Area                        │ Execution Frequency     │
├───────────────────┼───────────────────────────────────┼─────────────────────────┤
│ Static Analysis   │ ESLint security plugins, Zod      │ Every commit / build    │
│                   │ schema checks, no eval / no raw   │                         │
│                   │ innerHTML, strict TypeScript types│                         │
├───────────────────┼───────────────────────────────────┼─────────────────────────┤
│ Unit Security     │ Signature verification, token     │ Every pull request      │
│                   │ expiry, log redaction filters,    │                         │
│                   │ role evaluation logic             │                         │
├───────────────────┼───────────────────────────────────┼─────────────────────────┤
│ Integration Tests │ Tenant isolation (Site A vs B),   │ Phase Gate acceptance   │
│                   │ RBAC default-deny, direct URL     │                         │
│                   │ 403 enforcement, CSRF state       │                         │
├───────────────────┼───────────────────────────────────┼─────────────────────────┤
│ Live Site E2E     │ End-to-end login handshake,       │ Pre-release milestone   │
│                   │ session reload, custom element    │                         │
│                   │ rendering on published Wix site   │                         │
└───────────────────┴───────────────────────────────────┴─────────────────────────┘
```

