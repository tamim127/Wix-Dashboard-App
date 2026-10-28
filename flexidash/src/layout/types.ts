/**
 * FlexiDash Dashboard Layout Schema & Widget Registry Types
 *
 * Provides typed, versioned models for dashboard layouts, widget definitions,
 * grid placements, and server-side validation.
 */

import type { PermissionKey } from '../models/rbac.ts';
import type { InstanceId, FlexiDashUserId } from '../models/identity.ts';

export const CURRENT_LAYOUT_SCHEMA_VERSION = 1;

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export type WidgetCategory = 'analytics' | 'management' | 'system' | 'portal';

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  requiredPermission: PermissionKey;
  supportedSizes: WidgetSize[];
  defaultSize: WidgetSize;
  defaultConfig: Record<string, unknown>;
  iconName?: string;
}

export interface WidgetInstance {
  instanceId: string; // Unique ID for this specific placed instance
  widgetId: string;   // References WidgetDefinition.id
  size: WidgetSize;
  order: number;      // 0-indexed ordering position in the layout
  visible: boolean;   // Whether the widget is rendered or hidden
  config: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  schemaVersion: number;
  instanceId: InstanceId;
  userId?: FlexiDashUserId; // Undefined = Site Default layout; Defined = User-specific custom layout
  name: string;
  description?: string;
  columns: number; // Grid columns, default 4 (responsive 1-4)
  theme: 'light' | 'dark' | 'system';
  widgets: WidgetInstance[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface LayoutValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedLayout?: DashboardLayout;
}

