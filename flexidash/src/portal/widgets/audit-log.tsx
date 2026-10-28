/**
 * FlexiDash Security Audit Logs Widget
 */

import React from 'react';
import type { WidgetComponentProps } from '../types.ts';

export const AuditLogWidget: React.FC<WidgetComponentProps> = () => {
  const logs = [
    { id: 'aud-101', event: 'AUTH_SUCCESS', actor: 'admin@flexidash.local', ip: '192.168.1.10', time: '13:24:02 UTC', status: 'SUCCESS' },
    { id: 'aud-102', event: 'ROLE_ASSIGNED', actor: 'admin@flexidash.local', ip: '192.168.1.10', time: '13:25:15 UTC', status: 'SUCCESS' },
    { id: 'aud-103', event: 'LAYOUT_PERSISTED', actor: 'member@flexidash.local', ip: '10.0.0.4', time: '13:28:40 UTC', status: 'SUCCESS' },
    { id: 'aud-104', event: 'AUTH_CHALLENGE_FAILED', actor: 'unknown_client', ip: '172.16.0.99', time: '13:30:11 UTC', status: 'DENIED' },
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
      data-testid="widget-audit-log"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1a202c' }}>
            Security Audit Logs
          </h3>
          <span style={{ fontSize: '12px', color: '#718096' }}>Immutable audit stream for privileged operations</span>
        </div>
        <span style={{ fontSize: '11px', backgroundColor: '#fed7d7', color: '#9b2c2c', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
          Protected
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              backgroundColor: '#f7fafc',
              borderRadius: '6px',
              fontSize: '12px',
              borderLeft: log.status === 'SUCCESS' ? '3px solid #38a169' : '3px solid #e53e3e',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: '#2d3748' }}>{log.event}</div>
              <div style={{ color: '#718096', fontSize: '11px' }}>Actor: {log.actor} • IP: {log.ip}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: log.status === 'SUCCESS' ? '#276749' : '#9b2c2c',
                  backgroundColor: log.status === 'SUCCESS' ? '#c6f6d5' : '#fed7d7',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {log.status}
              </span>
              <div style={{ fontSize: '10px', color: '#a0aec0', marginTop: '2px' }}>{log.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

