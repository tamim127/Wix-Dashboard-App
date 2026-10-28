/**
 * FlexiDash Unknown Widget Fallback Component
 *
 * Gracefully renders unrecognized or deprecated widget instances
 * without crashing the dashboard or interrupting canvas rendering.
 */

import React from 'react';
import type { WidgetComponentProps } from '../types.ts';

export const UnknownWidget: React.FC<WidgetComponentProps> = ({ instance }) => {
  return (
    <div
      style={{
        border: '1px dashed #d64545',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#fff5f5',
        color: '#2b2b2b',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      data-testid={`unknown-widget-${instance.widgetId}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '18px' }}>⚠️</span>
        <strong style={{ color: '#c53030', fontSize: '14px' }}>Unregistered Widget</strong>
      </div>
      <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#4a5568' }}>
        Widget identifier <code>"{instance.widgetId}"</code> is not registered in this deployment or was deprecated.
      </p>
      <div style={{ fontSize: '11px', color: '#718096' }}>
        Instance ID: {instance.instanceId} • Size: {instance.size}
      </div>
    </div>
  );
};

