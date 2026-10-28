/**
 * FlexiDash Layout Customizer Canvas Widget
 */

import React from 'react';
import type { WidgetComponentProps } from '../types.ts';

export const LayoutEditorWidget: React.FC<WidgetComponentProps> = ({ onAction }) => {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      data-testid="widget-layout-editor"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1a202c' }}>
            Layout Customizer Canvas
          </h3>
          <span style={{ fontSize: '12px', color: '#718096' }}>Configure and personalize your dashboard grid layout</span>
        </div>
        <span style={{ fontSize: '11px', backgroundColor: '#e6fffa', color: '#234e52', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
          Interactive
        </span>
      </div>

      <div style={{ padding: '16px', backgroundColor: '#f7fafc', borderRadius: '6px', border: '1px dashed #cbd5e0', marginBottom: '14px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#4a5568' }}>
          As an authorized administrator or member with <code>dashboard:edit</code> privileges, you can arrange widget positions, resize cards across 1 to 4 responsive columns, or customize site-wide defaults.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onAction?.('open_layout_editor')}
            style={{
              backgroundColor: '#3182ce',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Open Layout Editor
          </button>
          <button
            onClick={() => onAction?.('reset_default_layout')}
            style={{
              backgroundColor: '#edf2f7',
              color: '#4a5568',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reset to Site Default
          </button>
        </div>
      </div>
    </div>
  );
};
