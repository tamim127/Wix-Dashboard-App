/**
 * FlexiDash Quick Performance KPIs Widget
 */

import React from 'react';
import type { WidgetComponentProps } from '../types.ts';

export const QuickStatsWidget: React.FC<WidgetComponentProps> = ({ instance }) => {
  const metricType = (instance.config?.metric as string) || 'active_sessions';

  const statsMap: Record<string, { title: string; count: string; subtitle: string; icon: string }> = {
    active_sessions: {
      title: 'Active Sessions',
      count: '1,429',
      subtitle: '+94 sessions this hour',
      icon: '⚡',
    },
    daily_queries: {
      title: 'Daily API Calls',
      count: '42.8k',
      subtitle: '99.98% success rate',
      icon: '📊',
    },
    member_count: {
      title: 'Registered Members',
      count: '8,924',
      subtitle: '+38 new this week',
      icon: '👥',
    },
  };

  const stat = statsMap[metricType] || statsMap['active_sessions'];

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
      data-testid="widget-quick-stats"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {stat.title}
        </span>
        <span style={{ fontSize: '18px' }}>{stat.icon}</span>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#1a202c', marginBottom: '4px' }}>
        {stat.count}
      </div>
      <div style={{ fontSize: '12px', color: '#38a169', fontWeight: 500 }}>
        {stat.subtitle}
      </div>
    </div>
  );
};

