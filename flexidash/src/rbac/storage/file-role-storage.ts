/**
 * FlexiDash File-Backed Persistent Role & Member Storage Adapter
 *
 * Persists roles, member records, and assignments to disk using atomic file operations.
 * Isolates all entities strictly by tenant instanceId.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
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

export class FileRoleStorageAdapter implements IRoleStorageAdapter {
  private readonly storageDir: string;

  constructor(customStorageDir?: string) {
    if (customStorageDir) {
      this.storageDir = customStorageDir;
    } else {
      const dataDir = process.env.FLEXIDASH_DATA_DIR || path.join(process.cwd(), '.storage', 'roles');
      this.storageDir = dataDir;
    }
  }

  public getStorageDirectory(): string {
    return this.storageDir;
  }

  private sanitizeIdentifier(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private getTenantDir(instanceId: InstanceId): string {
    return path.join(this.storageDir, this.sanitizeIdentifier(instanceId));
  }

  private getRolesFilePath(instanceId: InstanceId): string {
    return path.join(this.getTenantDir(instanceId), 'roles.json');
  }

  private getMembersFilePath(instanceId: InstanceId): string {
    return path.join(this.getTenantDir(instanceId), 'members.json');
  }

  private getAssignmentsFilePath(instanceId: InstanceId): string {
    return path.join(this.getTenantDir(instanceId), 'assignments.json');
  }

  private async writeAtomic(filePath: string, data: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tempPath, data, 'utf8');

    for (let i = 0; i < 5; i++) {
      try {
        await fs.rename(tempPath, filePath);
        return;
      } catch (err: any) {
        if ((err.code === 'EPERM' || err.code === 'EBUSY') && i < 4) {
          await new Promise((r) => setTimeout(r, 25 * (i + 1)));
          continue;
        }
        try {
          await fs.copyFile(tempPath, filePath);
          await fs.unlink(tempPath).catch(() => {});
          return;
        } catch {
          throw err;
        }
      }
    }
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
    const filePath = this.getRolesFilePath(instanceId);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const rawRoles = JSON.parse(data);
      return rawRoles.map((r: any) => ({
        ...r,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      }));
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        const seeded = createDefaultSystemRoles(instanceId);
        await this.writeAtomic(filePath, JSON.stringify(seeded, null, 2));
        return seeded;
      }
      throw err;
    }
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

    const filePath = this.getRolesFilePath(role.instanceId);
    await this.writeAtomic(filePath, JSON.stringify(roles, null, 2));
    return updatedRole;
  }

  public async deleteRole(instanceId: InstanceId, roleId: string): Promise<boolean> {
    const roles = await this.listRoles(instanceId);
    const filtered = roles.filter((r) => r.id !== roleId);
    if (filtered.length === roles.length) {
      return false;
    }
    const filePath = this.getRolesFilePath(instanceId);
    await this.writeAtomic(filePath, JSON.stringify(filtered, null, 2));
    return true;
  }

  public async listMembers(instanceId: InstanceId, query: MemberQuery = {}): Promise<MemberQueryResult> {
    const filePath = this.getMembersFilePath(instanceId);
    let allMembers: MemberRecord[] = [];

    try {
      const data = await fs.readFile(filePath, 'utf8');
      allMembers = JSON.parse(data);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        allMembers = this.getInitialDemoMembers(instanceId);
        await this.writeAtomic(filePath, JSON.stringify(allMembers, null, 2));
      } else {
        throw err;
      }
    }

    let filtered = allMembers;

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
      isDemoData: allMembers.some((m) => m.isDemoData),
    };
  }

  public async getMember(instanceId: InstanceId, userId: FlexiDashUserId): Promise<MemberRecord | null> {
    const { members } = await this.listMembers(instanceId, { limit: 1000 });
    return members.find((m) => m.userId === userId) || null;
  }

  public async saveMember(member: MemberRecord): Promise<MemberRecord> {
    const filePath = this.getMembersFilePath(member.instanceId);
    let allMembers: MemberRecord[] = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      allMembers = JSON.parse(data);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        allMembers = this.getInitialDemoMembers(member.instanceId);
      } else {
        throw err;
      }
    }

    const index = allMembers.findIndex((m) => m.userId === member.userId);
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

    await this.writeAtomic(filePath, JSON.stringify(allMembers, null, 2));
    return updated;
  }

  public async getMemberAssignments(instanceId: InstanceId, userId?: FlexiDashUserId): Promise<MemberRoleAssignment[]> {
    const filePath = this.getAssignmentsFilePath(instanceId);
    let assignments: MemberRoleAssignment[] = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const raw = JSON.parse(data);
      assignments = raw.map((a: any) => ({
        ...a,
        assignedAt: new Date(a.assignedAt),
      }));
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      return [];
    }

    if (userId) {
      return assignments.filter((a) => a.userId === userId);
    }
    return assignments;
  }

  public async saveMemberAssignment(assignment: MemberRoleAssignment): Promise<MemberRoleAssignment> {
    const filePath = this.getAssignmentsFilePath(assignment.instanceId);
    const assignments = await this.getMemberAssignments(assignment.instanceId);

    // Replace if user already has an assignment for this role or record
    const existingIndex = assignments.findIndex(
      (a) => a.userId === assignment.userId && a.roleId === assignment.roleId
    );

    if (existingIndex >= 0) {
      assignments[existingIndex] = assignment;
    } else {
      assignments.push(assignment);
    }

    await this.writeAtomic(filePath, JSON.stringify(assignments, null, 2));

    // Also update member's roles in members list
    const member = await this.getMember(assignment.instanceId, assignment.userId);
    if (member) {
      if (!member.roles.includes(assignment.roleId)) {
        member.roles.push(assignment.roleId);
        await this.saveMember(member);
      }
    } else {
      // Create member entry if missing
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
    const filePath = this.getAssignmentsFilePath(instanceId);
    const assignments = await this.getMemberAssignments(instanceId);
    const filtered = assignments.filter((a) => !(a.userId === userId && a.roleId === roleId));
    if (filtered.length !== assignments.length) {
      await this.writeAtomic(filePath, JSON.stringify(filtered, null, 2));
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
    const assignedUserIds = new Set(assignments.filter((a) => a.roleId === roleId).map((a) => a.userId));
    // Union of members who have role either in member.roles or assignments
    const totalSet = new Set(members.filter((m) => m.roles.includes(roleId)).map((m) => m.userId));
    for (const u of assignedUserIds) {
      totalSet.add(u);
    }
    return Math.max(directCount, totalSet.size);
  }

  public async clearForTesting(instanceId?: InstanceId): Promise<void> {
    if (instanceId) {
      const tenantDir = this.getTenantDir(instanceId);
      try {
        await fs.rm(tenantDir, { recursive: true, force: true });
      } catch {
        // Ignored
      }
    } else {
      try {
        await fs.rm(this.storageDir, { recursive: true, force: true });
      } catch {
        // Ignored
      }
    }
  }
}
