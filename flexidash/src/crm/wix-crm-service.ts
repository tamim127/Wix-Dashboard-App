/**
 * FlexiDash Wix CRM & Members Integration Service
 *
 * Interacts with official Wix Members and Contacts APIs when running in an
 * authorized Wix environment with granted scopes (e.g., WIX_MEMBERS.READ, WIX_CONTACTS.READ).
 *
 * Provides safe fallback to local storage adapter when live credentials or
 * site runtime context are not available, clearly labeling data provenance.
 */

import type { InstanceId, WixMemberId, WixContactId } from '../models/identity.ts';
import { toFlexiDashUserId, toWixMemberId, toWixContactId, assertDistinctIdentityTypes } from '../models/identity.ts';
import type { MemberRecord, MemberQuery, MemberQueryResult } from '../rbac/storage/types.ts';
import { getRoleStorageAdapter } from '../rbac/storage/role-storage-factory.ts';
import { SYSTEM_ROLE_MEMBER, DEFAULT_MEMBER_PERMISSIONS } from '../models/rbac.ts';
import { getAppConfig } from '../config/env.ts';

export interface WixLiveMemberRaw {
  _id: string;
  contactId?: string;
  loginEmail?: string;
  profile?: {
    nickname?: string;
    slug?: string;
    photo?: { url?: string };
  };
  status?: 'APPROVED' | 'PENDING' | 'BLOCKED' | string;
  _createdDate?: string;
  _updatedDate?: string;
}

export class WixCrmMemberService {
  /**
   * Retrieves tenant members with support for live Wix Members API
   * and fallback to local persistent tenant roster.
   */
  public static async getTenantMembers(
    instanceId: InstanceId,
    query: MemberQuery = {}
  ): Promise<MemberQueryResult & { platformStatus: string }> {
    const config = getAppConfig();
    const isLiveMode = config.nodeEnv === 'production' && config.authMode === 'wix-native';

    // 1. Attempt live Wix CRM query if live client is available
    if (isLiveMode) {
      try {
        const liveResult = await this.queryLiveWixMembers(instanceId, query);
        if (liveResult) {
          return liveResult;
        }
      } catch (err) {
        console.warn(`[WixCrmService] Live Wix Members query failed for tenant ${instanceId}; falling back to storage:`, err);
      }
    }

    // 2. Safe local adapter fallback
    const adapter = getRoleStorageAdapter();
    const result = await adapter.listMembers(instanceId, query);

    return {
      ...result,
      platformStatus: result.isDemoData
        ? 'LOCAL_ADAPTER: Synthetic tenant roster (Pending Live Wix CRM Deployment)'
        : 'LIVE_STORAGE: Production tenant database',
    };
  }

  /**
   * Queries live Wix Members API with tenant boundary verification
   */
  private static async queryLiveWixMembers(
    instanceId: InstanceId,
    query: MemberQuery
  ): Promise<(MemberQueryResult & { platformStatus: string }) | null> {
    // In live Wix hosting environment, inspect global Wix SDK client
    const wixClient = (globalThis as any).wixClient;
    if (!wixClient || typeof wixClient.members?.queryMembers !== 'function') {
      return null;
    }

    try {
      const page = Math.max(1, query.page || 1);
      const limit = Math.max(1, Math.min(100, query.limit || 20));
      const skip = (page - 1) * limit;

      let memberQuery = wixClient.members.queryMembers().skip(skip).limit(limit);

      if (query.search) {
        memberQuery = memberQuery.hasSome('loginEmail', [query.search]);
      }

      const response = await memberQuery.find();
      const rawItems: WixLiveMemberRaw[] = response.items || [];
      const total = response.totalCount || rawItems.length;

      const adapter = getRoleStorageAdapter();
      const assignments = await adapter.getMemberAssignments(instanceId);

      const mappedMembers: MemberRecord[] = rawItems.map((raw) => {
        const userId = toFlexiDashUserId(`wix_usr_${raw._id}`);
        const wixMemberId: WixMemberId = toWixMemberId(raw._id);
        const wixContactId: WixContactId | undefined = raw.contactId ? toWixContactId(raw.contactId) : undefined;

        // Verify compile-time and runtime distinction
        assertDistinctIdentityTypes(wixMemberId, wixContactId);

        const userAssignments = assignments.filter((a) => a.userId === userId);
        const roles = userAssignments.length > 0 ? userAssignments.map((a) => a.roleId) : [SYSTEM_ROLE_MEMBER];

        return {
          userId,
          instanceId,
          email: raw.loginEmail || `${raw._id}@member.wixsite.com`,
          name: raw.profile?.nickname || raw.profile?.slug || 'Wix Member',
          roles,
          permissions: DEFAULT_MEMBER_PERMISSIONS,
          isDemoData: false,
          createdAt: raw._createdDate || new Date().toISOString(),
          updatedAt: raw._updatedDate || new Date().toISOString(),
        };
      });

      return {
        members: mappedMembers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        isDemoData: false,
        platformStatus: 'LIVE_WIX_CRM: Authenticated Wix Members API',
      };
    } catch (err) {
      console.error('[WixCrmService] Error executing live Wix Members query:', err);
      return null;
    }
  }
}
