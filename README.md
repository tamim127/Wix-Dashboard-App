# Wix-Dashboard-App (FlexiDash)

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)]()
[![Typecheck](https://img.shields.io/badge/TypeScript-0_Errors-brightgreen)]()
[![Tests](https://img.shields.io/badge/Tests-137%2F137_Passing-brightgreen)]()
[![App ID](https://img.shields.io/badge/Wix_App_ID-fed82166--29ac--4cba--842a--fbedd2e1b0b1-blue)]()

**FlexiDash** is an enterprise-ready Wix CLI Managed Application providing personalized member dashboards, server-side Role-Based Access Control (RBAC), an interactive drag-and-drop layout builder, and tamper-evident security audit logging for Wix sites.

---

## 🚀 Key Features

- **Wix Dashboard Management Extension**: Integrated into the Wix Site Dashboard with 7 administrative tabs:
  - **Overview**: System health, active tenant metrics, and quick statistics.
  - **Authentication**: Zero-`localStorage` authentication management and in-memory session handling.
  - **RBAC Role Matrix**: Custom role creation, granular permission assignments, and system-role protections (`role_site_owner`, `role_admin`, `role_member`, `role_visitor`).
  - **Member Roster**: Member directory search, filtering, and role assignments with live CRM status indicators.
  - **Page Access Rules**: Server-side route authorization rules and real-time simulator.
  - **Interactive Layout Editor**: Drag-and-drop grid customizer with widget sizing (small, medium, large, full).
  - **Security Audit Logs**: Immutable chronological security audit trail with credential redaction.
- **Site-Facing Member Portal (`/portal`)**: Server-authorized responsive widget canvas (Desktop 4-column, Tablet 2-column, Mobile 1-column) rendering only permitted widgets.
- **Edge-Native Cloudflare KV Storage**: Production persistence across Layouts, Roles, Audit Logs, and Tenant Configurations with fail-closed edge guards.
- **Cryptographic Wix Platform Integration**: HMAC-SHA256 verification of Wix signed instance tokens (`x-wix-instance`) and app lifecycle webhooks (`wix.app.installed`, `wix.app.removed`, `wix.app.plan_changed`).

---

## 📁 Repository Structure

```
.
├── README.md
├── docs/                                  # Architectural & Submission Documentation
│   ├── APP-MARKET-SUBMISSION.md           # Wix App Market readiness & review instructions
│   ├── ARCHITECTURE.md                    # Technical architecture & integration models
│   ├── DECISIONS.md                       # Architecture Decision Records (ADRs)
│   ├── FEASIBILITY-MATRIX.md              # Platform capabilities & extension matrix
│   ├── PRODUCT-SPEC.md                    # Functional requirements & data schemas
│   ├── PRODUCTION-DEPLOYMENT.md           # Cloudflare Workers & KV deployment guide
│   └── SECURITY-THREATS.md                # Threat modeling & security invariant proofs
└── flexidash/                             # Core Wix CLI Managed Application
    ├── astro.config.mjs                   # Astro SSR & @wix/astro-wix-hosting-adapter
    ├── package.json                       # Dependencies & scripts
    ├── wix.config.json                    # Wix App configuration (App ID & Scopes)
    ├── src/                               # Application source code
    │   ├── api/                           # Response serialization & error mapping
    │   ├── audit/                         # Security audit trail & adapters
    │   ├── auth/                          # Instance validator, JWT service & middleware
    │   ├── client/                        # Typed API client & SessionManager
    │   ├── config/                        # Environment validator & fail-closed guards
    │   ├── crm/                           # Wix CRM & Members integration service
    │   ├── extensions/                    # Wix Dashboard Page Extension
    │   ├── layout/                        # Layout model, widget registry & storage
    │   ├── models/                        # Branded identity, RBAC & session types
    │   ├── pages/                         # Astro SSR routes & API handlers
    │   ├── portal/                        # Member portal React shell & widget canvas
    │   ├── rbac/                          # Server policy engine & page access rules
    │   ├── security/                      # Rate limiter & server input validators
    │   └── tenant/                        # Installation lifecycle & tenant config store
    └── test/                              # Automated test suite (137 tests across 23 suites)
```

---

## 🛠️ Quick Start

### 1. Prerequisites
- **Node.js**: v20 or v22 LTS
- **Package Manager**: npm

### 2. Installation
```bash
cd flexidash
npm install
```

### 3. Run Development Server
```bash
npm run dev      # Launches local Astro server on http://localhost:4321
```
Visit **http://localhost:4321/** to access the testing hub:
- **Member Portal**: `http://localhost:4321/portal`
- **Dashboard Extension**: `http://localhost:4321/dashboard`

### 4. Run Test Suite
```bash
npm test         # Executes all 23 test suites (137 tests)
```

### 5. Typecheck & Verification
```bash
npm run typecheck   # Executes 'astro check' (0 errors, 0 warnings, 0 hints)
```

### 6. Production Build
```bash
npm run build       # Executes 'wix build'
```

---

## 🔒 Security Invariants

1. **Zero Hardcoded Secrets**: All credentials and secrets are injected via verified environment variables.
2. **Fail-Closed Production Mode**: Missing production secrets or attempting to run mock authentication in production immediately aborts startup with a `ConfigurationError`.
3. **Multi-Tenant Boundary**: All records are strictly partitioned by Wix `instanceId`. Cross-tenant queries throw `TenantMismatchError`.
4. **Zero-LocalStorage Invariant**: Session tokens remain exclusively in in-memory memory closures (`SessionManager`), preventing XSS token exfiltration.
5. **HMAC-SHA256 Token Verification**: All requests bearing `x-wix-instance` or JWT tokens are verified using timing-safe cryptographic comparisons.

---

## 📄 License

Proprietary / All rights reserved.

