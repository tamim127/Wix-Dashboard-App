/**
 * FlexiDash Wix CRM & Leads Widget
 */

import React, { useState } from 'react';
import type { WidgetComponentProps } from '../types.ts';

interface LeadItem {
  id: string;
  name: string;
  email: string;
  source: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED';
  timeAgo: string;
}

export const WixCrmWidget: React.FC<WidgetComponentProps> = ({ instance, onAction }) => {
  const [leads, setLeads] = useState<LeadItem[]>([
    { id: 'lead-1', name: 'James Patterson', email: 'j.patterson@example.com', source: 'Contact Form', status: 'NEW', timeAgo: '8m ago' },
    { id: 'lead-2', name: 'Maya Lin', email: 'maya.lin@design.co', source: 'Webinar RSVP', status: 'CONTACTED', timeAgo: '42m ago' },
    { id: 'lead-3', name: 'Robert De Vries', email: 'robert@enterprise.nl', source: 'Direct Inquiry', status: 'QUALIFIED', timeAgo: '2h ago' },
  ]);

  const handleStatusChange = (id: string, newStatus: LeadItem['status']) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
    );
    onAction?.('update_lead_status', { leadId: id, status: newStatus });
  };

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
      data-testid="widget-wix-crm"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#1a202c' }}>
            👥 Wix CRM & Inquiries
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#718096' }}>
            Synchronized contact submissions, sales pipeline & lead touches
          </p>
        </div>
        <span
          style={{
            backgroundColor: '#feebc8',
            color: '#744210',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          Synced with Wix CRM
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {leads.map((lead) => (
          <div
            key={lead.id}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              backgroundColor: '#f7fafc',
              border: '1px solid #edf2f7',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#2d3748' }}>{lead.name}</div>
              <div style={{ fontSize: '11px', color: '#718096' }}>
                {lead.email} &nbsp;•&nbsp; Source: <span style={{ color: '#2b6cb0' }}>{lead.source}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={lead.status}
                onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadItem['status'])}
                style={{
                  padding: '3px 6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  border: '1px solid #cbd5e0',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
