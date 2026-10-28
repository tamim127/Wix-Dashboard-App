/**
 * FlexiDash Role Assignment Manager Widget
 */

import React from 'react';
import type { WidgetComponentProps } from '../types.ts';

export const RolesTableWidget: React.FC<WidgetComponentProps> = ({ instance }) => {
  const showSystemRoles = instance.config?.showSystemRoles !== false;

  const roles = [
    {
      id: 'role_site_owner',
      name: 'Site Owner',
      description: 'Unrestricted administration across all site extensions and members',
      isSystem: true,
      permissions: ['* (All System Privileges)'],
    },
    {
      id: 'role_admin',
      name: 'Administrator',
      description: 'Manage members, role assignments, layout settings, and integrations',
      isSystem: true,
      permissions: ['dashboard:view', 'dashboard:edit', 'members:view', 'members:edit', 'roles:view', 'roles:assign', 'integrations:view'],
    },
    {
      id: 'role_member',
      name: 'Standard Member',
      description: 'Default site member with personalized dashboard view',
      isSystem: true,
      permissions: ['dashboard:view', 'portal:access'],
    },
    {
      id: 'role_guest',
      name: 'Guest Visitor',
      description: 'Unauthenticated or read-only visitor access',
      isSystem: false,
      permissions: ['portal:access'],
    },
  ];

  const displayed = showSystemRoles ? roles : roles.filter((r) => !r.isSystem);

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
      data-testid="widget-roles-table"
    >
      <div style={{ marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1a202c' }}>
          Role Assignment Privileges
        </h3>
        <span style={{ fontSize: '12px', color: '#718096' }}>Hierarchy and permission grants evaluated by PolicyEngine</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displayed.map((r) => (
          <div
            key={r.id}
            style={{
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '14px', color: '#2d3748' }}>{r.name}</strong>
                {r.isSystem && (
                  <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', color: '#4a5568', padding: '1px 6px', borderRadius: '4px' }}>
                    SYSTEM
                  </span>
                )}
              </div>
              <code style={{ fontSize: '11px', color: '#718096' }}>{r.id}</code>
            </div>
            <div style={{ fontSize: '12px', color: '#4a5568', marginBottom: '8px' }}>{r.description}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {r.permissions.map((p, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '11px',
                    backgroundColor: '#edf2f7',
                    color: '#2d3748',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

