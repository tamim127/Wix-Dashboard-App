/**
 * FlexiDash Site Analytics Overview Widget
 */

import React from 'react';
import type { WidgetComponentProps } from '../types.ts';

export const OverviewMetricsWidget: React.FC<WidgetComponentProps> = ({ instance }) => {
  const showTrends = instance.config?.showTrends !== false;

  const metrics = [
    { label: 'Total Page Views', value: '142,850', trend: '+14.2%', positive: true },
    { label: 'Unique Visitors', value: '48,210', trend: '+8.7%', positive: true },
    { label: 'Bounce Rate', value: '28.4%', trend: '-2.1%', positive: true },
    { label: 'Avg Session', value: '4m 18s', trend: '+12s', positive: true },
  ];

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
      data-testid="widget-overview-metrics"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1a202c' }}>
            Site Analytics Overview
          </h3>
          <span style={{ fontSize: '12px', color: '#718096' }}>Live visitor activity over the past 30 days</span>
        </div>
        <span style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#ebf8ff', color: '#2b6cb0', borderRadius: '4px', fontWeight: 500 }}>
          Real-time
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '16px',
        }}
      >
        {metrics.map((m, idx) => (
          <div
            key={idx}
            style={{
              padding: '12px',
              backgroundColor: '#f7fafc',
              borderRadius: '6px',
              border: '1px solid #edf2f7',
            }}
          >
            <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>
              {m.value}
            </div>
            {showTrends && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: m.positive ? '#38a169' : '#e53e3e',
                }}
              >
                {m.trend} vs last month
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

