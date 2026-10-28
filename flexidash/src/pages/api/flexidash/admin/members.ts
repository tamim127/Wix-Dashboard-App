/**
 * FlexiDash Admin Members API
 * GET /api/flexidash/admin/members
 *
 * Lists tenant members with filtering, search, pagination, and role summaries.
 * Explicitly indicates whether results are local/demo data or live CRM data.
 */

import type { APIRoute } from 'astro';
import { authorizeRequest } from '../../../../auth/middleware.ts';
import { jsonResponse, errorResponse } from '../../../../api/response.ts';
import { getRoleStorageAdapter } from '../../../../rbac/storage/role-storage-factory.ts';
import { WixCrmMemberService } from '../../../../crm/wix-crm-service.ts';
import type { PermissionKey } from '../../../../models/rbac.ts';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const { session } = await authorizeRequest(request.headers, 'members:view');
    const url = new URL(request.url);

    const search = url.searchParams.get('q') || url.searchParams.get('search') || undefined;
    const roleId = url.searchParams.get('roleId') || undefined;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    const result = await WixCrmMemberService.getTenantMembers(session.instanceId, {
      search,
      roleId,
      page,
      limit,
    });

    const adapter = getRoleStorageAdapter();
    const allRoles = await adapter.listRoles(session.instanceId);
    const roleMap = new Map(allRoles.map((r) => [r.id, r]));

    // Compute effective permissions for each member
    const membersWithPermissions = result.members.map((member) => {
      const permsSet = new Set<PermissionKey>();
      for (const rid of member.roles) {
        const foundRole = roleMap.get(rid);
        if (foundRole) {
          for (const p of foundRole.permissions) {
            permsSet.add(p);
          }
        }
      }
      return {
        ...member,
        effectivePermissions: Array.from(permsSet),
      };
    });

    return jsonResponse({
      instanceId: session.instanceId,
      members: membersWithPermissions,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      isDemoData: result.isDemoData,
      platformStatus: result.platformStatus,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

