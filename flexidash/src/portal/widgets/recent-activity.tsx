/**
 * FlexiDash Recent Activity Feed Widget
 */

import React, { useState } from 'react';
import type { WidgetComponentProps } from '../types.ts';

export const RecentActivityWidget: React.FC<WidgetComponentProps> = ({ instance }) => {
  const maxItems = (instance.config?.maxItems as number) || 5;

  const [activities] = useState([
    { id: '1', user: 'admin@flexidash.local', action: 'Assigned role Member to user_29', time: '4 minutes ago', tag: 'Security' },
    { id: '2', user: 'member@flexidash.local', action: 'Customized dashboard layout', time: '22 minutes ago', tag: 'Layout' },
    { id: '3', user: 'sarah.j@example.com', action: 'Registered new member account', time: '1 hour ago', tag: 'Identity' },
    { id: '4', user: 'system_webhook', action: 'Synchronized Wix CRM contact profile', time: '2 hours ago', tag: 'Sync' },
    { id: '5', user: 'dev_user_01', action: 'Issued temporary API token', time: '3 hours ago', tag: 'Auth' },
  ]);

  const displayed = activities.slice(0, maxItems);

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
      data-testid="widget-recent-activity"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1a202c' }}>
          Recent Activity Feed
        </h3>
        <span style={{ fontSize: '11px', color: '#a0aec0' }}>Showing {displayed.length} items</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displayed.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              borderLeft: '3px solid #3182ce',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#2d3748' }}>{item.action}</div>
              <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>By: {item.user}</div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', color: '#4a5568' }}>
                {item.tag}
              </span>
              <div style={{ fontSize: '11px', color: '#a0aec0', marginTop: '4px' }}>{item.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

