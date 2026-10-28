/**
 * FlexiDash Portal Canvas Utilities
 *
 * Pure TypeScript functions for grid layout calculations, responsive spans,
 * and widget ordering. Usable in both browser runtime and Node.js server/test runners.
 */

import type { WidgetSize } from '../layout/types.ts';
import { WIDGET_REGISTRY } from '../layout/registry.ts';

/**
 * Calculates the responsive column span for a given widget size
 */
export function getColumnSpan(size: WidgetSize, totalColumns: number = 4): number {
  switch (size) {
    case 'small':
      return 1;
    case 'medium':
      return Math.min(2, totalColumns);
    case 'large':
      return Math.min(3, totalColumns);
    case 'full':
    default:
      return totalColumns;
  }
}

/**
 * Filters a widget list to only visible instances
 */
export function filterVisibleWidgets<T extends { visible?: boolean }>(widgets: T[]): T[] {
  return widgets.filter((w) => w.visible !== false);
}

/**
 * Sorts widgets in strictly ascending order by their layout order property
 */
export function sortWidgetsByOrder<T extends { order: number }>(widgets: T[]): T[] {
  return [...widgets].sort((a, b) => a.order - b.order);
}

/**
 * Checks whether a widgetId is recognized in the official registry
 */
export function isRegisteredWidgetId(widgetId: string): boolean {
  return Boolean(WIDGET_REGISTRY[widgetId]);
}

