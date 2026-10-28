/**
 * FlexiDash Portal Page Access API
 * GET /api/flexidash/portal/pages/access
 *
 * Evaluates caller's effective access against server-defined PageAccessRules.
 * Returns authorized navigation items and evaluates specific path permissions.
 */

import type { APIRoute } from 'astro';
import { authorizeRequest } from '../../../../../auth/middleware.ts';
import { jsonResponse, errorResponse } from '../../../../../api/response.ts';
import {
  checkPageAccess,
  filterAuthorizedNavItems,
  DEFAULT_PAGE_RULES,
  DEFAULT_PORTAL_NAV_ITEMS,
} from '../../../../../rbac/page-access.ts';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const { session } = await authorizeRequest(request.headers, 'portal:access');

    const url = new URL(request.url);
    const checkPath = url.searchParams.get('path');

    if (checkPath) {
      const evaluation = checkPageAccess(session, checkPath);
      if (!evaluation.allowed) {
        return jsonResponse(
          {
            path: checkPath,
            allowed: false,
            reason: evaluation.reason,
          },
          403
        );
      }
      return jsonResponse({
        path: checkPath,
        allowed: true,
        rule: evaluation.rule,
      });
    }

    const authorizedNav = filterAuthorizedNavItems(session, DEFAULT_PORTAL_NAV_ITEMS);
    const allowedRoutes = DEFAULT_PAGE_RULES.filter(
      (rule) => checkPageAccess(session, rule.path).allowed
    ).map((r) => r.path);

    return jsonResponse({
      instanceId: session.instanceId,
      userId: session.userId,
      roles: session.roles,
      allowedRoutes,
      navItems: authorizedNav,
      rules: DEFAULT_PAGE_RULES,
    });
  } catch (err) {
    return errorResponse(err);
  }
};

