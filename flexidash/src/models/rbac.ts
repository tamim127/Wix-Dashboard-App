/**
 * FlexiDash Role-Based Access Control (RBAC) Data Models
 */

import type { FlexiDashUserId, InstanceId } from './identity.ts';

export type PermissionKey =
  | 'dashboard:view'
  | 'dashboard:edit'
  | 'dashboard:publish'
  | 'roles:view'
  | 'roles:manage'
  | 'members:view'
  | 'members:manage'
  | 'portal:access'
  | 'profile:edit'
  | 'integrations:view'
  | 'integrations:manage'
  | 'audit:view'
  | 'permissions:manage'
  | 'widgets:action'
  | 'widgets:edit'
  | 'pages:view:overview'
  | 'pages:view:analytics'
  | 'pages:view:members'
  | 'pages:view:roles'
  | 'pages:view:settings'
  | 'pages:view:audit'
  | 'pages:view:stores'
  | 'pages:view:bookings'
  | 'pages:view:cms'
  | 'pages:view:team';

export interface PermissionDefinition {
  id: PermissionKey;
  name: string;
  description: string;
  category: 'portal' | 'dashboard' | 'admin' | 'pages' | 'widgets';
}

export const PERMISSION_CATALOG: Record<PermissionKey, PermissionDefinition> = {
  // Portal & Profile
  'portal:access': {
    id: 'portal:access',
    name: 'Access Portal Canvas',
    description: 'Allows accessing the site-facing member dashboard canvas',
    category: 'portal',
  },
  'profile:edit': {
    id: 'profile:edit',
    name: 'Edit Member Profile',
    description: 'Allows modifying personal member profile and preferences',
    category: 'portal',
  },

  // Dashboard & Layout
  'dashboard:view': {
    id: 'dashboard:view',
    name: 'View Dashboard',
    description: 'Allows viewing dashboard widgets and published layouts',
    category: 'dashboard',
  },
  'dashboard:edit': {
    id: 'dashboard:edit',
    name: 'Customize Dashboard Layout',
    description: 'Allows personalizing widget positions, sizes, and visibility',
    category: 'dashboard',
  },
  'dashboard:publish': {
    id: 'dashboard:publish',
    name: 'Publish Site-Wide Layout',
    description: 'Allows setting and saving the default layout for all members',
    category: 'dashboard',
  },

  // Member Administration
  'members:view': {
    id: 'members:view',
    name: 'View Members',
    description: 'Allows viewing tenant member roster and profile details',
    category: 'admin',
  },
  'members:manage': {
    id: 'members:manage',
    name: 'Manage Members',
    description: 'Allows creating, modifying, and deactivating tenant members',
    category: 'admin',
  },

  // Roles & Permissions
  'roles:view': {
    id: 'roles:view',
    name: 'View Roles',
    description: 'Allows viewing role definitions and permission mappings',
    category: 'admin',
  },
  'roles:manage': {
    id: 'roles:manage',
    name: 'Manage Roles',
    description: 'Allows creating, editing, and deleting custom roles and assigning roles',
    category: 'admin',
  },
  'permissions:manage': {
    id: 'permissions:manage',
    name: 'Manage Permissions',
    description: 'Allows granting or revoking granular permissions on roles',
    category: 'admin',
  },

  // Integrations & Audits
  'integrations:view': {
    id: 'integrations:view',
    name: 'View Integrations',
    description: 'Allows viewing connected integrations and webhooks',
    category: 'admin',
  },
  'integrations:manage': {
    id: 'integrations:manage',
    name: 'Manage Integrations',
    description: 'Allows installing, modifying, and deleting external integrations',
    category: 'admin',
  },
  'audit:view': {
    id: 'audit:view',
    name: 'View Audit Logs',
    description: 'Allows viewing immutable security and administrative audit records',
    category: 'admin',
  },

  // Widgets
  'widgets:action': {
    id: 'widgets:action',
    name: 'Execute Widget Actions',
    description: 'Allows triggering interactive actions and tasks within dashboard widgets',
    category: 'widgets',
  },
  'widgets:edit': {
    id: 'widgets:edit',
    name: 'Configure Widgets',
    description: 'Allows modifying individual widget configurations and options',
    category: 'widgets',
  },

  // Page Access
  'pages:view:overview': {
    id: 'pages:view:overview',
    name: 'View Overview Section',
    description: 'Allows accessing the portal overview and summary canvas',
    category: 'pages',
  },
  'pages:view:analytics': {
    id: 'pages:view:analytics',
    name: 'View Analytics Section',
    description: 'Allows accessing portal analytics and activity reports',
    category: 'pages',
  },
  'pages:view:members': {
    id: 'pages:view:members',
    name: 'View Members Section',
    description: 'Allows accessing member roster and community section',
    category: 'pages',
  },
  'pages:view:roles': {
    id: 'pages:view:roles',
    name: 'View Roles Section',
    description: 'Allows accessing RBAC role definitions section',
    category: 'pages',
  },
  'pages:view:settings': {
    id: 'pages:view:settings',
    name: 'View Settings Section',
    description: 'Allows accessing portal configuration and preferences section',
    category: 'pages',
  },
  'pages:view:audit': {
    id: 'pages:view:audit',
    name: 'View Audit Section',
    description: 'Allows accessing security audit trail section',
    category: 'pages',
  },
  'pages:view:stores': {
    id: 'pages:view:stores',
    name: 'View Wix Stores Section',
    description: 'Allows accessing store orders, products, and sales metrics',
    category: 'pages',
  },
  'pages:view:bookings': {
    id: 'pages:view:bookings',
    name: 'View Wix Bookings Section',
    description: 'Allows accessing upcoming appointments, schedules, and client bookings',
    category: 'pages',
  },
  'pages:view:cms': {
    id: 'pages:view:cms',
    name: 'View Wix CMS Section',
    description: 'Allows accessing dynamic member content, articles, and collections',
    category: 'pages',
  },
  'pages:view:team': {
    id: 'pages:view:team',
    name: 'View Team Leader Section',
    description: 'Allows accessing team rosters, milestones, and task queues',
    category: 'pages',
  },
};

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSION_CATALOG) as PermissionKey[];

