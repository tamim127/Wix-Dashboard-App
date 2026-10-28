/**
 * FlexiDash Member Directory & Roster Widget
 */

import React, { useState } from 'react';
import type { WidgetComponentProps } from '../types.ts';

export const MemberDirectoryWidget: React.FC<WidgetComponentProps> = () => {
  const [filter, setFilter] = useState('');

  const members = [
    { id: 'usr-1', name: 'Alexander Wright', email: 'admin@flexidash.local', role: 'Site Owner', status: 'Active' },
    { id: 'usr-2', name: 'Elena Rostova', email: 'elena@example.com', role: 'Admin', status: 'Active' },
    { id: 'usr-3', name: 'Marcus Chen', email: 'member@flexidash.local', role: 'Member', status: 'Active' },
    { id: 'usr-4', name: 'Chloe Bennett', email: 'chloe.b@example.com', role: 'Member', status: 'Pending' },
    { id: 'usr-5', name: 'David Kim', email: 'david.k@example.com', role: 'Guest', status: 'Active' },
  ];

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(filter.toLowerCase()) ||
      m.email.toLowerCase().includes(filter.toLowerCase()) ||
      m.role.toLowerCase().includes(filter.toLowerCase())
  );

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
      data-testid="widget-member-directory"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1a202c' }}>
            Member Directory & Roster
          </h3>
          <span style={{ fontSize: '12px', color: '#718096' }}>Authorized site members with mapped RBAC roles</span>
        </div>
        <input
          type="text"
          placeholder="Filter by name, email, or role..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            outline: 'none',
            minWidth: '220px',
          }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #edf2f7', color: '#718096', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 10px' }}>Name</th>
              <th style={{ padding: '8px 10px' }}>Email</th>
              <th style={{ padding: '8px 10px' }}>Role</th>
              <th style={{ padding: '8px 10px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                <td style={{ padding: '10px', fontWeight: 500, color: '#2d3748' }}>{m.name}</td>
                <td style={{ padding: '10px', color: '#4a5568' }}>{m.email}</td>
                <td style={{ padding: '10px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: m.role === 'Site Owner' ? '#fefcbf' : m.role === 'Admin' ? '#e2e8f0' : '#ebf8ff',
                      color: m.role === 'Site Owner' ? '#744210' : m.role === 'Admin' ? '#2d3748' : '#2b6cb0',
                    }}
                  >
                    {m.role}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: m.status === 'Active' ? '#38a169' : '#d69e2e',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: m.status === 'Active' ? '#38a169' : '#d69e2e' }} />
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
