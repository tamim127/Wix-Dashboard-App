/**
 * FlexiDash Layout Storage Adapter Interface
 */

import type { InstanceId, FlexiDashUserId } from '../../models/identity.ts';
import type { DashboardLayout } from '../types.ts';

export interface ILayoutStorageAdapter {
  /**
   * Retrieve a layout for a specific tenant and optional user.
   * If userId is provided and no custom layout is found, returns the site-level default layout.
   */
  getLayout(instanceId: InstanceId, userId?: FlexiDashUserId): Promise<DashboardLayout | null>;

  /**
   * Persist a layout to storage.
   * Writes atomically and guarantees persistence across server restarts.
   */
  saveLayout(layout: DashboardLayout): Promise<void>;

  /**
   * Delete a layout. If userId is provided, deletes only that user's custom layout,
   * reverting them to the site-level default.
   */
  deleteLayout(instanceId: InstanceId, userId?: FlexiDashUserId): Promise<boolean>;

  /**
   * List all stored layouts for an installation tenant.
   */
  listLayouts(instanceId: InstanceId): Promise<DashboardLayout[]>;
}