export function isPermissionValid(permission: string): permission is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSION_CATALOG, permission);
}

export interface Role {
  id: string;
  instanceId: InstanceId;
  name: string;
  description: string;
  priority: number;
  isSystem: boolean;
  permissions: PermissionKey[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberRoleAssignment {
  id: string;
  instanceId: InstanceId;
  userId: FlexiDashUserId;
  roleId: string;
  assignedBy: FlexiDashUserId | 'SYSTEM';
  assignedAt: Date;
}

/**
 * Standard System Roles
 */
export const SYSTEM_ROLE_OWNER = 'role_site_owner';
export const SYSTEM_ROLE_ADMIN = 'role_admin';
export const SYSTEM_ROLE_TEAM_LEADER = 'role_team_leader';
export const SYSTEM_ROLE_MEMBER = 'role_member';
export const SYSTEM_ROLE_VISITOR = 'role_visitor';

export const SYSTEM_ROLE_IDS = new Set<string>([
  SYSTEM_ROLE_OWNER,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_MEMBER,
  SYSTEM_ROLE_VISITOR,
]);

export function isSystemRole(roleId: string): boolean {
  return SYSTEM_ROLE_IDS.has(roleId);
}

export const DEFAULT_MEMBER_PERMISSIONS: PermissionKey[] = [
  'dashboard:view',
  'portal:access',
  'profile:edit',
  'pages:view:overview',
];

export const DEFAULT_TEAM_LEADER_PERMISSIONS: PermissionKey[] = [
  'dashboard:view',
  'portal:access',
  'profile:edit',
  'members:view',
  'widgets:action',
  'pages:view:overview',
  'pages:view:analytics',
  'pages:view:members',
  'pages:view:team',
  'pages:view:bookings',
];

export const DEFAULT_ADMIN_PERMISSIONS: PermissionKey[] = [
  ...ALL_PERMISSION_KEYS,
];

export function createDefaultSystemRoles(instanceId: InstanceId): Role[] {
  const now = new Date();
  return [
    {
      id: SYSTEM_ROLE_OWNER,
      instanceId,
      name: 'Site Owner',
      description: 'Full administrative access across all portal and management modules',
      priority: 100,
      isSystem: true,
      permissions: [...ALL_PERMISSION_KEYS],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SYSTEM_ROLE_ADMIN,
      instanceId,
      name: 'Portal Administrator',
      description: 'Manages member assignments, layouts, custom roles, and audit logs',
      priority: 90,
      isSystem: true,
      permissions: [...DEFAULT_ADMIN_PERMISSIONS],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SYSTEM_ROLE_MEMBER,
      instanceId,
      name: 'Standard Member',
      description: 'Default role for authenticated site members',
      priority: 10,
      isSystem: true,
      permissions: [...DEFAULT_MEMBER_PERMISSIONS],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SYSTEM_ROLE_VISITOR,
      instanceId,
      name: 'Visitor',
      description: 'Guest or unverified member with minimal read-only access',
      priority: 0,
      isSystem: true,
      permissions: ['portal:access', 'pages:view:overview'],
      createdAt: now,
      updatedAt: now,
    },
  ];
}
