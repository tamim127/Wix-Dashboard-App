/**
 * FlexiDash Member Portal Types
 *
 * Defines view state transitions, widget component contracts,
 * and responsive canvas properties.
 */

import type { WidgetInstance, WidgetDefinition } from '../layout/types.ts';
import type { AuthSession } from '../models/session.ts';

export type PortalViewState =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated'
  | 'expired'
  | 'forbidden'
  | 'empty'
  | 'error';

export interface WidgetComponentProps {
  instance: WidgetInstance;
  definition?: WidgetDefinition;
  session?: AuthSession | null;
  permissions?: string[];
  role?: string;
  onRefresh?: () => void;
  onAction?: (action: string, payload?: unknown) => void;
}

export interface CanvasProps {
  widgets: WidgetInstance[];
  columns?: number;
  session?: AuthSession | null;
  permissions?: string[];
  role?: string;
  onRefresh?: () => void;
}

export interface ResponsiveSpan {
  colSpan: number;
  rowSpan?: number;
}
