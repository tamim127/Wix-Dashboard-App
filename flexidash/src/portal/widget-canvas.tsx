/**
 * FlexiDash Widget Canvas Renderer
 *
 * Renders an authenticated member's layout in an adaptive responsive grid:
 * - Strictly respects server-authorized widget ordering (w.order).
 * - Filters hidden widgets (w.visible === false).
 * - Maps widget size ('small' | 'medium' | 'large' | 'full') to CSS grid column spans.
 * - Encloses each widget in a fault-isolating Error Boundary.
 * - Safely handles unregistered or unknown widgets without crashing.
 */

import React from 'react';
import type { CanvasProps } from './types.ts';
import { renderWidgetInstance } from './widget-factory.tsx';
import {
  getColumnSpan,
  filterVisibleWidgets,
  sortWidgetsByOrder,
} from './canvas-utils.ts';

export { getColumnSpan };

export const WidgetCanvas: React.FC<CanvasProps> = ({
  widgets,
  columns = 4,
  session,
  permissions,
  role,
  onRefresh,
}) => {
  // 1. Filter out hidden widgets
  const visibleWidgets = filterVisibleWidgets(widgets);

  // 2. Sort widgets by their authoritative ordering
  const sortedWidgets = sortWidgetsByOrder(visibleWidgets);

  // 3. Handle empty layout state
  if (sortedWidgets.length === 0) {
    return (
      <div
        style={{
          border: '2px dashed #e2e8f0',
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          margin: '24px 0',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        data-testid="canvas-empty-state"
      >
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: '#2d3748' }}>
          No Active Widgets
        </h3>
        <p style={{ margin: 0, fontSize: '14px', color: '#718096', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
          Your current layout has no visible widgets configured, or your role lacks the permissions required to view the enabled modules.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
      }}
      data-testid="widget-canvas"
    >
      <style>{`
        .flexidash-grid {
          display: grid;
          grid-template-columns: repeat(${columns}, minmax(0, 1fr));
          gap: 20px;
          width: 100%;
        }
        @media (max-width: 1024px) {
          .flexidash-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .flexidash-grid-item {
            grid-column: span 1 !important;
          }
          .flexidash-span-full, .flexidash-span-large {
            grid-column: span 2 !important;
          }
        }
        @media (max-width: 640px) {
          .flexidash-grid {
            grid-template-columns: 1fr !important;
          }
          .flexidash-grid-item {
            grid-column: span 1 !important;
          }
        }
      `}</style>

      <div className="flexidash-grid">
        {sortedWidgets.map((instance) => {
          const span = getColumnSpan(instance.size, columns);
          const spanClass = `flexidash-grid-item flexidash-span-${instance.size}`;

          return (
            <div
              key={instance.instanceId}
              className={spanClass}
              style={{
                gridColumn: `span ${span}`,
                minWidth: 0,
              }}
              data-widget-id={instance.widgetId}
              data-widget-size={instance.size}
              data-widget-order={instance.order}
            >
              {renderWidgetInstance(instance, {
                session,
                permissions,
                role,
                onRefresh,
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
