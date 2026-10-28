/**
 * FlexiDash Page & Navigation Access Control Engine
 *
 * Enforces route and navigation access server-side based on RBAC permissions and roles.
 * Guarantees that users cannot bypass page restrictions by typing direct URLs.
 */

import type { AuthSession } from '../models/session.ts';
import type { PermissionKey } from '../models/rbac.ts';
import { PolicyEngine } from './policy-engine.ts';

export interface PageAccessRule {
  path: string;
  name: string;
  section: 'dashboard' | 'reporting' | 'community' | 'admin' | 'configuration';
  description: string;
  requiredPermission?: PermissionKey;
  allowedRoles?: string[];
}

export interface NavItem {
  id: string;
  path: string;
  label: string;
  section: string;
  icon?: string;
}

export const DEFAULT_PAGE_RULES: PageAccessRule[] = [
  {
    path: '/portal',
    name: 'Overview',
    section: 'dashboard',
    description: 'Main portal canvas with personalized widgets',
    requiredPermission: 'pages:view:overview',
  },
  {
    path: '/portal/analytics',
    name: 'Analytics & Insights',
    section: 'reporting',
    description: 'Aggregated analytics, metrics, and traffic statistics',
    requiredPermission: 'pages:view:analytics',
  },
  {
    path: '/portal/members',
    name: 'Member Directory',
    section: 'community',
    description: 'Member profiles and community roster',
    requiredPermission: 'pages:view:members',
  },
  {
    path: '/portal/roles',
    name: 'Role Management',
    section: 'admin',
    description: 'Tenant roles and granular permission matrix',
    requiredPermission: 'pages:view:roles',
  },
  {
    path: '/portal/audit',
    name: 'Security Audit Log',
    section: 'admin',
    description: 'Persistent audit trail of security and configuration events',
    requiredPermission: 'pages:view:audit',
  },
  {
    path: '/portal/settings',
    name: 'Portal Settings',
    section: 'configuration',
    description: 'Tenant portal customization and integration preferences',
    requiredPermission: 'pages:view:settings',
  },
  {
    path: '/portal/team',
    name: 'Team Management',
    section: 'community',
    description: 'Team Leader member supervision, task queue, and approvals',
    requiredPermission: 'pages:view:team',
  },
  {
    path: '/portal/stores',
    name: 'Wix Stores',
    section: 'reporting',
    description: 'Wix Stores ecommerce orders, fulfillment, and revenue metrics',
    requiredPermission: 'pages:view:stores',
  },
  {
    path: '/portal/bookings',
    name: 'Wix Bookings',
    section: 'reporting',
    description: 'Wix Bookings upcoming appointments and service schedule',
    requiredPermission: 'pages:view:bookings',
  },
  {
    path: '/portal/cms',
    name: 'Wix CMS Resources',
    section: 'dashboard',
    description: 'Dynamic member articles, downloadable guides, and CMS content',
    requiredPermission: 'pages:view:cms',
  },
];

export const DEFAULT_PORTAL_NAV_ITEMS: NavItem[] = [
  { id: 'nav_overview', path: '/portal', label: 'Overview', section: 'dashboard', icon: 'dashboard' },
  { id: 'nav_team', path: '/portal/team', label: 'My Team', section: 'community', icon: 'users' },
  { id: 'nav_stores', path: '/portal/stores', label: 'Store Orders', section: 'reporting', icon: 'cart' },
  { id: 'nav_bookings', path: '/portal/bookings', label: 'Bookings', section: 'reporting', icon: 'calendar' },
  { id: 'nav_cms', path: '/portal/cms', label: 'CMS Content', section: 'dashboard', icon: 'file' },
  { id: 'nav_analytics', path: '/portal/analytics', label: 'Analytics', section: 'reporting', icon: 'chart' },
  { id: 'nav_members', path: '/portal/members', label: 'Members', section: 'community', icon: 'users' },
  { id: 'nav_roles', path: '/portal/roles', label: 'Roles', section: 'admin', icon: 'shield' },
  { id: 'nav_audit', path: '/portal/audit', label: 'Audit Log', section: 'admin', icon: 'history' },
  { id: 'nav_settings', path: '/portal/settings', label: 'Settings', section: 'configuration', icon: 'settings' },
];

export interface PageAccessResult {
  allowed: boolean;
  reason?: string;
  rule?: PageAccessRule;
}

/**
 * Normalizes a URL path for consistent matching
 */
export function normalizePath(path: string): string {
  const clean = path.split('?')[0].split('#')[0].trim();
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1);
  }
  return clean || '/';
}

/**
 * Evaluates whether an authenticated session is permitted to access a specific page path.
 * Evaluates permission rules and role constraints server-side.
 */
export function checkPageAccess(
  session: AuthSession | null | undefined,
  path: string,
  rules: PageAccessRule[] = DEFAULT_PAGE_RULES
): PageAccessResult {
  if (!session) {
    return {
      allowed: false,
      reason: 'Authentication required to access portal pages',
    };
  }

  const normalized = normalizePath(path);
  const rule = rules.find((r) => normalizePath(r.path) === normalized);

  if (!rule) {
    // Safe default for unregistered paths:
    // If inside /portal, baseline requires 'portal:access'
    if (normalized.startsWith('/portal')) {
      if (PolicyEngine.hasPermission(session, 'portal:access')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "Access denied: missing baseline 'portal:access' permission",
      };
    }

    // Default deny for unmapped routes
    return {
      allowed: false,
      reason: `Route '${normalized}' is not registered in the access control matrix`,
    };
  }

  // 1. Check allowed roles constraint if specified
  if (rule.allowedRoles && rule.allowedRoles.length > 0) {
    if (!PolicyEngine.hasAnyRole(session, rule.allowedRoles)) {
      return {
        allowed: false,
        reason: `Access denied: role requirement not met for '${rule.name}'`,
        rule,
      };
    }
  }

  // 2. Check required permission if specified
  if (rule.requiredPermission) {
    if (!PolicyEngine.hasPermission(session, rule.requiredPermission)) {
      return {
        allowed: false,
        reason: `Access denied: missing required permission '${rule.requiredPermission}' for '${rule.name}'`,
        rule,
      };
    }
  }

  return {
    allowed: true,
    rule,
  };
}

/**
 * Filters a navigation item list, removing links the session is unauthorized to visit.
 */
export function filterAuthorizedNavItems(
  session: AuthSession | null | undefined,
  items: NavItem[] = DEFAULT_PORTAL_NAV_ITEMS,
  rules: PageAccessRule[] = DEFAULT_PAGE_RULES
): NavItem[] {
  return items.filter((item) => checkPageAccess(session, item.path, rules).allowed);
}

