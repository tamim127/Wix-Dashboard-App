/**
 * FlexiDash Role & Member Storage Adapter Interfaces
 */

import type { InstanceId, FlexiDashUserId } from '../../models/identity.ts';
import type { Role, MemberRoleAssignment, PermissionKey } from '../../models/rbac.ts';

export interface MemberRecord {
  userId: FlexiDashUserId;
  instanceId: InstanceId;
  email: string;
  name: string;
  roles: string[];
  permissions?: PermissionKey[];
  isDemoData?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemberQuery {
  search?: string;
  roleId?: string;
  page?: number;
  limit?: number;
}

export interface MemberQueryResult {
  members: MemberRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isDemoData: boolean;
}

export interface RoleWithMeta extends Role {
  memberCount: number;
}

export interface IRoleStorageAdapter {
  getRole(instanceId: InstanceId, roleId: string): Promise<Role | null>;
  listRoles(instanceId: InstanceId): Promise<Role[]>;
  saveRole(role: Role): Promise<Role>;
  deleteRole(instanceId: InstanceId, roleId: string): Promise<boolean>;

  getMember(instanceId: InstanceId, userId: FlexiDashUserId): Promise<MemberRecord | null>;
  listMembers(instanceId: InstanceId, query?: MemberQuery): Promise<MemberQueryResult>;
  saveMember(member: MemberRecord): Promise<MemberRecord>;

  getMemberAssignments(instanceId: InstanceId, userId?: FlexiDashUserId): Promise<MemberRoleAssignment[]>;
  saveMemberAssignment(assignment: MemberRoleAssignment): Promise<MemberRoleAssignment>;
  deleteMemberAssignment(instanceId: InstanceId, userId: FlexiDashUserId, roleId: string): Promise<boolean>;
  countMembersWithRole(instanceId: InstanceId, roleId: string): Promise<number>;
  clearForTesting?(instanceId?: InstanceId): Promise<void>;
}

