/**
 * FlexiDash Connected Apps & Webhooks Widget
 */

import React from 'react';
import type { WidgetComponentProps } from '../types.ts';

export const IntegrationsWidget: React.FC<WidgetComponentProps> = () => {
  const integrations = [
    { name: 'Cloudflare Workers KV', status: 'Active', latency: '12ms', type: 'Storage Engine' },
    { name: 'Wix Headless REST API', status: 'Connected', latency: '45ms', type: 'Platform' },
    { name: 'Wix CRM Webhook Relay', status: 'Synchronized', latency: '88ms', type: 'Identity Sync' },
    { name: 'HMAC-SHA256 Token Authority', status: 'Operational', latency: '0.4ms', type: 'Auth' },
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
      data-testid="widget-integrations"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1a202c' }}>
            Connected Apps & Webhooks
          </h3>
          <span style={{ fontSize: '12px', color: '#718096' }}>Live connectivity to platform services</span>
        </div>
        <span style={{ fontSize: '11px', color: '#38a169', fontWeight: 600 }}>All Systems Nominal</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {integrations.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: '#f7fafc',
              borderRadius: '6px',
              border: '1px solid #edf2f7',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#2d3748' }}>{item.name}</div>
              <div style={{ fontSize: '11px', color: '#718096' }}>{item.type}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: '#38a169', fontWeight: 600, backgroundColor: '#f0fff4', padding: '2px 8px', borderRadius: '12px' }}>
                ● {item.status}
              </span>
              <div style={{ fontSize: '11px', color: '#a0aec0', marginTop: '2px' }}>{item.latency}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

