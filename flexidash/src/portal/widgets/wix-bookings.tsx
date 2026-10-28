/**
 * FlexiDash Wix Bookings & Appointments Widget
 */

import React, { useState } from 'react';
import type { WidgetComponentProps } from '../types.ts';

interface BookingSession {
  id: string;
  service: string;
  clientName: string;
  staffName: string;
  timeSlot: string;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
}

export const WixBookingsWidget: React.FC<WidgetComponentProps> = ({ instance, onAction }) => {
  const [sessions, setSessions] = useState<BookingSession[]>([
    { id: 'bkg-1', service: 'VIP Strategy Consultation', clientName: 'Sarah Jenkins', staffName: 'Alex Rivers', timeSlot: 'Today, 2:30 PM - 3:30 PM', status: 'CONFIRMED' },
    { id: 'bkg-2', service: 'Team Onboarding Session', clientName: 'David Kim', staffName: 'Taylor Morgan', timeSlot: 'Today, 4:00 PM - 4:45 PM', status: 'PENDING' },
    { id: 'bkg-3', service: 'Technical Architecture Review', clientName: 'Elena Rostova', staffName: 'Alex Rivers', timeSlot: 'Tomorrow, 10:00 AM - 11:00 AM', status: 'CONFIRMED' },
  ]);

  const handleConfirm = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'CONFIRMED' } : s))
    );
    onAction?.('confirm_booking', { bookingId: id });
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
      data-testid="widget-wix-bookings"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#1a202c' }}>
            📅 Wix Bookings & Sessions
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#718096' }}>
            Scheduled client appointments, workshops & consultation calendar
          </p>
        </div>
        <span
          style={{
            backgroundColor: '#ebf8ff',
            color: '#2b6cb0',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          3 Upcoming
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sessions.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '12px 14px',
              borderRadius: '6px',
              backgroundColor: '#f7fafc',
              border: '1px solid #edf2f7',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#2d3748' }}>{item.service}</div>
              <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '2px' }}>
                👤 {item.clientName} &nbsp;•&nbsp; 🕒 {item.timeSlot}
              </div>
              <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>
                Host: {item.staffName}
              </div>
            </div>
            <div>
              {item.status === 'PENDING' ? (
                <button
                  type="button"
                  onClick={() => handleConfirm(item.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: '#38a169',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Confirm
                </button>
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#22543d',
                    backgroundColor: '#c6f6d5',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  ✓ Confirmed
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
