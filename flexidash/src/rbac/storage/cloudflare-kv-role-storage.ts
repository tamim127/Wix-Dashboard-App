/**
 * FlexiDash Cloudflare KV Role & Member Storage Adapter
 *
 * Implements IRoleStorageAdapter using Cloudflare Workers KV.
 * Provides distributed, edge-native persistence partitioned by tenant instanceId.
 */

import type {
  IRoleStorageAdapter,
  MemberRecord,
  MemberQuery,
  MemberQueryResult,
} from './types.ts';
import type { InstanceId, FlexiDashUserId } from '../../models/identity.ts';
import { toFlexiDashUserId } from '../../models/identity.ts';
import type { Role, MemberRoleAssignment } from '../../models/rbac.ts';
import {
  createDefaultSystemRoles,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_MEMBER,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
} from '../../models/rbac.ts';
import type { KVNamespaceLike } from '../../layout/storage/cloudflare-kv-storage.ts';

export class CloudflareKvRoleStorageAdapter implements IRoleStorageAdapter {
  private readonly kv: KVNamespaceLike;

  constructor(kv: KVNamespaceLike) {
    if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
      throw new Error('CloudflareKvRoleStorageAdapter requires a valid KVNamespaceLike instance');
    }
    this.kv = kv;
  }

  private sanitize(id: string): string {
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  public getRolesKey(instanceId: InstanceId): string {
    return `roles:${this.sanitize(instanceId)}:list`;
  }

  public getMembersKey(instanceId: InstanceId): string {
    return `roles:${this.sanitize(instanceId)}:members`;
  }

  public getAssignmentsKey(instanceId: InstanceId): string {
    return `roles:${this.sanitize(instanceId)}:assignments`;
  }

  private getInitialDemoMembers(instanceId: InstanceId): MemberRecord[] {
    const now = new Date().toISOString();
    return [
      {
        userId: toFlexiDashUserId('user_admin_001'),
        instanceId,
        email: 'admin@flexidash.local',
        name: 'Portal Administrator',
        roles: [SYSTEM_ROLE_ADMIN],
        permissions: [...DEFAULT_ADMIN_PERMISSIONS],
        isDemoData: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: toFlexiDashUserId('user_member_002'),
        instanceId,
        email: 'member@flexidash.local',
        name: 'Standard Member',
        roles: [SYSTEM_ROLE_MEMBER],
        permissions: [...DEFAULT_MEMBER_PERMISSIONS],
        isDemoData: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  public async listRoles(instanceId: InstanceId): Promise<Role[]> {
    const key = this.getRolesKey(instanceId);
    const data = await this.kv.get(key, 'json');
    if (!data || !Array.isArray(data)) {
      const seeded = createDefaultSystemRoles(instanceId);
      await this.kv.put(key, JSON.stringify(seeded));
      return seeded;
    }
    return data.map((r: any) => ({
      ...r,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }));
  }

  public async getRole(instanceId: InstanceId, roleId: string): Promise<Role | null> {
    const roles = await this.listRoles(instanceId);
    return roles.find((r) => r.id === roleId) || null;
  }

  public async saveRole(role: Role): Promise<Role> {
    const roles = await this.listRoles(role.instanceId);
    const existingIndex = roles.findIndex((r) => r.id === role.id);
    const now = new Date();

    const updatedRole: Role = {
      ...role,
      updatedAt: now,
      createdAt: existingIndex >= 0 ? roles[existingIndex].createdAt : now,
    };

    if (existingIndex >= 0) {
      roles[existingIndex] = updatedRole;
    } else {
      roles.push(updatedRole);
    }

    const key = this.getRolesKey(role.instanceId);
    await this.kv.put(key, JSON.stringify(roles));
    return updatedRole;
  }

  public async deleteRole(instanceId: InstanceId, roleId: string): Promise<boolean> {
    const roles = await this.listRoles(instanceId);
    const filtered = roles.filter((r) => r.id !== roleId);
    if (filtered.length === roles.length) {
      return false;
    }
    const key = this.getRolesKey(instanceId);
    await this.kv.put(key, JSON.stringify(filtered));
    return true;
  }

  public async listMembers(instanceId: InstanceId, query: MemberQuery = {}): Promise<MemberQueryResult> {
    const key = this.getMembersKey(instanceId);
    let allMembers = await this.kv.get(key, 'json');
    if (!allMembers || !Array.isArray(allMembers)) {
      allMembers = this.getInitialDemoMembers(instanceId);
      await this.kv.put(key, JSON.stringify(allMembers));
    }

    let filtered: MemberRecord[] = allMembers;

    if (query.roleId) {
      filtered = filtered.filter((m) => m.roles.includes(query.roleId!));
    }

    if (query.search) {
      const q = query.search.toLowerCase().trim();
      filtered = filtered.filter(
        (m) =>
          m.email.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.userId.toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      members: paginated,
      total,
      page,
      limit,
      totalPages,
      isDemoData: allMembers.some((m: MemberRecord) => m.isDemoData),
    };
  }

  public async getMember(instanceId: InstanceId, userId: FlexiDashUserId): Promise<MemberRecord | null> {
    const { members } = await this.listMembers(instanceId, { limit: 1000 });
    return members.find((m) => m.userId === userId) || null;
  }

  public async saveMember(member: MemberRecord): Promise<MemberRecord> {
    const key = this.getMembersKey(member.instanceId);
    let allMembers = await this.kv.get(key, 'json');
    if (!allMembers || !Array.isArray(allMembers)) {
      allMembers = this.getInitialDemoMembers(member.instanceId);
    }

    const index = allMembers.findIndex((m: MemberRecord) => m.userId === member.userId);
    const now = new Date().toISOString();
    const updated: MemberRecord = {
      ...member,
      updatedAt: now,
      createdAt: index >= 0 ? allMembers[index].createdAt : now,
    };

    if (index >= 0) {
      allMembers[index] = updated;
    } else {
      allMembers.push(updated);
    }

    await this.kv.put(key, JSON.stringify(allMembers));
    return updated;
  }

  public async getMemberAssignments(instanceId: InstanceId, userId?: FlexiDashUserId): Promise<MemberRoleAssignment[]> {
    const key = this.getAssignmentsKey(instanceId);
    const data = await this.kv.get(key, 'json');
    if (!data || !Array.isArray(data)) {
      return [];
    }
    const assignments: MemberRoleAssignment[] = data.map((a: any) => ({
      ...a,
      assignedAt: new Date(a.assignedAt),
    }));

    if (userId) {
      return assignments.filter((a) => a.userId === userId);
    }
    return assignments;
  }

  public async saveMemberAssignment(assignment: MemberRoleAssignment): Promise<MemberRoleAssignment> {
    const key = this.getAssignmentsKey(assignment.instanceId);
    const assignments = await this.getMemberAssignments(assignment.instanceId);

    const existingIndex = assignments.findIndex(
      (a) => a.userId === assignment.userId && a.roleId === assignment.roleId
    );

    if (existingIndex >= 0) {
      assignments[existingIndex] = assignment;
    } else {
      assignments.push(assignment);
    }

    await this.kv.put(key, JSON.stringify(assignments));

    // Update member record roles
    const member = await this.getMember(assignment.instanceId, assignment.userId);
    if (member) {
      if (!member.roles.includes(assignment.roleId)) {
        member.roles.push(assignment.roleId);
        await this.saveMember(member);
      }
    } else {
      await this.saveMember({
        userId: assignment.userId,
        instanceId: assignment.instanceId,
        email: `${assignment.userId}@member.local`,
        name: assignment.userId,
        roles: [assignment.roleId],
        isDemoData: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return assignment;
  }

  public async deleteMemberAssignment(instanceId: InstanceId, userId: FlexiDashUserId, roleId: string): Promise<boolean> {
    const key = this.getAssignmentsKey(instanceId);
    const assignments = await this.getMemberAssignments(instanceId);
    const filtered = assignments.filter((a) => !(a.userId === userId && a.roleId === roleId));
    if (filtered.length !== assignments.length) {
      await this.kv.put(key, JSON.stringify(filtered));
    }

    const member = await this.getMember(instanceId, userId);
    if (member && member.roles.includes(roleId)) {
      member.roles = member.roles.filter((r) => r !== roleId);
      await this.saveMember(member);
    }
    return true;
  }

  public async countMembersWithRole(instanceId: InstanceId, roleId: string): Promise<number> {
    const { members } = await this.listMembers(instanceId, { limit: 1000 });
    const directCount = members.filter((m) => m.roles.includes(roleId)).length;
    const assignments = await this.getMemberAssignments(instanceId);
    const totalSet = new Set(members.filter((m) => m.roles.includes(roleId)).map((m) => m.userId));
    for (const a of assignments) {
      if (a.roleId === roleId) {
        totalSet.add(a.userId);
      }
    }
    return Math.max(directCount, totalSet.size);
  }

  public async clearForTesting(instanceId?: InstanceId): Promise<void> {
    if (instanceId) {
      await this.kv.delete(this.getRolesKey(instanceId));
      await this.kv.delete(this.getMembersKey(instanceId));
      await this.kv.delete(this.getAssignmentsKey(instanceId));
    }
  }
}

